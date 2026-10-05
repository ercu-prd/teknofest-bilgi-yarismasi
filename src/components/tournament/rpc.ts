import { supabase } from '../../lib/supabase';

export type RpcOutcome<T = Record<string, unknown>> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** `{success, error}` döndüren turnuva RPC'lerini tek tip sonuca çevirir; throw etmez. */
export async function callTournamentRpc<T = Record<string, unknown>>(
  fn: string,
  params: Record<string, unknown>,
  fallbackError: string
): Promise<RpcOutcome<T>> {
  try {
    const { data, error } = await supabase.rpc(fn, params);
    if (error) return { ok: false, error: error.message || fallbackError };
    if (!data?.success) return { ok: false, error: data?.error || fallbackError };
    return { ok: true, data: data as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : fallbackError };
  }
}
