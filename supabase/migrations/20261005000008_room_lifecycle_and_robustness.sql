-- TEKNOFEST Bilgi Yarismasi - room lifecycle & robustness
-- 2026-10-05. Apply manually after 20261005000007_atomic_match_finish.sql.
-- Adds: leave_room_rpc (explicit exit instead of an orphaned row forever "in" the room),
-- heartbeat_rpc + last_seen_at (lets clients detect a disconnected opponent),
-- get_server_time_rpc (lets clients correct their local clock against clock skew),
-- cleanup_stale_rooms_rpc (removes abandoned rooms instead of accumulating forever).
BEGIN;

ALTER TABLE public.room_players ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Any signed-in user may ask for the server's clock. Used purely to compute a local offset.
CREATE OR REPLACE FUNCTION public.get_server_time_rpc()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT jsonb_build_object('success', true, 'server_time', clock_timestamp());
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_rpc(p_room_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid UUID := auth.uid(); v_code TEXT := upper(trim(p_room_code));
BEGIN
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Oturum açılmadı'); END IF;
 UPDATE public.room_players SET last_seen_at = clock_timestamp()
 WHERE room_code = v_code AND auth_user_id = v_uid;
 IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Bu odanın oyuncusu değilsin'); END IF;
 RETURN jsonb_build_object('success', true, 'server_time', clock_timestamp());
END;
$$;

-- Explicit exit. Deletes the caller's row; if the room becomes empty it is deleted entirely
-- (cascades to room_players/room_player_answers). If a match was in progress, the remaining
-- player's client is unblocked by moving the room straight to RESULT instead of waiting forever.
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

-- Deletes rooms nobody is coming back to. Safe to call opportunistically from any client.
CREATE OR REPLACE FUNCTION public.cleanup_stale_rooms_rpc()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count INTEGER;
BEGIN
 DELETE FROM public.rooms
 WHERE (status = 'LOBBY' AND created_at < now() - interval '6 hours')
    OR (status IN ('VS', 'QUIZ') AND coalesce(started_at, created_at) < now() - interval '6 hours')
    OR (status = 'RESULT' AND created_at < now() - interval '24 hours');
 GET DIAGNOSTICS v_count = ROW_COUNT;
 RETURN jsonb_build_object('success', true, 'deleted_count', v_count);
END;
$$;

-- Re-assert submit_answer_rpc / set_player_ready_and_check_start so a successful call also
-- refreshes last_seen_at, without changing any scoring or timing behaviour from 000006.
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
   v_start := clock_timestamp()+interval '3 seconds';
   UPDATE public.rooms SET status='VS',started_at=v_start WHERE code=v_code AND status='LOBBY';
   IF FOUND THEN
     UPDATE public.room_players SET current_question_index=0,question_started_at=v_start,
       finished_at=NULL,score=0,correct_answers=0,streak=0,last_seen_at=clock_timestamp(),updated_at=clock_timestamp()
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
BEGIN
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Oturum yok'); END IF;
 IF p_selected_option_index NOT BETWEEN 0 AND 3 THEN
   RETURN jsonb_build_object('success',false,'error','Geçersiz şık'); END IF;

 SELECT status,started_at,match_questions,match_no INTO v_status,v_start,v_questions,v_match_no
 FROM public.rooms WHERE code=v_code FOR UPDATE;
 IF NOT FOUND OR v_status NOT IN ('VS','QUIZ') OR v_start IS NULL THEN
   RETURN jsonb_build_object('success',false,'error','Aktif müsabaka bulunamadı'); END IF;
 IF clock_timestamp()<v_start THEN RETURN jsonb_build_object('success',false,'error','Maç henüz başlamadı'); END IF;
 IF clock_timestamp()>=v_start+interval '90 seconds' THEN
   UPDATE public.rooms SET status='RESULT' WHERE code=v_code;
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
   streak=CASE WHEN v_is_correct THEN streak+1 ELSE 0 END,
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

GRANT EXECUTE ON FUNCTION public.get_server_time_rpc() TO authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_rpc(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_room_rpc(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_rooms_rpc() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_player_ready_and_check_start(TEXT,TEXT,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_answer_rpc(TEXT,TEXT,BIGINT,INTEGER) TO authenticated;
REVOKE ALL ON FUNCTION public.get_server_time_rpc() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.heartbeat_rpc(TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.leave_room_rpc(TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.cleanup_stale_rooms_rpc() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.set_player_ready_and_check_start(TEXT,TEXT,BOOLEAN) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.submit_answer_rpc(TEXT,TEXT,BIGINT,INTEGER) FROM PUBLIC,anon;

COMMIT;
