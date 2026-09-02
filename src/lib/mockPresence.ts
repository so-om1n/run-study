import type { Member, Party, Reaction, Status } from "../types";
import type {
  GameRow,
  MePatch,
  PartyBrief,
  PartySnapshot,
  PresenceClient,
} from "./presence";
import { ME_ID, mockParty } from "./mock";

const LS_REACTIONS = "runstudy.reactions";
const LS_ME = "runstudy.mockMe";
const LS_PARTIES = "runstudy.mockParties";
const LS_CURRENT = "runstudy.mockCurrent";
const LS_GAMES = "runstudy.mockGames";

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

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++)
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

interface StoredParty {
  id: string;
  name: string;
  code: string;
  /** 목에서는 첫 번째 방에만 친구들이 있다. 새로 만든 방엔 나 혼자 */
  seeded: boolean;
}

/**
 * 백엔드 없이 UI 전체를 돌리는 구현.
 * Supabase 키가 없으면 이걸로 떨어진다.
 *
 * 로비·미니게임까지 여기서 돌아가야 키 없이도 화면을 다 볼 수 있다.
 */
export class MockPresence implements PresenceClient {
  readonly meId = ME_ID;

  private parties: StoredParty[];
  private currentId: string;
  private members: Member[];
  private reactions: Record<string, Reaction[]>;
  private games: Record<string, GameRow[]>;

  private listener: ((s: PartySnapshot) => void) | null = null;
  private gameListeners = new Map<string, (rows: GameRow[]) => void>();
  private timer: number | null = null;

  constructor() {
    this.parties = load<StoredParty[]>(LS_PARTIES, [
      {
        id: mockParty.id,
        name: mockParty.name,
        code: mockParty.code,
        seeded: true,
      },
    ]);
    this.currentId = load<string>(LS_CURRENT, this.parties[0]?.id ?? "");
    if (!this.parties.some((p) => p.id === this.currentId)) {
      this.currentId = this.parties[0]?.id ?? "";
    }

    const savedMe = load<Record<string, unknown> | null>(LS_ME, null);
    this.members = mockParty.members.map((m) =>
      m.id === ME_ID && savedMe ? { ...m, ...savedMe } : { ...m },
    );
    this.reactions = migrate(load<unknown>(LS_REACTIONS, {}));
    this.games = load<Record<string, GameRow[]>>(LS_GAMES, {});
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
      const t = this.members.find((m) => m.id === "u3");
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

  private current(): StoredParty | undefined {
    return this.parties.find((p) => p.id === this.currentId);
  }

  /** 씨드가 없는 방(새로 만든 방)엔 나만 있다 */
  private membersOf(p: StoredParty): Member[] {
    return p.seeded ? this.members : this.members.filter((m) => m.id === ME_ID);
  }

  private briefs(): PartyBrief[] {
    return this.parties.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      memberCount: this.membersOf(p).length,
      isOwner: true, // 목에서는 전부 내 방
    }));
  }

  private emit() {
    if (!this.listener) return;
    const p = this.current();
    const party: Party | null = p
      ? { id: p.id, name: p.name, code: p.code, members: this.membersOf(p) }
      : null;
    this.listener({
      party,
      parties: this.briefs(),
      reactions: { ...this.reactions },
    });
  }

  private me() {
    return this.members.find((m) => m.id === ME_ID);
  }

  private persistParties() {
    save(LS_PARTIES, this.parties);
    save(LS_CURRENT, this.currentId);
  }

  // ---------- 파티 ----------
  async createParty(name: string) {
    const p: StoredParty = {
      id: `mock-${Date.now().toString(36)}`,
      name: name.trim().slice(0, 20) || "우리끼리",
      code: randomCode(),
      seeded: false,
    };
    this.parties = [...this.parties, p];
    this.currentId = p.id;
    this.persistParties();
    this.emit();
  }

  async joinParty(code: string) {
    const up = code.trim().toUpperCase();
    const found = this.parties.find((p) => p.code === up);
    if (found) {
      this.currentId = found.id;
    } else {
      // 목에는 진짜 서버가 없으니 그 코드로 방이 하나 생긴 것처럼 군다
      const p: StoredParty = {
        id: `mock-${Date.now().toString(36)}`,
        name: "코드로 들어온 방",
        code: up,
        seeded: false,
      };
      this.parties = [...this.parties, p];
      this.currentId = p.id;
    }
    this.persistParties();
    this.emit();
  }

  async switchParty(partyId: string) {
    if (!this.parties.some((p) => p.id === partyId)) return;
    this.currentId = partyId;
    this.persistParties();
    this.emit();
  }

  async leaveParty(partyId: string) {
    this.parties = this.parties.filter((p) => p.id !== partyId);
    if (this.currentId === partyId) this.currentId = this.parties[0]?.id ?? "";
    this.persistParties();
    this.emit();
  }

  async renameParty(partyId: string, name: string) {
    this.parties = this.parties.map((p) =>
      p.id === partyId
        ? { ...p, name: name.trim().slice(0, 20) || "우리끼리" }
        : p,
    );
    this.persistParties();
    this.emit();
  }

  // ---------- 내 상태 ----------
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

  // ---------- 반응 ----------
  async addReaction(targetUserId: string, emoji: string) {
    const list = this.reactions[targetUserId] ?? [];
    if (list.some((r) => r.emoji === emoji && r.by === ME_ID)) return;
    this.reactions = {
      ...this.reactions,
      [targetUserId]: [...list, { emoji, by: ME_ID }],
    };
    save(LS_REACTIONS, this.reactions);
    this.emit();
  }

  async removeReaction(targetUserId: string, emoji: string) {
    this.reactions = {
      ...this.reactions,
      [targetUserId]: (this.reactions[targetUserId] ?? []).filter(
        (r) => !(r.emoji === emoji && r.by === ME_ID),
      ),
    };
    save(LS_REACTIONS, this.reactions);
    this.emit();
  }

  // ---------- 미니게임 ----------
  private gameKey(kind: string, day: string) {
    return `${this.currentId}:${kind}:${day}`;
  }

  async watchGame(
    kind: string,
    day: string,
    onChange: (rows: GameRow[]) => void,
  ) {
    const key = this.gameKey(kind, day);
    this.gameListeners.set(key, onChange);
    onChange(this.games[key] ?? []);
    return () => {
      this.gameListeners.delete(key);
    };
  }

  async saveGame(
    kind: string,
    day: string,
    progress: { attempts: number; solved: boolean; marks: string[] },
  ) {
    const key = this.gameKey(kind, day);
    const rest = (this.games[key] ?? []).filter((r) => r.userId !== ME_ID);
    this.games = {
      ...this.games,
      [key]: [...rest, { userId: ME_ID, ...progress }],
    };
    save(LS_GAMES, this.games);
    this.gameListeners.get(key)?.(this.games[key]);
  }

  async linkAccount() {
    console.info("[run study] 목 모드에서는 계정 연결이 없습니다.");
  }
}
