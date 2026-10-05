-- TEKNOFEST Bilgi Yarismasi - avoid repeating questions on rematch
-- 2026-10-05. Apply manually after 20261005000009_expand_question_bank.sql.
-- restart_room_rpc previously sampled each difficulty uniformly at random, so two players
-- who hit "rematch" repeatedly in the same room could see the same questions again quickly.
-- This excludes questions already asked in that room (across all of its past matches) whenever
-- enough unseen questions remain per difficulty; it falls back to the full pool only when the
-- room has exhausted that difficulty's unseen supply, so a long rematch streak still works.
BEGIN;

CREATE OR REPLACE FUNCTION public.restart_room_rpc(p_room_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID := auth.uid(); v_code TEXT := upper(trim(p_room_code)); v_questions JSONB := '[]'::jsonb;
 v_count INTEGER := 0; q RECORD; v_new_match INTEGER;
 v_avoid_kolay INTEGER; v_avoid_orta INTEGER; v_avoid_zor INTEGER;
BEGIN
 IF v_uid IS NULL OR NOT public.is_quiz_room_member(v_code) THEN
   RETURN jsonb_build_object('success', false, 'error', 'Bu odanın oyuncusu değilsin'); END IF;
 PERFORM 1 FROM public.rooms WHERE code = v_code FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Oda bulunamadı'); END IF;

 SELECT count(*) INTO v_avoid_kolay FROM public.questions qs WHERE qs.difficulty = 'kolay'
   AND qs.id NOT IN (SELECT question_id FROM public.room_player_answers WHERE room_code = v_code);
 SELECT count(*) INTO v_avoid_orta FROM public.questions qs WHERE qs.difficulty = 'orta'
   AND qs.id NOT IN (SELECT question_id FROM public.room_player_answers WHERE room_code = v_code);
 SELECT count(*) INTO v_avoid_zor FROM public.questions qs WHERE qs.difficulty = 'zor'
   AND qs.id NOT IN (SELECT question_id FROM public.room_player_answers WHERE room_code = v_code);

 FOR q IN SELECT * FROM (
   (SELECT id,category,difficulty,question,options FROM public.questions
     WHERE difficulty = 'kolay' AND (v_avoid_kolay < 4 OR id NOT IN
       (SELECT question_id FROM public.room_player_answers WHERE room_code = v_code))
     ORDER BY random() LIMIT 4)
   UNION ALL
   (SELECT id,category,difficulty,question,options FROM public.questions
     WHERE difficulty = 'orta' AND (v_avoid_orta < 4 OR id NOT IN
       (SELECT question_id FROM public.room_player_answers WHERE room_code = v_code))
     ORDER BY random() LIMIT 4)
   UNION ALL
   (SELECT id,category,difficulty,question,options FROM public.questions
     WHERE difficulty = 'zor' AND (v_avoid_zor < 2 OR id NOT IN
       (SELECT question_id FROM public.room_player_answers WHERE room_code = v_code))
     ORDER BY random() LIMIT 2)
 ) s ORDER BY random() LOOP
   v_questions := v_questions || jsonb_build_array(jsonb_build_object('id',q.id,'category',q.category,
     'difficulty',q.difficulty,'question',q.question,'options',q.options)); v_count := v_count + 1;
 END LOOP;
 IF v_count <> 10 THEN RETURN jsonb_build_object('success', false, 'error', 'Yeterli soru bulunamadı'); END IF;

 UPDATE public.rooms SET status = 'LOBBY', started_at = NULL, match_questions = v_questions, match_no = match_no + 1
 WHERE code = v_code RETURNING match_no INTO v_new_match;
 UPDATE public.room_players SET is_ready = false, score = 0, streak = 0, correct_answers = 0,
   current_question_index = 0, question_started_at = NULL, finished_at = NULL,
   last_seen_at = clock_timestamp(), updated_at = clock_timestamp()
 WHERE room_code = v_code;
 RETURN jsonb_build_object('success', true, 'status', 'LOBBY', 'match_no', v_new_match);
END;
$$;

GRANT EXECUTE ON FUNCTION public.restart_room_rpc(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.restart_room_rpc(TEXT) FROM PUBLIC,anon;

COMMIT;
