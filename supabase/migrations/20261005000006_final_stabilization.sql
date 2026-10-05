-- TEKNOFEST Bilgi Yarismasi - final stabilization
-- Apply manually in the existing Supabase project. Preserves rooms, players and answers.
BEGIN;

ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS match_no INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.room_players ADD COLUMN IF NOT EXISTS current_question_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.room_players ADD COLUMN IF NOT EXISTS question_started_at TIMESTAMPTZ;
ALTER TABLE public.room_players ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;
ALTER TABLE public.room_player_answers ADD COLUMN IF NOT EXISTS match_no INTEGER NOT NULL DEFAULT 1;

-- The old key prevents a repeated match from using the same question again.
ALTER TABLE public.room_player_answers DROP CONSTRAINT IF EXISTS unique_player_question_answer;
CREATE UNIQUE INDEX IF NOT EXISTS unique_player_match_question_answer
  ON public.room_player_answers(room_code, match_no, player_id, question_id);

-- Only the server may mutate game tables. Existing member SELECT policies remain intact.
REVOKE INSERT, UPDATE, DELETE ON public.rooms, public.room_players, public.room_player_answers
  FROM PUBLIC, anon, authenticated;

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

 UPDATE public.room_players SET is_ready=p_ready_state,updated_at=clock_timestamp()
 WHERE room_code=v_code AND auth_user_id=v_uid;
 SELECT count(*),count(*) FILTER (WHERE is_ready) INTO v_count,v_ready
 FROM public.room_players WHERE room_code=v_code;

 IF v_count=2 AND v_ready=2 THEN
   v_start := clock_timestamp()+interval '3 seconds';
   UPDATE public.rooms SET status='VS',started_at=v_start WHERE code=v_code AND status='LOBBY';
   IF FOUND THEN
     UPDATE public.room_players SET current_question_index=0,question_started_at=v_start,
       finished_at=NULL,score=0,correct_answers=0,streak=0,updated_at=clock_timestamp()
     WHERE room_code=v_code;
     v_started:=true; v_status:='VS';
   END IF;
 END IF;
 RETURN jsonb_build_object('success',true,'total_players',v_count,'ready_count',v_ready,
   'status',v_status,'match_started',v_started,'started_at',v_start);
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
DECLARE v_code TEXT:=upper(trim(p_room_code)); v_start TIMESTAMPTZ; v_finished BOOLEAN;
BEGIN
 IF NOT public.is_quiz_room_member(v_code) THEN
   RETURN jsonb_build_object('success',false,'error','Bu odanın oyuncusu değilsin'); END IF;
 SELECT started_at INTO v_start FROM public.rooms WHERE code=v_code FOR UPDATE;
 SELECT count(*)=2 AND bool_and(finished_at IS NOT NULL) INTO v_finished
 FROM public.room_players WHERE room_code=v_code;
 IF NOT coalesce(v_finished,false) AND (v_start IS NULL OR clock_timestamp()<v_start+interval '90 seconds') THEN
   RETURN jsonb_build_object('success',false,'error','Maç henüz tamamlanmadı'); END IF;
 UPDATE public.rooms SET status='RESULT' WHERE code=v_code AND status IN ('VS','QUIZ');
 RETURN jsonb_build_object('success',true,'status','RESULT');
END;
$$;

CREATE OR REPLACE FUNCTION public.restart_room_rpc(p_room_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid UUID:=auth.uid(); v_code TEXT:=upper(trim(p_room_code)); v_questions JSONB:='[]'::jsonb;
 v_count INTEGER:=0; q RECORD; v_new_match INTEGER;
BEGIN
 IF v_uid IS NULL OR NOT public.is_quiz_room_member(v_code) THEN
   RETURN jsonb_build_object('success',false,'error','Bu odanın oyuncusu değilsin'); END IF;
 PERFORM 1 FROM public.rooms WHERE code=v_code FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Oda bulunamadı'); END IF;
 FOR q IN SELECT * FROM (
   (SELECT id,category,difficulty,question,options FROM public.questions WHERE difficulty='kolay' ORDER BY random() LIMIT 4)
   UNION ALL (SELECT id,category,difficulty,question,options FROM public.questions WHERE difficulty='orta' ORDER BY random() LIMIT 4)
   UNION ALL (SELECT id,category,difficulty,question,options FROM public.questions WHERE difficulty='zor' ORDER BY random() LIMIT 2)
 ) s ORDER BY random() LOOP
   v_questions:=v_questions||jsonb_build_array(jsonb_build_object('id',q.id,'category',q.category,
     'difficulty',q.difficulty,'question',q.question,'options',q.options)); v_count:=v_count+1;
 END LOOP;
 IF v_count<>10 THEN RETURN jsonb_build_object('success',false,'error','Yeterli soru bulunamadı'); END IF;
 UPDATE public.rooms SET status='LOBBY',started_at=NULL,match_questions=v_questions,match_no=match_no+1
 WHERE code=v_code RETURNING match_no INTO v_new_match;
 UPDATE public.room_players SET is_ready=false,score=0,streak=0,correct_answers=0,
   current_question_index=0,question_started_at=NULL,finished_at=NULL,updated_at=clock_timestamp()
 WHERE room_code=v_code;
 RETURN jsonb_build_object('success',true,'status','LOBBY','match_no',v_new_match);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_player_ready_and_check_start(TEXT,TEXT,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_answer_rpc(TEXT,TEXT,BIGINT,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_room_rpc(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restart_room_rpc(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.set_player_ready_and_check_start(TEXT,TEXT,BOOLEAN) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.submit_answer_rpc(TEXT,TEXT,BIGINT,INTEGER) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.finish_room_rpc(TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.restart_room_rpc(TEXT) FROM PUBLIC,anon;

COMMIT;
