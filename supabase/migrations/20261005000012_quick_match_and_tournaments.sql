-- TEKNOFEST Bilgi Yarismasi - quick match queue and single-elimination tournaments
-- 2026-10-05. Apply manually after 20261005000011_review_leaderboard_rematch_admin.sql.
-- Adds:
--  * _create_room_for(): shared server-side room factory (code + questions + host seat).
--    create_room_rpc uses it for server-generated codes (behaviour unchanged).
--  * matchmaking_queue + quick_match_rpc (polled every ~2s) + cancel_quick_match_rpc.
--  * tournaments / tournament_players / tournament_matches + create/join/leave/start/get RPCs.
--  * rooms.tournament_code; _on_room_result now also advances the tournament bracket
--    (leaderboard logic unchanged) via _advance_tournament().
--  * Tournament rooms: no rematch/restart, leaving in LOBBY is a forfeit,
--    cleanup_stale_rooms_rpc keeps rooms of RUNNING tournaments.
-- Clients never touch the new tables directly; everything goes through the RPCs (polling).
BEGIN;

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS tournament_code TEXT;
CREATE INDEX IF NOT EXISTS idx_rooms_tournament_code ON public.rooms(tournament_code)
  WHERE tournament_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
  auth_user_id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  matched_room_code TEXT
);
CREATE INDEX IF NOT EXISTS idx_matchmaking_waiting ON public.matchmaking_queue(created_at)
  WHERE matched_room_code IS NULL;

CREATE TABLE IF NOT EXISTS public.tournaments (
  code TEXT PRIMARY KEY CHECK (code ~ '^[0-9]{6}$'),
  name TEXT NOT NULL,
  size INT NOT NULL CHECK (size IN (4, 8)),
  status TEXT NOT NULL DEFAULT 'REGISTRATION' CHECK (status IN ('REGISTRATION', 'RUNNING', 'FINISHED')),
  organizer UUID NOT NULL,
  champion UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tournament_players (
  tournament_code TEXT REFERENCES public.tournaments(code) ON DELETE CASCADE,
  auth_user_id UUID,
  name TEXT,
  avatar TEXT,
  joined_at TIMESTAMPTZ DEFAULT now(),
  eliminated BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (tournament_code, auth_user_id)
);

CREATE TABLE IF NOT EXISTS public.tournament_matches (
  tournament_code TEXT REFERENCES public.tournaments(code) ON DELETE CASCADE,
  round INT,
  slot INT,
  player_a UUID,
  player_b UUID,
  room_code TEXT,
  winner UUID,
  PRIMARY KEY (tournament_code, round, slot)
);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_room ON public.tournament_matches(room_code);

ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.matchmaking_queue, public.tournaments, public.tournament_players,
  public.tournament_matches FROM PUBLIC, anon, authenticated;
-- No policies: browsers only use the RPCs below.

-- ---------------------------------------------------------------------------
-- Internal: room factory
-- ---------------------------------------------------------------------------
-- Creates a LOBBY room with a server-generated 6-digit code and a fresh question set, seats the
-- host, and returns the code. Returns NULL if no question set or no free code could be found.
-- The caller is responsible for validating the host identity.
CREATE OR REPLACE FUNCTION public._create_room_for(
 p_host_uid UUID, p_host_name TEXT, p_host_avatar TEXT, p_tournament_code TEXT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_questions JSONB; v_try TEXT; v_code TEXT; v_attempt INTEGER;
BEGIN
 v_questions := public._pick_room_questions(NULL);
 IF v_questions IS NULL THEN RETURN NULL; END IF;

 FOR v_attempt IN 1..20 LOOP
   v_try := (100000 + floor(random() * 900000))::INTEGER::TEXT;
   BEGIN
     INSERT INTO public.rooms(code, status, match_questions, tournament_code)
     VALUES (v_try, 'LOBBY', v_questions, p_tournament_code);
     v_code := v_try;
     EXIT;
   EXCEPTION WHEN unique_violation THEN
     NULL; -- collision: try another code
   END;
 END LOOP;
 IF v_code IS NULL THEN RETURN NULL; END IF;

 INSERT INTO public.room_players(room_code, player_id, auth_user_id, name, avatar, is_host)
 VALUES (v_code, p_host_uid::text, p_host_uid, trim(p_host_name), p_host_avatar, true);
 RETURN v_code;
END;
$$;

-- Same contract as 000011; server-generated codes now go through _create_room_for.
CREATE OR REPLACE FUNCTION public.create_room_rpc(
 p_code TEXT, p_name TEXT, p_avatar TEXT, p_match_questions JSONB, p_player_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID := auth.uid(); v_code TEXT := nullif(trim(coalesce(p_code, '')), '');
 v_error TEXT; v_questions JSONB;
BEGIN
 -- p_match_questions and p_player_id are legacy parameters and are ignored (never trust the client).
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Oturum yok (signInAnonymously gerekli)'); END IF;
 v_error := public._validate_player_identity(p_name, p_avatar);
 IF v_error IS NOT NULL THEN RETURN jsonb_build_object('success',false,'error',v_error); END IF;
 IF v_code IS NOT NULL AND v_code !~ '^[0-9]{6}$' THEN
   RETURN jsonb_build_object('success',false,'error','Oda kodu 6 rakam olmalı'); END IF;

 v_questions := public._pick_room_questions(NULL);
 IF v_questions IS NULL THEN
   RETURN jsonb_build_object('success',false,'error','Yeterli soru bulunamadı (4 kolay, 4 orta, 2 zor gerekli)'); END IF;

 IF v_code IS NOT NULL THEN
   BEGIN
     INSERT INTO public.rooms(code,status,match_questions) VALUES(v_code,'LOBBY',v_questions);
   EXCEPTION WHEN unique_violation THEN
     RETURN jsonb_build_object('success',false,'error','Kod kullanılıyor, tekrar deneyin');
   END;
   INSERT INTO public.room_players(room_code,player_id,auth_user_id,name,avatar,is_host)
   VALUES(v_code,v_uid::text,v_uid,trim(p_name),p_avatar,true);
 ELSE
   v_code := public._create_room_for(v_uid, p_name, p_avatar, NULL);
   IF v_code IS NULL THEN
     RETURN jsonb_build_object('success',false,'error','Oda kodu üretilemedi, tekrar deneyin'); END IF;
 END IF;

 RETURN jsonb_build_object('success',true,'code',v_code,'player_id',v_uid::text);
END;
$$;

-- ---------------------------------------------------------------------------
-- Quick match
-- ---------------------------------------------------------------------------
-- Polled by the client every ~2s. A waiting row whose owner has not polled for 30s is ignored.
CREATE OR REPLACE FUNCTION public.quick_match_rpc(p_name TEXT, p_avatar TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID := auth.uid(); v_error TEXT; v_matched TEXT; v_has_row BOOLEAN;
 v_other RECORD; v_code TEXT;
BEGIN
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Oturum açılmadı'); END IF;
 v_error := public._validate_player_identity(p_name, p_avatar);
 IF v_error IS NOT NULL THEN RETURN jsonb_build_object('success',false,'error',v_error); END IF;

 -- Locking my own row first also keeps two simultaneous pollers from picking each other.
 SELECT matched_room_code INTO v_matched FROM public.matchmaking_queue
 WHERE auth_user_id = v_uid FOR UPDATE;
 v_has_row := FOUND;
 IF v_has_row AND v_matched IS NOT NULL THEN
   DELETE FROM public.matchmaking_queue WHERE auth_user_id = v_uid;
   RETURN jsonb_build_object('success',true,'status','MATCHED','room_code',v_matched);
 END IF;

 SELECT q.auth_user_id, q.name, q.avatar INTO v_other
 FROM public.matchmaking_queue q
 WHERE q.matched_room_code IS NULL AND q.auth_user_id <> v_uid
   AND q.created_at > now() - interval '30 seconds'
 ORDER BY q.created_at
 LIMIT 1
 FOR UPDATE SKIP LOCKED;

 IF FOUND THEN
   v_code := public._create_room_for(v_other.auth_user_id, v_other.name, v_other.avatar, NULL);
   IF v_code IS NULL THEN
     RETURN jsonb_build_object('success',false,'error','Oda kurulamadı, tekrar deneyin'); END IF;
   INSERT INTO public.room_players(room_code, player_id, auth_user_id, name, avatar, is_host)
   VALUES (v_code, v_uid::text, v_uid, trim(p_name), p_avatar, false);
   UPDATE public.matchmaking_queue SET matched_room_code = v_code
   WHERE auth_user_id = v_other.auth_user_id;
   DELETE FROM public.matchmaking_queue WHERE auth_user_id = v_uid;
   RETURN jsonb_build_object('success',true,'status','MATCHED','room_code',v_code);
 END IF;

 INSERT INTO public.matchmaking_queue(auth_user_id, name, avatar, created_at)
 VALUES (v_uid, trim(p_name), p_avatar, now())
 ON CONFLICT (auth_user_id) DO UPDATE
   SET name = EXCLUDED.name, avatar = EXCLUDED.avatar, created_at = now();
 RETURN jsonb_build_object('success',true,'status','WAITING');
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_quick_match_rpc()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Oturum açılmadı'); END IF;
 DELETE FROM public.matchmaking_queue WHERE auth_user_id = v_uid;
 RETURN jsonb_build_object('success',true);
END;
$$;

-- ---------------------------------------------------------------------------
-- Tournaments: internal helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._tournament_rounds(p_size INT)
RETURNS INT LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT CASE p_size WHEN 4 THEN 2 WHEN 8 THEN 3 ELSE NULL END;
$$;

-- Creates the room for a match whose two players are known (player_a hosts) and stores its code.
-- Raises if the room cannot be created (question pool / code space exhausted).
CREATE OR REPLACE FUNCTION public._create_tournament_match_room(p_code TEXT, p_round INT, p_slot INT)
RETURNS TEXT LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE m RECORD; pa RECORD; pb RECORD; v_room TEXT;
BEGIN
 SELECT * INTO m FROM public.tournament_matches
 WHERE tournament_code = p_code AND round = p_round AND slot = p_slot FOR UPDATE;
 IF NOT FOUND OR m.player_a IS NULL OR m.player_b IS NULL THEN RETURN NULL; END IF;
 IF m.room_code IS NOT NULL THEN RETURN m.room_code; END IF;

 SELECT name, avatar INTO pa FROM public.tournament_players
 WHERE tournament_code = p_code AND auth_user_id = m.player_a;
 SELECT name, avatar INTO pb FROM public.tournament_players
 WHERE tournament_code = p_code AND auth_user_id = m.player_b;

 v_room := public._create_room_for(m.player_a, pa.name, pa.avatar, p_code);
 IF v_room IS NULL THEN RAISE EXCEPTION 'Turnuva odası kurulamadı'; END IF;
 INSERT INTO public.room_players(room_code, player_id, auth_user_id, name, avatar, is_host)
 VALUES (v_room, m.player_b::text, m.player_b, pb.name, pb.avatar, false);
 UPDATE public.tournament_matches SET room_code = v_room
 WHERE tournament_code = p_code AND round = p_round AND slot = p_slot;
 RETURN v_room;
END;
$$;

-- Records the winner of the (still undecided) tournament match played in p_room_code, eliminates
-- the loser and moves the winner into the next round (round r slot s -> round r+1 slot s/2, side a
-- for even s, b for odd s). The next match's room is created once both of its players are known.
-- The final's winner becomes champion and the tournament FINISHED. No-op if already decided.
CREATE OR REPLACE FUNCTION public._advance_tournament(p_room_code TEXT, p_winner UUID)
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_tcode TEXT; m RECORD; v_size INT; v_rounds INT; v_winner UUID; v_loser UUID;
 v_next_slot INT; n RECORD;
BEGIN
 SELECT tournament_code INTO v_tcode FROM public.tournament_matches
 WHERE room_code = p_room_code AND winner IS NULL LIMIT 1;
 IF v_tcode IS NULL THEN RETURN; END IF;

 -- Serialize all bracket changes of one tournament.
 SELECT size INTO v_size FROM public.tournaments WHERE code = v_tcode FOR UPDATE;
 SELECT * INTO m FROM public.tournament_matches
 WHERE tournament_code = v_tcode AND room_code = p_room_code AND winner IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;

 v_winner := CASE WHEN p_winner = m.player_b THEN m.player_b ELSE m.player_a END;
 v_loser := CASE WHEN v_winner = m.player_a THEN m.player_b ELSE m.player_a END;
 v_rounds := public._tournament_rounds(v_size);

 UPDATE public.tournament_matches SET winner = v_winner
 WHERE tournament_code = v_tcode AND round = m.round AND slot = m.slot;
 UPDATE public.tournament_players SET eliminated = true
 WHERE tournament_code = v_tcode AND auth_user_id = v_loser;

 IF m.round >= v_rounds THEN
   UPDATE public.tournaments SET status = 'FINISHED', champion = v_winner WHERE code = v_tcode;
   RETURN;
 END IF;

 v_next_slot := m.slot / 2;
 INSERT INTO public.tournament_matches(tournament_code, round, slot, player_a, player_b)
 VALUES (v_tcode, m.round + 1, v_next_slot,
         CASE WHEN m.slot % 2 = 0 THEN v_winner END,
         CASE WHEN m.slot % 2 = 1 THEN v_winner END)
 ON CONFLICT (tournament_code, round, slot) DO UPDATE
   SET player_a = coalesce(public.tournament_matches.player_a, EXCLUDED.player_a),
       player_b = coalesce(public.tournament_matches.player_b, EXCLUDED.player_b);

 SELECT * INTO n FROM public.tournament_matches
 WHERE tournament_code = v_tcode AND round = m.round + 1 AND slot = v_next_slot;
 IF n.player_a IS NOT NULL AND n.player_b IS NOT NULL AND n.room_code IS NULL THEN
   PERFORM public._create_tournament_match_room(v_tcode, m.round + 1, v_next_slot);
 END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Room RESULT trigger: leaderboard (unchanged from 000011) + tournament progression
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._on_room_result()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m RECORD; v_winner UUID;
BEGIN
 IF NOT (OLD.status IS DISTINCT FROM 'RESULT' AND NEW.status = 'RESULT') THEN
   RETURN NEW;
 END IF;

 -- 1) Leaderboard: one row per player per match. A player wins only with a strictly higher
 --    score than the opponent; a player left alone (opponent forfeited) counts as the winner.
 INSERT INTO public.leaderboard_entries(room_code, match_no, auth_user_id, name, avatar,
   score, correct_answers, won)
 SELECT NEW.code, NEW.match_no, p.auth_user_id, p.name, p.avatar, p.score, p.correct_answers,
   p.score > coalesce((SELECT max(o.score) FROM public.room_players o
                       WHERE o.room_code = NEW.code AND o.id <> p.id), -1)
 FROM public.room_players p
 WHERE p.room_code = NEW.code AND p.auth_user_id IS NOT NULL
 ON CONFLICT (room_code, match_no, auth_user_id) DO NOTHING;

 -- 2) Tournament progression: the sole remaining player wins; otherwise higher score, then more
 --    correct answers, then earlier finish (unfinished last), then player_a.
 IF NEW.tournament_code IS NOT NULL THEN
   SELECT * INTO m FROM public.tournament_matches
   WHERE tournament_code = NEW.tournament_code AND room_code = NEW.code AND winner IS NULL;
   IF FOUND THEN
     SELECT p.auth_user_id INTO v_winner
     FROM public.room_players p
     WHERE p.room_code = NEW.code AND p.auth_user_id IN (m.player_a, m.player_b)
     ORDER BY p.score DESC, p.correct_answers DESC, p.finished_at ASC NULLS LAST,
              (p.auth_user_id = m.player_a) DESC
     LIMIT 1;
     PERFORM public._advance_tournament(NEW.code, coalesce(v_winner, m.player_a));
   END IF;
 END IF;

 RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Tournaments: public RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_tournament_rpc(
 p_name TEXT, p_size INT, p_player_name TEXT, p_avatar TEXT, p_join BOOLEAN DEFAULT true)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID := auth.uid(); v_name TEXT := trim(coalesce(p_name, ''));
 v_join BOOLEAN := coalesce(p_join, true); v_error TEXT; v_try TEXT; v_code TEXT; v_attempt INTEGER;
BEGIN
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Oturum açılmadı'); END IF;
 IF char_length(v_name) NOT BETWEEN 3 AND 40 THEN
   RETURN jsonb_build_object('success',false,'error','Turnuva adı 3-40 karakter olmalı'); END IF;
 IF p_size IS NULL OR p_size NOT IN (4, 8) THEN
   RETURN jsonb_build_object('success',false,'error','Turnuva 4 veya 8 kişilik olmalı'); END IF;
 IF v_join THEN
   v_error := public._validate_player_identity(p_player_name, p_avatar);
   IF v_error IS NOT NULL THEN RETURN jsonb_build_object('success',false,'error',v_error); END IF;
 END IF;

 FOR v_attempt IN 1..20 LOOP
   v_try := (100000 + floor(random() * 900000))::INTEGER::TEXT;
   BEGIN
     INSERT INTO public.tournaments(code, name, size, organizer) VALUES (v_try, v_name, p_size, v_uid);
     v_code := v_try;
     EXIT;
   EXCEPTION WHEN unique_violation THEN
     NULL;
   END;
 END LOOP;
 IF v_code IS NULL THEN
   RETURN jsonb_build_object('success',false,'error','Turnuva kodu üretilemedi, tekrar deneyin'); END IF;

 IF v_join THEN
   INSERT INTO public.tournament_players(tournament_code, auth_user_id, name, avatar)
   VALUES (v_code, v_uid, trim(p_player_name), p_avatar);
 END IF;
 RETURN jsonb_build_object('success',true,'code',v_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_tournament_rpc(p_code TEXT, p_name TEXT, p_avatar TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID := auth.uid(); v_code TEXT := trim(coalesce(p_code, ''));
 t RECORD; v_count INTEGER; v_error TEXT;
BEGIN
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Oturum açılmadı'); END IF;
 SELECT status, size INTO t FROM public.tournaments WHERE code = v_code FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Turnuva bulunamadı'); END IF;
 IF EXISTS (SELECT 1 FROM public.tournament_players WHERE tournament_code = v_code AND auth_user_id = v_uid) THEN
   RETURN jsonb_build_object('success',true,'code',v_code);
 END IF;
 IF t.status <> 'REGISTRATION' THEN
   RETURN jsonb_build_object('success',false,'error','Turnuva kayıtları kapandı'); END IF;
 SELECT count(*) INTO v_count FROM public.tournament_players WHERE tournament_code = v_code;
 IF v_count >= t.size THEN RETURN jsonb_build_object('success',false,'error','Turnuva dolu'); END IF;
 v_error := public._validate_player_identity(p_name, p_avatar);
 IF v_error IS NOT NULL THEN RETURN jsonb_build_object('success',false,'error',v_error); END IF;

 INSERT INTO public.tournament_players(tournament_code, auth_user_id, name, avatar)
 VALUES (v_code, v_uid, trim(p_name), p_avatar);
 RETURN jsonb_build_object('success',true,'code',v_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_tournament_rpc(p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid UUID := auth.uid(); v_code TEXT := trim(coalesce(p_code, '')); v_status TEXT;
BEGIN
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Oturum açılmadı'); END IF;
 SELECT status INTO v_status FROM public.tournaments WHERE code = v_code FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Turnuva bulunamadı'); END IF;
 IF NOT EXISTS (SELECT 1 FROM public.tournament_players WHERE tournament_code = v_code AND auth_user_id = v_uid) THEN
   RETURN jsonb_build_object('success',true);
 END IF;
 IF v_status <> 'REGISTRATION' THEN
   RETURN jsonb_build_object('success',false,'error','Turnuva başladı, ayrılamazsın'); END IF;
 DELETE FROM public.tournament_players WHERE tournament_code = v_code AND auth_user_id = v_uid;
 RETURN jsonb_build_object('success',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.start_tournament_rpc(p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID := auth.uid(); v_code TEXT := trim(coalesce(p_code, ''));
 t RECORD; v_players UUID[]; v_slot INTEGER;
BEGIN
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Oturum açılmadı'); END IF;
 SELECT status, size, organizer INTO t FROM public.tournaments WHERE code = v_code FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Turnuva bulunamadı'); END IF;
 IF t.organizer <> v_uid THEN
   RETURN jsonb_build_object('success',false,'error','Turnuvayı yalnızca düzenleyen başlatabilir'); END IF;
 IF t.status <> 'REGISTRATION' THEN
   RETURN jsonb_build_object('success',false,'error','Turnuva zaten başladı'); END IF;

 v_players := ARRAY(SELECT auth_user_id FROM public.tournament_players
                    WHERE tournament_code = v_code ORDER BY random());
 IF coalesce(array_length(v_players, 1), 0) <> t.size THEN
   RETURN jsonb_build_object('success',false,'error','Turnuva henüz dolmadı'); END IF;

 BEGIN
   FOR v_slot IN 0 .. (t.size / 2) - 1 LOOP
     INSERT INTO public.tournament_matches(tournament_code, round, slot, player_a, player_b)
     VALUES (v_code, 1, v_slot, v_players[2 * v_slot + 1], v_players[2 * v_slot + 2]);
     PERFORM public._create_tournament_match_room(v_code, 1, v_slot);
   END LOOP;
 EXCEPTION WHEN raise_exception THEN
   RETURN jsonb_build_object('success',false,'error','Turnuva odaları kurulamadı, tekrar deneyin');
 END;

 UPDATE public.tournaments SET status = 'RUNNING' WHERE code = v_code;
 RETURN jsonb_build_object('success',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tournament_rpc(p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID := auth.uid(); v_code TEXT := trim(coalesce(p_code, ''));
 t RECORD; v_champion JSONB; v_players JSONB; v_matches JSONB; v_my_room TEXT;
BEGIN
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Oturum açılmadı'); END IF;
 SELECT * INTO t FROM public.tournaments WHERE code = v_code;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Turnuva bulunamadı'); END IF;

 SELECT jsonb_build_object('name', p.name, 'avatar', p.avatar) INTO v_champion
 FROM public.tournament_players p
 WHERE p.tournament_code = v_code AND p.auth_user_id = t.champion;

 SELECT coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'avatar', p.avatar,
     'is_me', p.auth_user_id = v_uid, 'eliminated', p.eliminated)
   ORDER BY p.joined_at, p.auth_user_id), '[]'::jsonb)
 INTO v_players
 FROM public.tournament_players p WHERE p.tournament_code = v_code;

 SELECT coalesce(jsonb_agg(jsonb_build_object(
     'round', m.round, 'slot', m.slot, 'room_code', m.room_code, 'room_status', r.status,
     'player_a', CASE WHEN m.player_a IS NULL THEN NULL ELSE jsonb_build_object(
        'name', pa.name, 'avatar', pa.avatar, 'is_me', m.player_a = v_uid) END,
     'player_b', CASE WHEN m.player_b IS NULL THEN NULL ELSE jsonb_build_object(
        'name', pb.name, 'avatar', pb.avatar, 'is_me', m.player_b = v_uid) END,
     'winner_side', CASE WHEN m.winner IS NULL THEN NULL
                         WHEN m.winner = m.player_a THEN 'a'
                         WHEN m.winner = m.player_b THEN 'b' END)
   ORDER BY m.round, m.slot), '[]'::jsonb)
 INTO v_matches
 FROM public.tournament_matches m
 LEFT JOIN public.rooms r ON r.code = m.room_code
 LEFT JOIN public.tournament_players pa ON pa.tournament_code = m.tournament_code AND pa.auth_user_id = m.player_a
 LEFT JOIN public.tournament_players pb ON pb.tournament_code = m.tournament_code AND pb.auth_user_id = m.player_b
 WHERE m.tournament_code = v_code;

 SELECT m.room_code INTO v_my_room FROM public.tournament_matches m
 WHERE m.tournament_code = v_code AND m.winner IS NULL AND m.room_code IS NOT NULL
   AND v_uid IN (m.player_a, m.player_b)
 ORDER BY m.round DESC LIMIT 1;

 RETURN jsonb_build_object('success', true,
   'tournament', jsonb_build_object('code', t.code, 'name', t.name, 'size', t.size, 'status', t.status,
     'rounds', public._tournament_rounds(t.size), 'is_organizer', t.organizer = v_uid,
     'am_registered', EXISTS (SELECT 1 FROM public.tournament_players
                              WHERE tournament_code = v_code AND auth_user_id = v_uid),
     'champion', v_champion),
   'players', v_players, 'matches', v_matches, 'my_room_code', v_my_room);
END;
$$;

-- ---------------------------------------------------------------------------
-- Room RPCs redefined for tournament rooms (other behaviour as in 000011)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restart_room_rpc(p_room_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID := auth.uid(); v_code TEXT := upper(trim(p_room_code));
 v_questions JSONB; v_new_match INTEGER; v_tournament TEXT;
BEGIN
 IF v_uid IS NULL OR NOT public.is_quiz_room_member(v_code) THEN
   RETURN jsonb_build_object('success', false, 'error', 'Bu odanın oyuncusu değilsin'); END IF;
 SELECT tournament_code INTO v_tournament FROM public.rooms WHERE code = v_code FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Oda bulunamadı'); END IF;
 IF v_tournament IS NOT NULL THEN
   RETURN jsonb_build_object('success', false, 'error', 'Turnuva maçında rövanş yapılamaz'); END IF;

 v_questions := public._pick_room_questions(v_code);
 IF v_questions IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Yeterli soru bulunamadı'); END IF;

 UPDATE public.rooms SET status = 'LOBBY', started_at = NULL, match_questions = v_questions, match_no = match_no + 1
 WHERE code = v_code RETURNING match_no INTO v_new_match;
 UPDATE public.room_players SET is_ready = false, score = 0, correct_answers = 0,
   current_question_index = 0, question_started_at = NULL, finished_at = NULL, wants_rematch = false,
   last_seen_at = clock_timestamp(), updated_at = clock_timestamp()
 WHERE room_code = v_code;
 RETURN jsonb_build_object('success', true, 'status', 'LOBBY', 'match_no', v_new_match);
END;
$$;

CREATE OR REPLACE FUNCTION public.request_rematch_rpc(p_room_code TEXT, p_want BOOLEAN DEFAULT true)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID := auth.uid(); v_code TEXT := upper(trim(p_room_code));
 v_want BOOLEAN := coalesce(p_want, true);
 v_status TEXT; v_tournament TEXT; v_count INTEGER; v_wanting INTEGER; v_questions JSONB;
 v_start TIMESTAMPTZ; v_new_match INTEGER;
BEGIN
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Oturum açılmadı'); END IF;
 SELECT status, tournament_code INTO v_status, v_tournament FROM public.rooms WHERE code = v_code FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Oda bulunamadı'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.room_players WHERE room_code = v_code AND auth_user_id = v_uid) THEN
   RETURN jsonb_build_object('success', false, 'error', 'Bu odanın oyuncusu değilsin'); END IF;
 IF v_tournament IS NOT NULL THEN
   RETURN jsonb_build_object('success', false, 'error', 'Turnuva maçında rövanş yapılamaz'); END IF;
 IF v_status <> 'RESULT' THEN
   RETURN jsonb_build_object('success', false, 'error', 'Maç henüz bitmedi'); END IF;

 SELECT count(*) INTO v_count FROM public.room_players WHERE room_code = v_code;
 IF v_count < 2 THEN
   UPDATE public.room_players SET wants_rematch = false WHERE room_code = v_code AND wants_rematch;
   RETURN jsonb_build_object('success', false, 'error', 'Rakip odadan ayrıldı');
 END IF;

 UPDATE public.room_players SET wants_rematch = v_want, last_seen_at = clock_timestamp(),
   updated_at = clock_timestamp()
 WHERE room_code = v_code AND auth_user_id = v_uid;

 SELECT count(*) FILTER (WHERE wants_rematch) INTO v_wanting
 FROM public.room_players WHERE room_code = v_code;
 IF v_count <> 2 OR v_wanting <> 2 THEN
   RETURN jsonb_build_object('success', true, 'started', false, 'waiting_for_opponent', v_want);
 END IF;

 v_questions := public._pick_room_questions(v_code);
 IF v_questions IS NULL THEN
   RETURN jsonb_build_object('success', false, 'error', 'Yeterli soru bulunamadı'); END IF;

 v_start := clock_timestamp()
   + make_interval(secs => (public.quiz_settings()->>'countdown_seconds')::INTEGER);
 UPDATE public.rooms SET status = 'VS', started_at = v_start, match_questions = v_questions,
   match_no = match_no + 1
 WHERE code = v_code RETURNING match_no INTO v_new_match;
 UPDATE public.room_players SET score = 0, correct_answers = 0, current_question_index = 0,
   finished_at = NULL, wants_rematch = false, is_ready = true, question_started_at = v_start,
   last_seen_at = clock_timestamp(), updated_at = clock_timestamp()
 WHERE room_code = v_code;

 RETURN jsonb_build_object('success', true, 'started', true, 'waiting_for_opponent', false,
   'match_no', v_new_match, 'started_at', v_start);
END;
$$;

-- Same as 000011, plus tournament rooms: leaving in LOBBY is a forfeit too (the room moves to
-- RESULT and the trigger awards the match to the remaining player). If a tournament room becomes
-- empty while its match is undecided, player_a is awarded the match before the room is deleted.
CREATE OR REPLACE FUNCTION public.leave_room_rpc(p_room_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID := auth.uid(); v_code TEXT := upper(trim(p_room_code));
 v_status TEXT; v_tournament TEXT; v_remaining INTEGER; v_player_a UUID;
BEGIN
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Oturum açılmadı'); END IF;

 SELECT status, tournament_code INTO v_status, v_tournament FROM public.rooms WHERE code = v_code FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success', true, 'deleted', true); END IF;

 IF NOT EXISTS(SELECT 1 FROM public.room_players WHERE room_code = v_code AND auth_user_id = v_uid) THEN
   RETURN jsonb_build_object('success', true, 'deleted', false);
 END IF;

 DELETE FROM public.room_players WHERE room_code = v_code AND auth_user_id = v_uid;
 SELECT count(*) INTO v_remaining FROM public.room_players WHERE room_code = v_code;

 IF v_remaining = 0 THEN
   IF v_tournament IS NOT NULL THEN
     SELECT player_a INTO v_player_a FROM public.tournament_matches
     WHERE tournament_code = v_tournament AND room_code = v_code AND winner IS NULL;
     IF FOUND THEN PERFORM public._advance_tournament(v_code, v_player_a); END IF;
   END IF;
   DELETE FROM public.rooms WHERE code = v_code;
   RETURN jsonb_build_object('success', true, 'deleted', true);
 END IF;

 UPDATE public.room_players SET wants_rematch = false, updated_at = clock_timestamp()
 WHERE room_code = v_code AND wants_rematch;

 IF v_status IN ('VS', 'QUIZ') OR (v_tournament IS NOT NULL AND v_status = 'LOBBY') THEN
   -- Forfeit: the opponent is already ahead by definition (the leaver stops scoring).
   UPDATE public.rooms SET status = 'RESULT' WHERE code = v_code;
 ELSIF v_status = 'LOBBY' THEN
   -- Sole remaining player becomes host and must ready up again with a future opponent.
   UPDATE public.room_players SET is_ready = false, is_host = true, updated_at = clock_timestamp()
   WHERE room_code = v_code;
 END IF;

 RETURN jsonb_build_object('success', true, 'deleted', false, 'remaining_status', v_status);
END;
$$;

-- Same as 000008, but rooms of RUNNING tournaments are kept; also drops long-abandoned queue rows.
CREATE OR REPLACE FUNCTION public.cleanup_stale_rooms_rpc()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count INTEGER;
BEGIN
 DELETE FROM public.rooms r
 WHERE ((r.status = 'LOBBY' AND r.created_at < now() - interval '6 hours')
     OR (r.status IN ('VS', 'QUIZ') AND coalesce(r.started_at, r.created_at) < now() - interval '6 hours')
     OR (r.status = 'RESULT' AND r.created_at < now() - interval '24 hours'))
   AND NOT (r.tournament_code IS NOT NULL AND EXISTS (
     SELECT 1 FROM public.tournaments t WHERE t.code = r.tournament_code AND t.status = 'RUNNING'));
 GET DIAGNOSTICS v_count = ROW_COUNT;
 DELETE FROM public.matchmaking_queue WHERE created_at < now() - interval '1 hour';
 RETURN jsonb_build_object('success', true, 'deleted_count', v_count);
END;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public._create_room_for(UUID,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._tournament_rounds(INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._create_tournament_match_room(TEXT,INT,INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._advance_tournament(TEXT,UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._on_room_result() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_room_rpc(TEXT,TEXT,TEXT,JSONB,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quick_match_rpc(TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_quick_match_rpc() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_tournament_rpc(TEXT,INT,TEXT,TEXT,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_tournament_rpc(TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_tournament_rpc(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_tournament_rpc(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tournament_rpc(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restart_room_rpc(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_rematch_rpc(TEXT,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_room_rpc(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_rooms_rpc() TO authenticated;
REVOKE ALL ON FUNCTION public.create_room_rpc(TEXT,TEXT,TEXT,JSONB,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.quick_match_rpc(TEXT,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_quick_match_rpc() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_tournament_rpc(TEXT,INT,TEXT,TEXT,BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_tournament_rpc(TEXT,TEXT,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_tournament_rpc(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_tournament_rpc(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_tournament_rpc(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restart_room_rpc(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_rematch_rpc(TEXT,BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_room_rpc(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cleanup_stale_rooms_rpc() FROM PUBLIC, anon;

COMMIT;
