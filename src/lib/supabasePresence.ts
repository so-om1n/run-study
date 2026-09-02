import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Member, Party, Reaction, Status } from "../types";
import type {
  GameRow,
  MePatch,
  PartyBrief,
  PartySnapshot,
  PresenceClient,
} from "./presence";
import { toMember } from "./presence";
import { linkGitHub, supabase, type Session } from "./supabase";

/** 마지막으로 보던 방. 앱을 껐다 켜도 그 방으로 돌아온다 */
const LS_CURRENT = "runstudy.currentParty";

interface PresencePayload {
  status: Status;
  focus_started_at: number | null;
}

/**
 * 진짜 백엔드. .env 에 Supabase 키가 있으면 이게 쓰인다.
 *
 * 역할 분담:
 *   - DB(profile, reaction) : 남아야 하는 것 — 프로필, 상태 메시지, 반응
 *   - Realtime Presence     : 휘발성 — 지금 온라인인지, 집중 시작 시각
 *
 * 타이머 숫자는 브로드캐스트하지 않는다. focus_started_at 만 보내고
 * 흐르는 초는 각 클라이언트가 계산한다. (Presence 는 고빈도용이 아님)
 */
export class SupabasePresence implements PresenceClient {
  readonly meId: string;
  private anon: boolean;

  private party: Party | null = null;
  private parties: PartyBrief[] = [];
  private rows: Record<string, unknown>[] = [];
  private joinedAt: Record<string, string> = {};
  private reactions: Record<string, Reaction[]> = {};
  private live: Record<string, PresencePayload> = {};
  private statusIds: Record<string, string> = {};

  private channel: RealtimeChannel | null = null;
  private listener: ((s: PartySnapshot) => void) | null = null;
  private mine: PresencePayload = { status: "online", focus_started_at: null };

  /**
   * track=false 면 Presence 채널에 내 온라인 상태를 싣지 않는다.
   * 게임 창처럼 같은 계정으로 하나 더 붙는 창이 track 까지 하면
   * presence key 가 겹쳐서 팝오버가 보고하던 상태를 덮어쓴다.
   */
  constructor(session: Session, private track = true) {
    this.meId = session.userId;
    this.anon = session.isAnonymous;
  }

  isAnonymous() {
    return this.anon;
  }
  isLive() {
    return true;
  }

  private db() {
    if (!supabase) throw new Error("Supabase 클라이언트가 없습니다");
    return supabase;
  }

  // ---------- 시작 ----------
  async start(onChange: (s: PartySnapshot) => void) {
    this.listener = onChange;
    await this.ensureProfile();
    await this.loadParty();
    await this.refresh();
    this.emit();

    return () => {
      void this.channel?.unsubscribe();
      this.channel = null;
      this.listener = null;
    };
  }

  /** 첫 실행이면 내 프로필 행을 만든다 */
  private async ensureProfile() {
    const { data } = await this.db()
      .from("profile")
      .select("id")
      .eq("id", this.meId)
      .maybeSingle();
    if (!data) {
      await this.db().from("profile").insert({ id: this.meId });
    }
  }

  /** 내가 들어간 방 전부를 읽고, 그중 하나를 현재 방으로 세운다 */
  private async loadParty() {
    await this.loadPartyList();

    let want: string | null = null;
    try {
      want = localStorage.getItem(LS_CURRENT);
    } catch {
      /* 저장소를 못 쓰면 그냥 첫 번째 방 */
    }

    const pick =
      this.parties.find((p) => p.id === want) ?? this.parties[0] ?? null;
    this.party = pick
      ? { id: pick.id, name: pick.name, code: pick.code, members: [] }
      : null;
    if (this.party) {
      this.remember(this.party.id);
      await this.subscribe();
    }
  }

  /** 로비에 뿌릴 방 목록 */
  private async loadPartyList() {
    const { data } = await this.db()
      .from("party_member")
      .select("party_id, party(id, name, code, created_by)")
      .eq("user_id", this.meId);

    const rows = (data ?? [])
      .map((r) => r.party as unknown)
      .filter(Boolean) as {
      id: string;
      name: string;
      code: string;
      created_by: string | null;
    }[];

    // 방마다 인원수. RLS 가 내가 속한 방만 보여주므로 한 번에 세도 안전하다.
    const ids = rows.map((r) => r.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: mem } = await this.db()
        .from("party_member")
        .select("party_id")
        .in("party_id", ids);
      for (const m of mem ?? []) {
        const id = m.party_id as string;
        counts[id] = (counts[id] ?? 0) + 1;
      }
    }

    this.parties = rows
      .map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        memberCount: counts[r.id] ?? 1,
        isOwner: r.created_by === this.meId,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }

  private remember(id: string) {
    try {
      localStorage.setItem(LS_CURRENT, id);
    } catch {
      /* 무시 */
    }
  }

  /** 프로필 · 반응 다시 읽기 */
  private async refresh() {
    if (!this.party) return;

    const { data: members } = await this.db()
      .from("party_member")
      .select("user_id, joined_at")
      .eq("party_id", this.party.id);

    const ids = (members ?? []).map((m) => m.user_id as string);
    this.joinedAt = Object.fromEntries(
      (members ?? []).map((m) => [m.user_id as string, m.joined_at as string]),
    );

    const { data: profiles } = await this.db()
      .from("profile")
      .select("*")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    this.rows = profiles ?? [];
    this.statusIds = Object.fromEntries(
      this.rows.map((r) => [r.id as string, r.status_id as string]),
    );

    const { data: rx } = await this.db()
      .from("reaction")
      .select("target_user_id, emoji, by_user_id, target_status")
      .eq("party_id", this.party.id);

    const grouped: Record<string, Reaction[]> = {};
    for (const r of rx ?? []) {
      const target = r.target_user_id as string;
      // 상태 메시지가 바뀐 뒤의 옛 반응은 무시
      if (this.statusIds[target] && r.target_status !== this.statusIds[target])
        continue;
      (grouped[target] ??= []).push({
        emoji: r.emoji as string,
        by: r.by_user_id as string,
      });
    }
    this.reactions = grouped;
  }

  // ---------- 실시간 ----------
  private async subscribe() {
    if (!this.party) return;
    void this.channel?.unsubscribe();

    const ch = this.db().channel(`party:${this.party.id}`, {
      config: { presence: { key: this.meId } },
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<PresencePayload>();
      const next: Record<string, PresencePayload> = {};
      for (const [id, entries] of Object.entries(state)) {
        const e = entries[0];
        if (e) next[id] = { status: e.status, focus_started_at: e.focus_started_at };
      }
      this.live = next;
      this.emit();
    });

    for (const table of ["profile", "reaction", "party_member"]) {
      ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => void this.refresh().then(() => this.emit()),
      );
    }

    ch.subscribe((status) => {
      if (status === "SUBSCRIBED" && this.track) void ch.track(this.mine);
    });
    this.channel = ch;
  }

  private emit() {
    if (!this.listener) return;
    const members: Member[] = this.rows.map((row) => {
      const id = row.id as string;
      const p = this.live[id];
      return toMember(
        { ...row, joined_at: this.joinedAt[id] },
        p?.status ?? "offline",
        p?.focus_started_at ?? null,
      );
    });
    // 내가 항상 맨 앞
    members.sort((a, b) =>
      a.id === this.meId ? -1 : b.id === this.meId ? 1 : 0,
    );
    this.listener({
      party: this.party ? { ...this.party, members } : null,
      parties: this.parties,
      reactions: this.reactions,
    });
  }

  // ---------- 파티 ----------
  async createParty(name: string) {
    const { data, error } = await this.db().rpc("create_party", {
      p_name: name,
    });
    if (error) throw error;
    await this.enter(data as { id: string; name: string; code: string });
  }

  async joinParty(code: string) {
    const { data, error } = await this.db().rpc("join_party", { p_code: code });
    if (error) throw error;
    await this.enter(data as { id: string; name: string; code: string });
  }

  /** 그 방을 현재 방으로 세우고 구독을 옮긴다 */
  private async enter(p: { id: string; name: string; code: string }) {
    this.party = { ...p, members: [] };
    this.remember(p.id);
    // 방을 옮기면 이전 방의 반응·프로필은 남겨두면 안 된다
    this.rows = [];
    this.reactions = {};
    this.live = {};
    await this.subscribe();
    await this.loadPartyList();
    await this.refresh();
    this.emit();
  }

  async switchParty(partyId: string) {
    const target = this.parties.find((p) => p.id === partyId);
    if (!target || this.party?.id === partyId) return;
    await this.enter({
      id: target.id,
      name: target.name,
      code: target.code,
    });
  }

  async leaveParty(partyId: string) {
    const { error } = await this.db()
      .from("party_member")
      .delete()
      .eq("party_id", partyId)
      .eq("user_id", this.meId);
    if (error) throw error;

    await this.loadPartyList();
    if (this.party?.id === partyId) {
      const next = this.parties[0];
      if (next) {
        await this.enter(next);
      } else {
        void this.channel?.unsubscribe();
        this.channel = null;
        this.party = null;
        this.rows = [];
        this.reactions = {};
        this.emit();
      }
    } else {
      this.emit();
    }
  }

  async renameParty(partyId: string, name: string) {
    const trimmed = name.trim().slice(0, 20) || "우리끼리";
    const { error } = await this.db()
      .from("party")
      .update({ name: trimmed })
      .eq("id", partyId);
    if (error) throw error;
    if (this.party?.id === partyId) this.party = { ...this.party, name: trimmed };
    await this.loadPartyList();
    this.emit();
  }

  // ---------- 미니게임 ----------
  async watchGame(
    kind: string,
    day: string,
    onChange: (rows: GameRow[]) => void,
  ) {
    const partyId = this.party?.id;
    if (!partyId) {
      onChange([]);
      return () => {};
    }

    const pull = async () => {
      const { data } = await this.db()
        .from("game_progress")
        .select("user_id, attempts, solved, marks")
        .eq("party_id", partyId)
        .eq("kind", kind)
        .eq("day", day);
      onChange(
        (data ?? []).map((r) => ({
          userId: r.user_id as string,
          attempts: (r.attempts as number) ?? 0,
          solved: Boolean(r.solved),
          marks: (r.marks as string[]) ?? [],
        })),
      );
    };

    await pull();

    const ch = this.db()
      .channel(`game:${partyId}:${kind}:${day}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_progress",
          filter: `party_id=eq.${partyId}`,
        },
        () => void pull(),
      );
    ch.subscribe();

    return () => void ch.unsubscribe();
  }

  async saveGame(
    kind: string,
    day: string,
    progress: { attempts: number; solved: boolean; marks: string[] },
  ) {
    const partyId = this.party?.id;
    if (!partyId) return;
    const { error } = await this.db().from("game_progress").upsert(
      {
        party_id: partyId,
        user_id: this.meId,
        kind,
        day,
        attempts: progress.attempts,
        solved: progress.solved,
        marks: progress.marks,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "party_id,user_id,kind,day" },
    );
    if (error) throw error;
  }

  // ---------- 내 상태 ----------
  async updateMe(patch: MePatch) {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.background !== undefined) row.background = patch.background;
    if (patch.backgroundIsDark !== undefined)
      row.background_is_dark = patch.backgroundIsDark;
    if (patch.profile) {
      row.character_color = patch.profile.characterColor;
      row.photo = patch.profile.photo;
      row.shape = patch.profile.shape;
      row.crop = patch.profile.crop;
    }
    if (patch.message !== undefined) {
      row.status_text = patch.message?.text ?? null;
      row.status_emoji = patch.message?.emoji ?? null;
      row.status_expires_at = patch.message?.expiresAt
        ? new Date(patch.message.expiresAt).toISOString()
        : null;
    }
    if (Object.keys(row).length === 0) return;

    const { error } = await this.db()
      .from("profile")
      .update(row)
      .eq("id", this.meId);
    if (error) throw error;
    await this.refresh();
    this.emit();
  }

  async setPresence(status: Status, focusStartedAt: number | null) {
    if (!this.track) return;
    this.mine = { status, focus_started_at: focusStartedAt };
    await this.channel?.track(this.mine);
  }

  // ---------- 반응 ----------
  async addReaction(targetUserId: string, emoji: string) {
    if (!this.party) return;
    const statusId = this.statusIds[targetUserId];
    if (!statusId) return; // 상태 메시지가 없으면 붙일 데가 없다
    const { error } = await this.db().from("reaction").insert({
      party_id: this.party.id,
      target_user_id: targetUserId,
      target_status: statusId,
      emoji,
      by_user_id: this.meId,
    });
    // 중복(unique 위반)은 조용히 넘긴다
    if (error && !error.message.includes("duplicate")) throw error;
    await this.refresh();
    this.emit();
  }

  async removeReaction(targetUserId: string, emoji: string) {
    const { error } = await this.db()
      .from("reaction")
      .delete()
      .eq("target_user_id", targetUserId)
      .eq("emoji", emoji)
      .eq("by_user_id", this.meId);
    if (error) throw error;
    await this.refresh();
    this.emit();
  }

  async linkAccount() {
    await linkGitHub();
  }
}
