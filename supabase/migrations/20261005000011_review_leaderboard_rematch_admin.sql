-- TEKNOFEST Bilgi Yarismasi - match review, leaderboard, rematch consent, admin tools, validation
-- 2026-10-05. Apply manually after 20261005000010_restart_avoid_repeat_questions.sql.
-- Adds:
--  * quiz_settings(): single source of truth for match length / question count / countdown.
--    get_server_time_rpc now also returns it so the client never hardcodes the timings.
--  * _validate_player_identity(): name (1-16 chars) and avatar whitelist for create/join.
--  * create_room_rpc: server-generated room code when p_code is NULL/empty.
--  * questions.is_active + _pick_room_questions(): shared question picker (no repeats, active only).
--  * get_match_review_rpc: post-match review with correct answers and both players' picks.
--  * leaderboard_entries + _on_room_result trigger + get_leaderboard_rpc (public, anon allowed).
--  * room_players.wants_rematch + request_rematch_rpc: rematch starts only when both agree.
--  * quiz_admins + is_quiz_admin() + admin_* RPCs for managing the question bank.
-- The legacy room_players.streak column is no longer written to (kept for compatibility).
BEGIN;

-- ---------------------------------------------------------------------------
-- Schema changes
-- ---------------------------------------------------------------------------
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.room_players ADD COLUMN IF NOT EXISTS wants_rematch BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.leaderboard_entries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_code TEXT NOT NULL,
  match_no INTEGER NOT NULL,
  auth_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  won BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_leaderboard_entry UNIQUE (room_code, match_no, auth_user_id)
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_created_at ON public.leaderboard_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON public.leaderboard_entries(score DESC, created_at);

CREATE TABLE IF NOT EXISTS public.quiz_admins (
  user_id UUID PRIMARY KEY
);
-- Owner adds admins from the SQL Editor:
--   INSERT INTO public.quiz_admins(user_id) VALUES ('<auth user uuid>');

ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.leaderboard_entries, public.quiz_admins FROM PUBLIC, anon, authenticated;
-- No policies: browsers never touch these tables directly, only through the RPCs below.

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quiz_settings()
RETURNS JSONB LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT jsonb_build_object('match_seconds', 90, 'question_count', 10, 'countdown_seconds', 3);
$$;

CREATE OR REPLACE FUNCTION public.get_server_time_rpc()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT jsonb_build_object('success', true, 'server_time', clock_timestamp(),
   'settings', public.quiz_settings());
$$;

-- ---------------------------------------------------------------------------
-- Internal helpers (not callable by clients)
-- ---------------------------------------------------------------------------

-- Returns an error message, or NULL when the identity is valid.
CREATE OR REPLACE FUNCTION public._validate_player_identity(p_name TEXT, p_avatar TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT CASE
   WHEN p_name IS NULL OR char_length(trim(p_name)) NOT BETWEEN 1 AND 16
     THEN 'İsim 1-16 karakter olmalı'
   WHEN p_avatar IS NULL OR p_avatar NOT IN ('🚀','⚡','🤖','🛡️','👨‍🚀','⚙️')
     THEN 'Geçersiz avatar'
   ELSE NULL
 END;
$$;

-- Picks 4 easy + 4 medium + 2 hard active questions, shuffled. Questions already used in this
-- room (answered in any earlier match, or part of the room's current question set) are avoided
-- per difficulty while enough unseen ones remain; otherwise that difficulty falls back to the
-- whole active pool. Returns NULL if the active pool cannot supply a full set.
CREATE OR REPLACE FUNCTION public._pick_room_questions(p_room_code TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_code TEXT := upper(trim(coalesce(p_room_code, '')));
 v_seen BIGINT[]; v_questions JSONB := '[]'::jsonb; v_count INTEGER := 0; q RECORD;
 v_unseen_kolay INTEGER; v_unseen_orta INTEGER; v_unseen_zor INTEGER;
BEGIN
 v_seen := ARRAY(
   SELECT a.question_id FROM public.room_player_answers a WHERE a.room_code = v_code
   UNION
   SELECT (e.value->>'id')::BIGINT
   FROM public.rooms r,
        jsonb_array_elements(CASE WHEN jsonb_typeof(r.match_questions) = 'array'
                                  THEN r.match_questions ELSE '[]'::jsonb END) AS e(value)
   WHERE r.code = v_code AND (e.value->>'id') ~ '^[0-9]+$'
 );

 SELECT count(*) FILTER (WHERE difficulty = 'kolay'),
        count(*) FILTER (WHERE difficulty = 'orta'),
        count(*) FILTER (WHERE difficulty = 'zor')
 INTO v_unseen_kolay, v_unseen_orta, v_unseen_zor
 FROM public.questions WHERE is_active AND NOT (id = ANY (v_seen));

 FOR q IN SELECT * FROM (
   (SELECT id, category, difficulty, question, options FROM public.questions
     WHERE is_active AND difficulty = 'kolay' AND (v_unseen_kolay < 4 OR NOT (id = ANY (v_seen)))
     ORDER BY random() LIMIT 4)
   UNION ALL
   (SELECT id, category, difficulty, question, options FROM public.questions
     WHERE is_active AND difficulty = 'orta' AND (v_unseen_orta < 4 OR NOT (id = ANY (v_seen)))
     ORDER BY random() LIMIT 4)
   UNION ALL
   (SELECT id, category, difficulty, question, options FROM public.questions
     WHERE is_active AND difficulty = 'zor' AND (v_unseen_zor < 2 OR NOT (id = ANY (v_seen)))
     ORDER BY random() LIMIT 2)
 ) s ORDER BY random() LOOP
   v_questions := v_questions || jsonb_build_array(jsonb_build_object('id', q.id, 'category', q.category,
     'difficulty', q.difficulty, 'question', q.question, 'options', q.options));
   v_count := v_count + 1;
 END LOOP;

 IF v_count <> (public.quiz_settings()->>'question_count')::INTEGER THEN RETURN NULL; END IF;
 RETURN v_questions;
END;
$$;

-- ---------------------------------------------------------------------------
-- Room creation / joining (with identity validation and server-generated codes)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_room_rpc(
 p_code TEXT, p_name TEXT, p_avatar TEXT, p_match_questions JSONB, p_player_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID := auth.uid(); v_code TEXT := nullif(trim(coalesce(p_code, '')), '');
 v_error TEXT; v_questions JSONB; v_try TEXT; v_attempt INTEGER;
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
 ELSE
   FOR v_attempt IN 1..20 LOOP
     v_try := (100000 + floor(random() * 900000))::INTEGER::TEXT;
     BEGIN
       INSERT INTO public.rooms(code,status,match_questions) VALUES(v_try,'LOBBY',v_questions);
       v_code := v_try;
       EXIT;
     EXCEPTION WHEN unique_violation THEN
       NULL; -- collision: try another code
     END;
   END LOOP;
   IF v_code IS NULL THEN
     RETURN jsonb_build_object('success',false,'error','Oda kodu üretilemedi, tekrar deneyin'); END IF;
 END IF;

 INSERT INTO public.room_players(room_code,player_id,auth_user_id,name,avatar,is_host)
 VALUES(v_code,v_uid::text,v_uid,trim(p_name),p_avatar,true);
 RETURN jsonb_build_object('success',true,'code',v_code,'player_id',v_uid::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_room_atomic(
 p_room_code TEXT, p_player_id TEXT, p_name TEXT, p_avatar TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID := auth.uid(); v_code TEXT := upper(trim(p_room_code));
 v_status TEXT; v_count INTEGER; v_error TEXT;
BEGIN
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Oturum açılmadı'); END IF;
 SELECT status INTO v_status FROM public.rooms WHERE code=v_code FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Oda bulunamadı'); END IF;
 -- Re-joining an existing seat is idempotent (e.g. after a page refresh).
 IF EXISTS(SELECT 1 FROM public.room_players WHERE room_code=v_code AND auth_user_id=v_uid) THEN
   RETURN jsonb_build_object('success',true,'code',v_code,'player_id',v_uid::text);
 END IF;
 IF v_status<>'LOBBY' THEN RETURN jsonb_build_object('success',false,'error','Maç başlamış'); END IF;
 SELECT count(*) INTO v_count FROM public.room_players WHERE room_code=v_code;
 IF v_count>=2 THEN RETURN jsonb_build_object('success',false,'error','Oda dolu'); END IF;
 v_error := public._validate_player_identity(p_name, p_avatar);
 IF v_error IS NOT NULL THEN RETURN jsonb_build_object('success',false,'error',v_error); END IF;
 INSERT INTO public.room_players(room_code,player_id,auth_user_id,name,avatar,is_host)
 VALUES(v_code,v_uid::text,v_uid,trim(p_name),p_avatar,false);
 RETURN jsonb_build_object('success',true,'code',v_code,'player_id',v_uid::text);
END;
$$;

-- ---------------------------------------------------------------------------
-- Match flow (timings from quiz_settings, no more streak writes)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_player_ready_and_check_start(
 p_room_code TEXT, p_player_id TEXT, p_ready_state BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID := auth.uid(); v_code TEXT := upper(trim(p_room_code));
 v_status TEXT; v_count INTEGER; v_ready INTEGER; v_started BOOLEAN := false;
 v_start TIMESTAMPTZ;
BEGIN
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Oturum açılmadı'); END IF;
 SELECT status INTO v_status FROM public.rooms WHERE code=v_code FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Oda bulunamadı'); END IF;
 IF NOT EXISTS (SELECT 1 FROM public.room_players WHERE room_code=v_code AND auth_user_id=v_uid) THEN
   RETURN jsonb_build_object('success',false,'error','Bu odanın oyuncusu değilsin'); END IF;
 IF v_status<>'LOBBY' THEN
   RETURN jsonb_build_object('success',true,'status',v_status,'match_started',false); END IF;

 UPDATE public.room_players SET is_ready=p_ready_state,last_seen_at=clock_timestamp(),updated_at=clock_timestamp()
 WHERE room_code=v_code AND auth_user_id=v_uid;
 SELECT count(*),count(*) FILTER (WHERE is_ready) INTO v_count,v_ready
 FROM public.room_players WHERE room_code=v_code;

 IF v_count=2 AND v_ready=2 THEN
   v_start := clock_timestamp()
     + make_interval(secs => (public.quiz_settings()->>'countdown_seconds')::INTEGER);
   UPDATE public.rooms SET status='VS',started_at=v_start WHERE code=v_code AND status='LOBBY';
   IF FOUND THEN
     UPDATE public.room_players SET current_question_index=0,question_started_at=v_start,
       finished_at=NULL,score=0,correct_answers=0,wants_rematch=false,
       last_seen_at=clock_timestamp(),updated_at=clock_timestamp()
     WHERE room_code=v_code;
     v_started:=true; v_status:='VS';
   END IF;
 END IF;
 RETURN jsonb_build_object('success',true,'total_players',v_count,'ready_count',v_ready,
   'status',v_status,'match_started',v_started,'started_at',v_start,'server_time',clock_timestamp());
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_answer_rpc(
 p_room_code TEXT, p_player_id TEXT, p_question_id BIGINT, p_selected_option_index INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID := auth.uid(); v_code TEXT := upper(trim(p_room_code));
 v_status TEXT; v_start TIMESTAMPTZ; v_questions JSONB; v_match_no INTEGER;
 v_index INTEGER; v_question_start TIMESTAMPTZ; v_expected_id BIGINT;
 v_correct INTEGER; v_elapsed DOUBLE PRECISION; v_bonus INTEGER; v_points INTEGER;
 v_is_correct BOOLEAN; v_score INTEGER; v_answer RECORD; v_both_finished BOOLEAN;
 v_match_len INTERVAL := make_interval(secs => (public.quiz_settings()->>'match_seconds')::INTEGER);
BEGIN
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Oturum yok'); END IF;
 IF p_selected_option_index NOT BETWEEN 0 AND 3 THEN
   RETURN jsonb_build_object('success',false,'error','Geçersiz şık'); END IF;

 SELECT status,started_at,match_questions,match_no INTO v_status,v_start,v_questions,v_match_no
 FROM public.rooms WHERE code=v_code FOR UPDATE;
 IF NOT FOUND OR v_status NOT IN ('VS','QUIZ') OR v_start IS NULL THEN
   RETURN jsonb_build_object('success',false,'error','Aktif müsabaka bulunamadı'); END IF;
 IF clock_timestamp()<v_start THEN RETURN jsonb_build_object('success',false,'error','Maç henüz başlamadı'); END IF;
 IF clock_timestamp()>=v_start+v_match_len THEN
   UPDATE public.rooms SET status='RESULT' WHERE code=v_code AND status IN ('VS','QUIZ');
   RETURN jsonb_build_object('success',false,'error','Maç süresi bitti');
 END IF;

 SELECT current_question_index,question_started_at INTO v_index,v_question_start
 FROM public.room_players WHERE room_code=v_code AND auth_user_id=v_uid FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Bu odanın oyuncusu değilsin'); END IF;

 -- A lost response may be retried safely, but never awards points twice.
 SELECT is_correct,points_awarded INTO v_answer FROM public.room_player_answers
 WHERE room_code=v_code AND match_no=v_match_no AND player_id=v_uid::text AND question_id=p_question_id;
 IF FOUND THEN
   SELECT score INTO v_score FROM public.room_players WHERE room_code=v_code AND auth_user_id=v_uid;
   SELECT correct_index INTO v_correct FROM public.questions WHERE id=p_question_id;
   RETURN jsonb_build_object('success',true,'already_answered',true,'is_correct',v_answer.is_correct,
     'correct_index',v_correct,'points_added',0,'new_score',coalesce(v_score,0),'next_question_index',v_index);
 END IF;

 IF v_index<0 OR v_index>=jsonb_array_length(v_questions) THEN
   RETURN jsonb_build_object('success',false,'error','Tüm sorular zaten tamamlandı'); END IF;
 v_expected_id := (v_questions->v_index->>'id')::BIGINT;
 IF v_expected_id IS DISTINCT FROM p_question_id THEN
   RETURN jsonb_build_object('success',false,'error','Bu soru şu anda bu oyuncu için aktif değil'); END IF;

 SELECT correct_index INTO v_correct FROM public.questions WHERE id=p_question_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Soru veritabanında bulunamadı'); END IF;
 v_is_correct := (v_correct=p_selected_option_index);
 -- Server-measured per-question bonus. The 1.2s feedback period is excluded from the next question.
 v_elapsed := greatest(0,extract(epoch FROM (clock_timestamp()-greatest(coalesce(v_question_start,v_start),v_start))));
 v_bonus := greatest(0,least(50,floor((10-least(v_elapsed,10))*5)::INTEGER));
 v_points := CASE WHEN v_is_correct THEN 100+v_bonus ELSE 0 END;

 INSERT INTO public.room_player_answers(room_code,match_no,player_id,question_id,
   selected_option_index,is_correct,points_awarded)
 VALUES(v_code,v_match_no,v_uid::text,p_question_id,p_selected_option_index,v_is_correct,v_points);

 UPDATE public.room_players SET score=score+v_points,
   correct_answers=correct_answers+(CASE WHEN v_is_correct THEN 1 ELSE 0 END),
   current_question_index=v_index+1,
   question_started_at=CASE WHEN v_index+1>=jsonb_array_length(v_questions) THEN NULL
                            ELSE clock_timestamp()+interval '1.2 seconds' END,
   finished_at=CASE WHEN v_index+1>=jsonb_array_length(v_questions) THEN clock_timestamp() ELSE NULL END,
   last_seen_at=clock_timestamp(),
   updated_at=clock_timestamp()
 WHERE room_code=v_code AND auth_user_id=v_uid RETURNING score INTO v_score;

 SELECT count(*)=2 AND bool_and(finished_at IS NOT NULL) INTO v_both_finished
 FROM public.room_players WHERE room_code=v_code;
 RETURN jsonb_build_object('success',true,'already_answered',false,'is_correct',v_is_correct,
   'correct_index',v_correct,'points_added',v_points,'new_score',v_score,
   'next_question_index',v_index+1,'match_finished',v_both_finished);
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_room_rpc(p_room_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_code TEXT := upper(trim(p_room_code));
 v_status TEXT; v_start TIMESTAMPTZ; v_finished BOOLEAN; v_timed_out BOOLEAN;
BEGIN
 IF NOT public.is_quiz_room_member(v_code) THEN
   RETURN jsonb_build_object('success',false,'error','Bu odanın oyuncusu değilsin');
 END IF;

 -- The room row serializes simultaneous finish requests from both clients.
 SELECT status,started_at INTO v_status,v_start
 FROM public.rooms WHERE code=v_code FOR UPDATE;
 IF NOT FOUND THEN
   RETURN jsonb_build_object('success',false,'error','Oda bulunamadı');
 END IF;
 IF v_status='RESULT' THEN
   RETURN jsonb_build_object('success',true,'status','RESULT','already_finished',true);
 END IF;
 IF v_status NOT IN ('VS','QUIZ') OR v_start IS NULL THEN
   RETURN jsonb_build_object('success',false,'error','Aktif müsabaka bulunamadı');
 END IF;

 SELECT count(*)=2 AND bool_and(finished_at IS NOT NULL) INTO v_finished
 FROM public.room_players WHERE room_code=v_code;
 v_timed_out := clock_timestamp() >= v_start
   + make_interval(secs => (public.quiz_settings()->>'match_seconds')::INTEGER);

 IF NOT coalesce(v_finished,false) AND NOT v_timed_out THEN
   RETURN jsonb_build_object('success',false,'error','Maç henüz tamamlanmadı');
 END IF;

 UPDATE public.rooms SET status='RESULT'
 WHERE code=v_code AND status IN ('VS','QUIZ');
 RETURN jsonb_build_object('success',true,'status','RESULT','already_finished',false,
   'both_finished',coalesce(v_finished,false),'timed_out',v_timed_out);
END;
$$;

CREATE OR REPLACE FUNCTION public.restart_room_rpc(p_room_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID := auth.uid(); v_code TEXT := upper(trim(p_room_code));
 v_questions JSONB; v_new_match INTEGER;
BEGIN
 IF v_uid IS NULL OR NOT public.is_quiz_room_member(v_code) THEN
   RETURN jsonb_build_object('success', false, 'error', 'Bu odanın oyuncusu değilsin'); END IF;
 PERFORM 1 FROM public.rooms WHERE code = v_code FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Oda bulunamadı'); END IF;

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

-- Same as 000008, plus: the remaining player's rematch request is cleared when the opponent leaves.
CREATE OR REPLACE FUNCTION public.leave_room_rpc(p_room_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID := auth.uid(); v_code TEXT := upper(trim(p_room_code));
 v_status TEXT; v_remaining INTEGER;
BEGIN
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Oturum açılmadı'); END IF;

 SELECT status INTO v_status FROM public.rooms WHERE code = v_code FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success', true, 'deleted', true); END IF;

 IF NOT EXISTS(SELECT 1 FROM public.room_players WHERE room_code = v_code AND auth_user_id = v_uid) THEN
   RETURN jsonb_build_object('success', true, 'deleted', false);
 END IF;

 DELETE FROM public.room_players WHERE room_code = v_code AND auth_user_id = v_uid;
 SELECT count(*) INTO v_remaining FROM public.room_players WHERE room_code = v_code;

 IF v_remaining = 0 THEN
   DELETE FROM public.rooms WHERE code = v_code;
   RETURN jsonb_build_object('success', true, 'deleted', true);
 END IF;

 UPDATE public.room_players SET wants_rematch = false, updated_at = clock_timestamp()
 WHERE room_code = v_code AND wants_rematch;

 IF v_status IN ('VS', 'QUIZ') THEN
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

-- ---------------------------------------------------------------------------
-- Match review
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_match_review_rpc(p_room_code TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID := auth.uid(); v_code TEXT := upper(trim(p_room_code));
 v_status TEXT; v_match_no INTEGER; v_questions JSONB; v_result JSONB;
BEGIN
 IF v_uid IS NULL OR NOT public.is_quiz_room_member(v_code) THEN
   RETURN jsonb_build_object('success', false, 'error', 'Bu odanın oyuncusu değilsin'); END IF;
 SELECT status, match_no, match_questions INTO v_status, v_match_no, v_questions
 FROM public.rooms WHERE code = v_code;
 IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Oda bulunamadı'); END IF;
 IF v_status <> 'RESULT' THEN
   RETURN jsonb_build_object('success', false, 'error', 'Maç henüz bitmedi'); END IF;

 SELECT coalesce(jsonb_agg(jsonb_build_object(
     'id', q.id,
     'category', q.category,
     'difficulty', q.difficulty,
     'question', q.question,
     'options', q.options,
     'correct_index', q.correct_index,
     'explanation', q.explanation,
     'my_answer', (
       SELECT jsonb_build_object('selected_option_index', a.selected_option_index,
         'is_correct', a.is_correct, 'points_awarded', a.points_awarded)
       FROM public.room_player_answers a
       WHERE a.room_code = v_code AND a.match_no = v_match_no
         AND a.question_id = q.id AND a.player_id = v_uid::text
       LIMIT 1),
     'opponent_answer', (
       SELECT jsonb_build_object('selected_option_index', a.selected_option_index,
         'is_correct', a.is_correct, 'points_awarded', a.points_awarded)
       FROM public.room_player_answers a
       WHERE a.room_code = v_code AND a.match_no = v_match_no
         AND a.question_id = q.id AND a.player_id <> v_uid::text
       ORDER BY a.answered_at
       LIMIT 1)
   ) ORDER BY e.ordinality), '[]'::jsonb)
 INTO v_result
 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_questions) = 'array'
                                THEN v_questions ELSE '[]'::jsonb END)
      WITH ORDINALITY AS e(value, ordinality)
 JOIN public.questions q ON (e.value->>'id') ~ '^[0-9]+$' AND q.id = (e.value->>'id')::BIGINT;

 RETURN jsonb_build_object('success', true, 'match_no', v_match_no, 'questions', v_result);
END;
$$;

-- ---------------------------------------------------------------------------
-- Room RESULT trigger: leaderboard (and later: tournament progression)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._on_room_result()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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

 -- 2) (reserved) Tournament progression hooks go here.

 RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_room_result ON public.rooms;
CREATE TRIGGER trg_room_result
 AFTER UPDATE OF status ON public.rooms
 FOR EACH ROW
 WHEN (OLD.status IS DISTINCT FROM 'RESULT' AND NEW.status = 'RESULT')
 EXECUTE FUNCTION public._on_room_result();

CREATE OR REPLACE FUNCTION public.get_leaderboard_rpc(p_period TEXT DEFAULT 'today', p_limit INTEGER DEFAULT 10)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_period TEXT := lower(trim(coalesce(p_period, 'today')));
 v_limit INTEGER := greatest(1, least(50, coalesce(p_limit, 10)));
 v_since TIMESTAMPTZ; v_entries JSONB;
BEGIN
 IF v_period NOT IN ('today', 'all') THEN
   RETURN jsonb_build_object('success', false, 'error', 'Geçersiz dönem (today veya all)'); END IF;
 IF v_period = 'today' THEN
   v_since := date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul';
 END IF;

 SELECT coalesce(jsonb_agg(jsonb_build_object('rank', t.rank, 'name', t.name, 'avatar', t.avatar,
     'score', t.score, 'correct_answers', t.correct_answers, 'created_at', t.created_at)
   ORDER BY t.rank), '[]'::jsonb)
 INTO v_entries
 FROM (
   SELECT row_number() OVER (ORDER BY l.score DESC, l.created_at ASC, l.id ASC) AS rank,
     l.name, l.avatar, l.score, l.correct_answers, l.created_at
   FROM public.leaderboard_entries l
   WHERE v_since IS NULL OR l.created_at >= v_since
   ORDER BY l.score DESC, l.created_at ASC, l.id ASC
   LIMIT v_limit
 ) t;

 RETURN jsonb_build_object('success', true, 'period', v_period, 'entries', v_entries);
END;
$$;

-- ---------------------------------------------------------------------------
-- Rematch consent
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_rematch_rpc(p_room_code TEXT, p_want BOOLEAN DEFAULT true)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID := auth.uid(); v_code TEXT := upper(trim(p_room_code));
 v_want BOOLEAN := coalesce(p_want, true);
 v_status TEXT; v_count INTEGER; v_wanting INTEGER; v_questions JSONB;
 v_start TIMESTAMPTZ; v_new_match INTEGER;
BEGIN
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Oturum açılmadı'); END IF;
 SELECT status INTO v_status FROM public.rooms WHERE code = v_code FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Oda bulunamadı'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.room_players WHERE room_code = v_code AND auth_user_id = v_uid) THEN
   RETURN jsonb_build_object('success', false, 'error', 'Bu odanın oyuncusu değilsin'); END IF;
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

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_quiz_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.quiz_admins WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.admin_list_questions_rpc(
 p_search TEXT DEFAULT NULL, p_category TEXT DEFAULT NULL, p_difficulty TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_search TEXT := nullif(lower(trim(coalesce(p_search, ''))), '');
 v_category TEXT := nullif(trim(coalesce(p_category, '')), '');
 v_difficulty TEXT := nullif(trim(coalesce(p_difficulty, '')), '');
 v_result JSONB;
BEGIN
 IF NOT public.is_quiz_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz'); END IF;

 SELECT coalesce(jsonb_agg(jsonb_build_object(
     'id', q.id, 'category', q.category, 'difficulty', q.difficulty, 'question', q.question,
     'options', q.options, 'correct_index', q.correct_index, 'explanation', q.explanation,
     'is_active', q.is_active, 'times_answered', coalesce(s.answered, 0), 'correct_rate', s.rate)
   ORDER BY q.id DESC), '[]'::jsonb)
 INTO v_result
 FROM public.questions q
 LEFT JOIN (
   SELECT a.question_id, count(*) AS answered,
     round((count(*) FILTER (WHERE a.is_correct))::NUMERIC / count(*), 4) AS rate
   FROM public.room_player_answers a GROUP BY a.question_id
 ) s ON s.question_id = q.id
 WHERE (v_search IS NULL OR strpos(lower(q.question), v_search) > 0)
   AND (v_category IS NULL OR q.category = v_category)
   AND (v_difficulty IS NULL OR q.difficulty = v_difficulty);

 RETURN jsonb_build_object('success', true, 'questions', v_result);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_question_rpc(
 p_id BIGINT, p_category TEXT, p_difficulty TEXT, p_question TEXT,
 p_options JSONB, p_correct_index INTEGER, p_explanation TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_question TEXT := trim(coalesce(p_question, ''));
 v_explanation TEXT := nullif(trim(coalesce(p_explanation, '')), '');
 v_options JSONB; v_id BIGINT;
BEGIN
 IF NOT public.is_quiz_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz'); END IF;
 IF p_category IS NULL OR p_category NOT IN ('teknoloji','bilim','genel','mantık') THEN
   RETURN jsonb_build_object('success', false, 'error', 'Geçersiz kategori'); END IF;
 IF p_difficulty IS NULL OR p_difficulty NOT IN ('kolay','orta','zor') THEN
   RETURN jsonb_build_object('success', false, 'error', 'Geçersiz zorluk'); END IF;
 IF char_length(v_question) NOT BETWEEN 5 AND 300 THEN
   RETURN jsonb_build_object('success', false, 'error', 'Soru 5-300 karakter olmalı'); END IF;
 IF p_options IS NULL OR jsonb_typeof(p_options) <> 'array' OR jsonb_array_length(p_options) <> 4
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_options) e(v)
               WHERE jsonb_typeof(e.v) <> 'string' OR trim(e.v #>> '{}') = '')
    OR (SELECT count(DISTINCT trim(e.v #>> '{}')) FROM jsonb_array_elements(p_options) e(v)) <> 4 THEN
   RETURN jsonb_build_object('success', false, 'error', 'Tam 4 benzersiz, boş olmayan şık gerekli'); END IF;
 IF p_correct_index IS NULL OR p_correct_index NOT BETWEEN 0 AND 3 THEN
   RETURN jsonb_build_object('success', false, 'error', 'Doğru cevap indeksi 0-3 olmalı'); END IF;
 IF EXISTS (SELECT 1 FROM public.questions
            WHERE lower(trim(question)) = lower(v_question) AND id IS DISTINCT FROM p_id) THEN
   RETURN jsonb_build_object('success', false, 'error', 'Aynı metinli bir soru zaten var'); END IF;

 SELECT jsonb_agg(trim(e.v #>> '{}') ORDER BY e.o) INTO v_options
 FROM jsonb_array_elements(p_options) WITH ORDINALITY e(v, o);

 IF p_id IS NULL THEN
   INSERT INTO public.questions(category, difficulty, question, options, correct_index, explanation)
   VALUES (p_category, p_difficulty, v_question, v_options, p_correct_index, v_explanation)
   RETURNING id INTO v_id;
 ELSE
   UPDATE public.questions SET category = p_category, difficulty = p_difficulty, question = v_question,
     options = v_options, correct_index = p_correct_index, explanation = v_explanation
   WHERE id = p_id RETURNING id INTO v_id;
   IF v_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Soru bulunamadı'); END IF;
 END IF;
 RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_question_active_rpc(p_id BIGINT, p_active BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT public.is_quiz_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz'); END IF;
 IF p_active IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Geçersiz durum'); END IF;
 UPDATE public.questions SET is_active = p_active WHERE id = p_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Soru bulunamadı'); END IF;
 RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_stats_rpc()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_since TIMESTAMPTZ := date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul';
 v_active INTEGER; v_total INTEGER; v_rooms INTEGER; v_matches INTEGER; v_missed JSONB;
BEGIN
 IF NOT public.is_quiz_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz'); END IF;
 SELECT count(*) FILTER (WHERE is_active), count(*) INTO v_active, v_total FROM public.questions;
 SELECT count(*) INTO v_rooms FROM public.rooms WHERE created_at >= v_since;
 SELECT count(*) INTO v_matches FROM (
   SELECT DISTINCT room_code, match_no FROM public.leaderboard_entries WHERE created_at >= v_since
 ) m;

 SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'question', t.question,
     'times_answered', t.answered, 'correct_rate', t.rate) ORDER BY t.rate ASC, t.answered DESC, t.id), '[]'::jsonb)
 INTO v_missed
 FROM (
   SELECT q.id, q.question, count(*) AS answered,
     round((count(*) FILTER (WHERE a.is_correct))::NUMERIC / count(*), 4) AS rate
   FROM public.room_player_answers a JOIN public.questions q ON q.id = a.question_id
   GROUP BY q.id, q.question
   HAVING count(*) >= 3
   ORDER BY rate ASC, answered DESC, q.id
   LIMIT 10
 ) t;

 RETURN jsonb_build_object('success', true, 'active_questions', v_active, 'total_questions', v_total,
   'rooms_today', v_rooms, 'matches_today', v_matches, 'most_missed', v_missed);
END;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
-- Internal helpers: never callable by clients.
REVOKE ALL ON FUNCTION public._validate_player_identity(TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._pick_room_questions(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._on_room_result() FROM PUBLIC, anon, authenticated;

-- Signed-in (incl. anonymous Auth) users only.
GRANT EXECUTE ON FUNCTION public.quiz_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_server_time_rpc() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_room_rpc(TEXT,TEXT,TEXT,JSONB,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_room_atomic(TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_player_ready_and_check_start(TEXT,TEXT,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_answer_rpc(TEXT,TEXT,BIGINT,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_room_rpc(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restart_room_rpc(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_room_rpc(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_match_review_rpc(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_rematch_rpc(TEXT,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_quiz_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_questions_rpc(TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_question_rpc(BIGINT,TEXT,TEXT,TEXT,JSONB,INTEGER,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_question_active_rpc(BIGINT,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_stats_rpc() TO authenticated;
REVOKE ALL ON FUNCTION public.quiz_settings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_server_time_rpc() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_room_rpc(TEXT,TEXT,TEXT,JSONB,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_room_atomic(TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_player_ready_and_check_start(TEXT,TEXT,BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_answer_rpc(TEXT,TEXT,BIGINT,INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finish_room_rpc(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restart_room_rpc(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_room_rpc(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_match_review_rpc(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_rematch_rpc(TEXT,BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_quiz_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_questions_rpc(TEXT,TEXT,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_upsert_question_rpc(BIGINT,TEXT,TEXT,TEXT,JSONB,INTEGER,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_question_active_rpc(BIGINT,BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_stats_rpc() FROM PUBLIC, anon;

-- Public leaderboard: visible on the landing page before sign-in too.
REVOKE ALL ON FUNCTION public.get_leaderboard_rpc(TEXT,INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_rpc(TEXT,INTEGER) TO anon, authenticated;

COMMIT;
