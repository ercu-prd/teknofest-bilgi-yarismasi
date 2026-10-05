-- TEKNOFEST Bilgi Yarismasi - Remove Streak Bonus Migration
-- 2026-10-05. Ensures points rely strictly on correct answers + speed bonus (max 150 points).

BEGIN;

-- Re-assert submit_answer_rpc without streak multipliers (max 100 base + max 50 speed bonus = 150 pts max)
CREATE OR REPLACE FUNCTION public.submit_answer_rpc(
 p_room_code TEXT, p_player_id TEXT, p_question_id BIGINT, p_selected_option_index INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID := auth.uid();
 v_code TEXT := upper(trim(p_room_code));
 v_status TEXT; v_start TIMESTAMPTZ; v_questions JSONB;
 v_ordinal BIGINT; v_correct INTEGER; v_elapsed DOUBLE PRECISION;
 v_in_question DOUBLE PRECISION; v_bonus INTEGER; v_points INTEGER;
 v_is_correct BOOLEAN; v_score INTEGER;
BEGIN
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Oturum yok'); END IF;
 IF p_selected_option_index NOT BETWEEN 0 AND 3 THEN
   RETURN jsonb_build_object('success', false, 'error', 'Geçersiz şık'); END IF;

 SELECT status, started_at, match_questions INTO v_status, v_start, v_questions
 FROM public.rooms WHERE code = v_code FOR UPDATE;

 IF NOT FOUND OR v_status NOT IN ('VS', 'QUIZ') OR v_start IS NULL THEN
   RETURN jsonb_build_object('success', false, 'error', 'Aktif maç yok'); END IF;

 IF NOT EXISTS(SELECT 1 FROM public.room_players WHERE room_code = v_code AND auth_user_id = v_uid) THEN
   RETURN jsonb_build_object('success', false, 'error', 'Bu odada değilsin'); END IF;

 v_elapsed := extract(epoch from(clock_timestamp() - v_start));
 IF v_elapsed < 0 OR v_elapsed >= 90 THEN
   RETURN jsonb_build_object('success', false, 'error', 'Soru henüz başlamadı veya maç bitti'); END IF;

 SELECT x.ordinality INTO v_ordinal
 FROM jsonb_array_elements(v_questions) WITH ORDINALITY AS x(item, ordinality)
 WHERE (x.item->>'id')::BIGINT = p_question_id;

 IF v_ordinal IS NULL OR v_ordinal <> floor(v_elapsed / 9)::BIGINT + 1 THEN
   RETURN jsonb_build_object('success', false, 'error', 'Bu soru şu anda aktif değil'); END IF;

 v_in_question := v_elapsed - ((v_ordinal - 1) * 9);

 SELECT correct_index INTO v_correct FROM public.questions WHERE id = p_question_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Soru bulunamadı'); END IF;

 v_is_correct := (v_correct = p_selected_option_index);
 -- Speed bonus: 0 to 50 points based on remaining time in the 9-second question window
 v_bonus := greatest(0, least(50, floor((9 - v_in_question) * 50 / 9)::INTEGER));
 v_points := CASE WHEN v_is_correct THEN 100 + v_bonus ELSE 0 END;

 IF EXISTS(SELECT 1 FROM public.room_player_answers
           WHERE room_code = v_code AND player_id = v_uid::text AND question_id = p_question_id) THEN
   RETURN jsonb_build_object('success', false, 'error', 'Bu soru zaten cevaplandı'); END IF;

 INSERT INTO public.room_player_answers(room_code, player_id, question_id, selected_option_index, is_correct, points_awarded)
 VALUES(v_code, v_uid::text, p_question_id, p_selected_option_index, v_is_correct, v_points);

 UPDATE public.room_players
 SET score = score + v_points,
     correct_answers = correct_answers + (CASE WHEN v_is_correct THEN 1 ELSE 0 END),
     streak = CASE WHEN v_is_correct THEN streak + 1 ELSE 0 END,
     updated_at = clock_timestamp()
 WHERE room_code = v_code AND auth_user_id = v_uid RETURNING score INTO v_score;

 RETURN jsonb_build_object('success', true, 'is_correct', v_is_correct, 'points_added', v_points, 'new_score', v_score);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_answer_rpc(TEXT, TEXT, BIGINT, INTEGER) TO authenticated;
REVOKE ALL ON FUNCTION public.submit_answer_rpc(TEXT, TEXT, BIGINT, INTEGER) FROM PUBLIC, anon;

COMMIT;
