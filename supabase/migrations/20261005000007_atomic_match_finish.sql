-- TEKNOFEST Bilgi Yarismasi - atomic and idempotent match finish
-- Apply manually after 20261005000006_final_stabilization.sql.
BEGIN;

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
 v_timed_out := clock_timestamp() >= v_start+interval '90 seconds';

 IF NOT coalesce(v_finished,false) AND NOT v_timed_out THEN
   RETURN jsonb_build_object('success',false,'error','Maç henüz tamamlanmadı');
 END IF;

 UPDATE public.rooms SET status='RESULT'
 WHERE code=v_code AND status IN ('VS','QUIZ');
 RETURN jsonb_build_object('success',true,'status','RESULT','already_finished',false,
   'both_finished',coalesce(v_finished,false),'timed_out',v_timed_out);
END;
$$;

GRANT EXECUTE ON FUNCTION public.finish_room_rpc(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.finish_room_rpc(TEXT) FROM PUBLIC,anon;

COMMIT;
