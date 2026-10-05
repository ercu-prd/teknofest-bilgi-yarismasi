-- TEKNOFEST Bilgi Yarismasi - RPC Permissions Patch
-- 2026-10-05. Run in Supabase SQL Editor if you encounter RPC 401/403 permission errors.

BEGIN;

-- 1. Ensure authenticated role (which anonymous signed-in users receive) has EXECUTE rights on all game RPCs
GRANT EXECUTE ON FUNCTION public.create_room_rpc(TEXT, TEXT, TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_room_atomic(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_player_ready_and_check_start(TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_room_questions_masked(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_answer_rpc(TEXT, TEXT, BIGINT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_room_rpc(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_quiz_room_member(TEXT) TO authenticated;

-- 2. Revoke public/unauthenticated execution on RPCs
REVOKE ALL ON FUNCTION public.create_room_rpc(TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_room_atomic(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_player_ready_and_check_start(TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_room_questions_masked(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_answer_rpc(TEXT, TEXT, BIGINT, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finish_room_rpc(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_quiz_room_member(TEXT) FROM PUBLIC, anon;

-- 3. Restrict direct table writes from clients (all state mutations MUST go through RPCs)
REVOKE INSERT, UPDATE, DELETE ON public.rooms FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.room_players FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.room_player_answers FROM PUBLIC, anon;

COMMIT;
