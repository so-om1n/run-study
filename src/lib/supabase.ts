import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** 키가 없으면 null. 그때는 목 데이터로 돌아간다. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : null;

export interface Session {
  userId: string;
  isAnonymous: boolean;
}

/**
 * 로그인 화면 없이 세션을 확보한다.
 *
 * 익명 로그인도 진짜 auth.uid() 와 authenticated 역할을 받기 때문에
 * RLS 정책이 그대로 성립한다. (JWT 의 is_anonymous 로 구분도 가능)
 * 대신 이 계정은 기기에 묶여서, 앱 데이터를 지우면 돌아올 수 없다.
 * 그래서 설정에 "계정 연결"(linkIdentity)을 하나 열어둔다.
 */
export async function ensureSession(): Promise<Session | null> {
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();
  let user = data.session?.user ?? null;

  if (!user) {
    const { data: anon, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error("[run study] 익명 로그인 실패", error);
      return null;
    }
    user = anon.user;
  }
  if (!user) return null;

  return {
    userId: user.id,
    // 익명 계정은 identities 가 비어 있다
    isAnonymous: (user.identities?.length ?? 0) === 0,
  };
}

/** 익명 계정에 GitHub 을 붙여 영구 계정으로 승격 */
export async function linkGitHub(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.linkIdentity({ provider: "github" });
  if (error) throw error;
}
