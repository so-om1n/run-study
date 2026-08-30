import type {
  Member,
  Party,
  Profile,
  Reaction,
  Status,
  StatusMessage,
} from "../types";

/** 화면이 필요로 하는 공유 상태 전부 */
export interface PartySnapshot {
  party: Party | null;
  /** 대상 유저 id → 그 사람이 받은 반응들 */
  reactions: Record<string, Reaction[]>;
}

export interface MePatch {
  name?: string;
  profile?: Profile;
  background?: string;
  backgroundIsDark?: boolean;
  message?: StatusMessage | null;
}

/**
 * 공유 상태 계층.
 *
 * 목 구현과 Supabase 구현이 같은 인터페이스를 만족한다.
 * .env 에 키가 없으면 목으로 떨어지므로, 백엔드 없이도 UI 가 전부 돌아간다.
 *
 * ⚠ 타이머는 절대 초 단위로 브로드캐스트하지 않는다.
 * Supabase Presence 는 고빈도 업데이트용이 아니라고 공식 문서에 명시돼 있다.
 * focusStartedAt(시작 시각)만 실어 보내고, 흐르는 숫자는 각자 계산한다.
 */
export interface PresenceClient {
  readonly meId: string;
  /** 익명 계정인지 — 설정의 "계정 연결" 노출 여부 */
  isAnonymous(): boolean;
  /** 실제 백엔드에 붙어 있는지 */
  isLive(): boolean;

  /** 구독 시작. 정리 함수를 돌려준다. */
  start(onChange: (snap: PartySnapshot) => void): Promise<() => void>;

  createParty(name: string): Promise<void>;
  joinParty(code: string): Promise<void>;

  updateMe(patch: MePatch): Promise<void>;
  setPresence(status: Status, focusStartedAt: number | null): Promise<void>;

  addReaction(targetUserId: string, emoji: string): Promise<void>;
  removeReaction(targetUserId: string, emoji: string): Promise<void>;

  linkAccount(): Promise<void>;
}

/** DB 행 → 화면이 쓰는 Member */
export function toMember(
  row: Record<string, unknown>,
  status: Status,
  focusStartedAt: number | null,
): Member {
  const profile: Profile = {
    characterColor: (row.character_color as string) ?? "#F0C96B",
    photo: (row.photo as string) ?? null,
    shape: ((row.shape as string) ?? "cloud") as Profile["shape"],
    crop: (row.crop as Profile["crop"]) ?? { zoom: 1, x: 50, y: 50 },
  };
  const text = (row.status_text as string) ?? "";
  return {
    id: row.id as string,
    name: (row.name as string) ?? "이름 없음",
    handle: (row.handle as string) ?? "",
    profile,
    background: (row.background as string) ?? "#F7EBD3",
    backgroundIsDark: Boolean(row.background_is_dark),
    status,
    message: text
      ? {
          text,
          emoji: (row.status_emoji as string) ?? null,
          expiresAt: row.status_expires_at
            ? new Date(row.status_expires_at as string).getTime()
            : null,
        }
      : null,
    focusStartedAt,
    joinedAt: row.joined_at
      ? new Date(row.joined_at as string).toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "",
  };
}

export type { Party, Member, Reaction };

/** 키가 있으면 Supabase, 없으면 목. */
export async function createPresence(): Promise<PresenceClient> {
  const { supabase, ensureSession } = await import("./supabase");
  const { MockPresence } = await import("./mockPresence");

  if (!supabase) {
    console.info("[run study] Supabase 키가 없어 목 데이터로 실행합니다.");
    return new MockPresence();
  }
  const session = await ensureSession();
  if (!session) {
    console.warn("[run study] 세션 확보 실패 — 목 데이터로 실행합니다.");
    return new MockPresence();
  }
  const { SupabasePresence } = await import("./supabasePresence");
  return new SupabasePresence(session);
}
