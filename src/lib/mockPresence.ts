import type { Reaction, Status } from "../types";
import type { MePatch, PartySnapshot, PresenceClient } from "./presence";
import { ME_ID, mockParty } from "./mock";

const LS_REACTIONS = "runstudy.reactions";
const LS_ME = "runstudy.mockMe";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* 무시 */
  }
}

/** 예전 형식(이모지 문자열 배열)을 새 형식으로 올린다. */
function migrate(raw: unknown): Record<string, Reaction[]> {
  const out: Record<string, Reaction[]> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    out[k] = list.map((x) =>
      typeof x === "string" ? { emoji: x, by: ME_ID } : (x as Reaction),
    );
  }
  return out;
}

/**
 * 백엔드 없이 UI 전체를 돌리는 구현.
 * Supabase 키가 없으면 이걸로 떨어진다.
 */
export class MockPresence implements PresenceClient {
  readonly meId = ME_ID;
  private snap: PartySnapshot;
  private listener: ((s: PartySnapshot) => void) | null = null;
  private timer: number | null = null;

  constructor() {
    const savedMe = load<Record<string, unknown> | null>(LS_ME, null);
    const members = mockParty.members.map((m) =>
      m.id === ME_ID && savedMe ? { ...m, ...savedMe } : { ...m },
    );
    this.snap = {
      party: { ...mockParty, members },
      reactions: migrate(load<unknown>(LS_REACTIONS, {})),
    };
  }

  isAnonymous() {
    return true;
  }
  isLive() {
    return false;
  }

  async start(onChange: (s: PartySnapshot) => void) {
    this.listener = onChange;
    this.emit();
    // 다른 사람이 살아있는 것처럼 가끔 상태를 흔든다
    this.timer = window.setInterval(() => {
      const t = this.snap.party?.members.find((m) => m.id === "u3");
      if (t) {
        t.status = t.status === "online" ? "focus" : "online";
        t.focusStartedAt = t.status === "focus" ? Date.now() : null;
      }
      this.emit();
    }, 45_000);

    return () => {
      if (this.timer !== null) window.clearInterval(this.timer);
      this.listener = null;
    };
  }

  private emit() {
    this.listener?.({
      party: this.snap.party ? { ...this.snap.party } : null,
      reactions: { ...this.snap.reactions },
    });
  }

  private me() {
    return this.snap.party?.members.find((m) => m.id === ME_ID);
  }

  async createParty(name: string) {
    if (this.snap.party) this.snap.party.name = name || "우리끼리";
    this.emit();
  }
  async joinParty() {
    this.emit();
  }

  async updateMe(patch: MePatch) {
    const me = this.me();
    if (!me) return;
    Object.assign(me, patch);
    save(LS_ME, {
      name: me.name,
      profile: me.profile,
      background: me.background,
      backgroundIsDark: me.backgroundIsDark,
      message: me.message,
    });
    this.emit();
  }

  async setPresence(status: Status, focusStartedAt: number | null) {
    const me = this.me();
    if (!me) return;
    me.status = status;
    me.focusStartedAt = focusStartedAt;
    this.emit();
  }

  async addReaction(targetUserId: string, emoji: string) {
    const list = this.snap.reactions[targetUserId] ?? [];
    if (list.some((r) => r.emoji === emoji && r.by === ME_ID)) return;
    this.snap.reactions = {
      ...this.snap.reactions,
      [targetUserId]: [...list, { emoji, by: ME_ID }],
    };
    save(LS_REACTIONS, this.snap.reactions);
    this.emit();
  }

  async removeReaction(targetUserId: string, emoji: string) {
    this.snap.reactions = {
      ...this.snap.reactions,
      [targetUserId]: (this.snap.reactions[targetUserId] ?? []).filter(
        (r) => !(r.emoji === emoji && r.by === ME_ID),
      ),
    };
    save(LS_REACTIONS, this.snap.reactions);
    this.emit();
  }

  async linkAccount() {
    console.info("[run study] 목 모드에서는 계정 연결이 없습니다.");
  }
}
