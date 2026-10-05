-- TEKNOFEST Bilgi Yarismasi - Fix Question Belonging & Answer Idempotency
-- 2026-10-05. Ensures idempotency for repeated submissions and strict room question matching.

BEGIN;

CREATE OR REPLACE FUNCTION public.submit_answer_rpc(
 p_room_code TEXT, p_player_id TEXT, p_question_id BIGINT, p_selected_option_index INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID := auth.uid();
 v_code TEXT := upper(trim(p_room_code));
 v_status TEXT; v_start TIMESTAMPTZ; v_questions JSONB;
 v_correct INTEGER; v_elapsed DOUBLE PRECISION;
 v_bonus INTEGER; v_points INTEGER;
 v_is_correct BOOLEAN; v_score INTEGER; v_found_q BOOLEAN := false;
 v_prev_answer RECORD;
BEGIN
 IF v_uid IS NULL THEN
   RETURN jsonb_build_object('success', false, 'error', 'Oturum yok (signInAnonymously gerekli)');
 END IF;

 IF p_selected_option_index NOT BETWEEN 0 AND 3 THEN
   RETURN jsonb_build_object('success', false, 'error', 'Geçersiz şık (0-3 arasında olmalı)');
 END IF;

 SELECT status, started_at, match_questions INTO v_status, v_start, v_questions
 FROM public.rooms WHERE code = v_code FOR UPDATE;

 IF NOT FOUND OR v_status NOT IN ('VS', 'QUIZ') OR v_start IS NULL THEN
   RETURN jsonb_build_object('success', false, 'error', 'Aktif müsabaka bulunamadı');
 END IF;

 IF NOT EXISTS(SELECT 1 FROM public.room_players WHERE room_code = v_code AND auth_user_id = v_uid) THEN
   RETURN jsonb_build_object('success', false, 'error', 'Bu odanın oyuncusu değilsin');
 END IF;

 v_elapsed := extract(epoch from (clock_timestamp() - v_start));
 IF v_elapsed < 0 OR v_elapsed > 95 THEN
   RETURN jsonb_build_object('success', false, 'error', 'Maç süresi bitti (90 saniye)');
 END IF;

 -- Verify that the question_id belongs to this match's question set
 SELECT EXISTS(
   SELECT 1 FROM jsonb_array_elements(v_questions) AS elem
   WHERE (elem->>'id')::BIGINT = p_question_id
 ) INTO v_found_q;

 IF NOT v_found_q THEN
   RETURN jsonb_build_object('success', false, 'error', 'Bu soru bu maça ait değil');
 END IF;

 -- Get correct_index for this question from questions table
 SELECT correct_index INTO v_correct FROM public.questions WHERE id = p_question_id;
 IF NOT FOUND THEN
   RETURN jsonb_build_object('success', false, 'error', 'Soru veritabanında bulunamadı');
 END IF;

 -- Check if question was already answered by this player in this room (Idempotent response)
 SELECT is_correct, points_awarded INTO v_prev_answer
 FROM public.room_player_answers
 WHERE room_code = v_code AND player_id = v_uid::text AND question_id = p_question_id;

 IF FOUND THEN
   SELECT score INTO v_score FROM public.room_players
   WHERE room_code = v_code AND auth_user_id = v_uid;

   RETURN jsonb_build_object(
     'success', true,
     'already_answered', true,
     'is_correct', v_prev_answer.is_correct,
     'correct_index', v_correct,
     'points_added', 0,
     'new_score', COALESCE(v_score, 0)
   );
 END IF;

 v_is_correct := (v_correct = p_selected_option_index);
 -- Speed bonus: 0 to 50 points based on overall match elapsed time
 v_bonus := greatest(0, least(50, floor((90 - v_elapsed) * 50 / 90)::INTEGER));
 v_points := CASE WHEN v_is_correct THEN 100 + v_bonus ELSE 0 END;

 INSERT INTO public.room_player_answers(room_code, player_id, question_id, selected_option_index, is_correct, points_awarded)
 VALUES(v_code, v_uid::text, p_question_id, p_selected_option_index, v_is_correct, v_points);

 UPDATE public.room_players
 SET score = score + v_points,
     correct_answers = correct_answers + (CASE WHEN v_is_correct THEN 1 ELSE 0 END),
     streak = CASE WHEN v_is_correct THEN streak + 1 ELSE 0 END,
     updated_at = clock_timestamp()
 WHERE room_code = v_code AND auth_user_id = v_uid RETURNING score INTO v_score;

 RETURN jsonb_build_object(
   'success', true,
   'already_answered', false,
   'is_correct', v_is_correct,
   'correct_index', v_correct,
   'points_added', v_points,
   'new_score', v_score
 );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_answer_rpc(TEXT, TEXT, BIGINT, INTEGER) TO authenticated;
REVOKE ALL ON FUNCTION public.submit_answer_rpc(TEXT, TEXT, BIGINT, INTEGER) FROM PUBLIC, anon;

COMMIT;
