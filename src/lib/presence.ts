import type {
  Member,
  Party,
  Profile,
  Reaction,
  Status,
  StatusMessage,
} from "../types";

/** 로비 목록에 뜨는 한 줄 */
export interface PartyBrief {
  id: string;
  name: string;
  code: string;
  memberCount: number;
  /** 내가 만든 방인지 — 이름 바꾸기·없애기는 방장만 */
  isOwner: boolean;
}

/** 화면이 필요로 하는 공유 상태 전부 */
export interface PartySnapshot {
  /** 지금 보고 있는 방 */
  party: Party | null;
  /** 내가 들어가 있는 방 전부 (로비용) */
  parties: PartyBrief[];
  /** 대상 유저 id → 그 사람이 받은 반응들 */
  reactions: Record<string, Reaction[]>;
}

/** 미니게임에서 한 사람의 오늘 진행도 */
export interface GameRow {
  userId: string;
  attempts: number;
  solved: boolean;
  /** 시도별 채점 결과만. 추측한 단어 자체는 안 넘긴다 — 답이 새니까 */
  marks: string[];
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
  /** 보고 있는 방을 바꾼다 */
  switchParty(partyId: string): Promise<void>;
  /** 나만 나간다. 방장이어도 방은 남는다 */
  leaveParty(partyId: string): Promise<void>;
  /** 방장만 */
  renameParty(partyId: string, name: string): Promise<void>;

  /**
   * 오늘 이 방의 게임 진행도를 구독한다. 정리 함수를 돌려준다.
   * 팝오버와 게임 창이 각각 켜고 끌 수 있어야 해서 따로 뺐다.
   */
  watchGame(
    kind: string,
    day: string,
    onChange: (rows: GameRow[]) => void,
  ): Promise<() => void>;

  /** 내 진행도를 올린다 */
  saveGame(
    kind: string,
    day: string,
    progress: { attempts: number; solved: boolean; marks: string[] },
  ): Promise<void>;

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

export type PresenceResult =
  | { ok: true; client: PresenceClient }
  | { ok: false; error: string; hint?: string };

/**
 * 키가 없으면 목, 있으면 Supabase.
 *
 * 중요 — 키가 있는데 연결에 실패하면 목으로 떨어지지 않는다.
 * 조용히 폴백하면 화면에는 목 데이터 6명이 멀쩡히 떠서
 * "되네?" 하고 넘어가고, 정작 친구는 안 보이는데 이유를 모르게 된다.
 * 그래서 그때는 에러를 그대로 올린다.
 */
export async function createPresence(
  opts: { track?: boolean } = {},
): Promise<PresenceResult> {
  const { supabase, ensureSession } = await import("./supabase");

  if (!supabase) {
    // 키가 아예 없는 건 의도된 상태다 (백엔드 없이 UI 보기)
    const { MockPresence } = await import("./mockPresence");
    return { ok: true, client: new MockPresence() };
  }

  try {
    const session = await ensureSession();
    if (!session) {
      return {
        ok: false,
        error: "익명 로그인이 거절됐어요",
        hint: "Supabase 대시보드 → Authentication → Providers → Anonymous sign-ins 가 켜져 있는지 확인해 주세요",
      };
    }
    const { SupabasePresence } = await import("./supabasePresence");
    return { ok: true, client: new SupabasePresence(session, opts.track ?? true) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Supabase 에 붙지 못했어요",
      hint: ".env 의 URL 과 anon key 를 다시 확인해 주세요",
    };
  }
}
