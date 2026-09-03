import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ManualStatus,
  Party,
  Profile,
  Reaction,
  Settings,
  StatusMessage,
  StickerGroup,
} from "./types";
import type { MePatch, PartyBrief, PresenceClient } from "./lib/presence";
import { createPresence } from "./lib/presence";
import { formatDuration, resolveStatus } from "./lib/status";
import {
  onTrayMenu,
  setAutoHide,
  hidePopover,
  openGameWindow,
  setAutoLaunch,
  setFocusMode,
  updateTrayCount,
} from "./lib/tauri";
import { Face } from "./components/Face";
import { MemberCell } from "./components/MemberCell";
import { StatusModal } from "./components/StatusModal";
import { ProfileModal } from "./components/ProfileModal";
import { DetailCard } from "./components/DetailCard";
import { SettingsModal } from "./components/SettingsModal";
import { Onboarding } from "./components/Onboarding";
import { InviteModal } from "./components/InviteModal";
import { Lobby } from "./components/Lobby";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ReactionPalette } from "./components/ReactionPalette";

/** 더블클릭으로 붙는 기본 반응 */
const HEART = "❤️";

const LS = {
  manual: "runstudy.manualStatus",
  settings: "runstudy.settings",
};

const DEFAULT_SETTINGS: Settings = {
  autoLaunch: true,
  muteNotifications: true,
  defaultExpiryHours: 24,
  releaseFocusOnTimerEnd: true,
  shortcutName: "run study 집중",
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 안 돼도 앱은 돌아가야 한다 */
  }
}

type Modal =
  | { kind: "none" }
  | { kind: "status" }
  | { kind: "profile" }
  | { kind: "settings" }
  | { kind: "invite" }
  | { kind: "detail"; memberId: string };

export default function App() {
  const [client, setClient] = useState<PresenceClient | null>(null);
  const [fatal, setFatal] = useState<{ error: string; hint?: string } | null>(
    null,
  );
  const [party, setParty] = useState<Party | null>(null);
  const [parties, setParties] = useState<PartyBrief[]>([]);
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  /** 로비를 보고 있는지. 방이 하나도 없으면 강제로 열린다 */
  const [lobbyOpen, setLobbyOpen] = useState(false);

  const [modal, setModal] = useState<Modal>({ kind: "none" });
  const [now, setNow] = useState(Date.now());

  // 수동 오프라인은 앱을 껐다 켜도 유지된다.
  const [manual, setManual] = useState<ManualStatus>(() =>
    load<ManualStatus>(LS.manual, null),
  );
  // 타이머로 진입한 집중 중. 타이머가 끝나면 자동 해제된다.
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings>(() =>
    load(LS.settings, DEFAULT_SETTINGS),
  );

  const [pendingRemove, setPendingRemove] = useState<{
    memberId: string;
    emoji: string;
  } | null>(null);
  const [palette, setPalette] = useState<{
    memberId: string;
    left: number;
    top: number;
  } | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);
  const myStatus = resolveStatus(manual, timerStartedAt !== null);
  const prevFocus = useRef(myStatus === "focus");

  /* ---------- 접속 (Supabase 또는 목) ---------- */
  useEffect(() => {
    let stop: (() => void) | undefined;
    let alive = true;

    void createPresence().then(async (result) => {
      if (!alive) return;
      if (!result.ok) {
        setFatal({ error: result.error, hint: result.hint });
        return;
      }
      setClient(result.client);
      try {
        const off = await result.client.start((snap) => {
          setParty(snap.party);
          setParties(snap.parties);
          setReactions(snap.reactions);
        });
        if (alive) stop = off;
        else off();
      } catch (e) {
        if (alive)
          setFatal({
            error: e instanceof Error ? e.message : "파티를 불러오지 못했어요",
            hint: "supabase/schema.sql 을 실행했는지, RLS 정책이 올라갔는지 확인해 주세요",
          });
      }
    });

    return () => {
      alive = false;
      stop?.();
    };
  }, []);

  /* ---------- 내 상태를 파티에 알림 ---------- */
  useEffect(() => {
    void client?.setPresence(myStatus, timerStartedAt);
  }, [client, myStatus, timerStartedAt]);

  /* ---------- 1초 틱 (누군가 집중 중일 때만) ---------- */
  const anyFocus =
    party?.members.some((m) => m.focusStartedAt !== null) ?? false;
  useEffect(() => {
    if (!anyFocus && timerStartedAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [anyFocus, timerStartedAt]);

  /* ---------- 집중 중 진입/이탈 시 macOS 집중 모드 ---------- */
  useEffect(() => {
    const isFocus = myStatus === "focus";
    if (isFocus !== prevFocus.current) {
      prevFocus.current = isFocus;
      if (settings.muteNotifications) {
        void setFocusMode(isFocus, settings.shortcutName);
      }
    }
  }, [myStatus, settings.muteNotifications, settings.shortcutName]);

  /* ---------- 트레이 우클릭 메뉴 ---------- */
  useEffect(() => {
    return onTrayMenu((id) => {
      switch (id) {
        case "online":
          setManual(null);
          setTimerStartedAt(null);
          break;
        case "focus":
          setManual("focus");
          break;
        case "offline":
          setManual("offline");
          break;
        case "status_message":
          setModal({ kind: "status" });
          break;
        case "settings":
          setModal({ kind: "settings" });
          break;
      }
    });
  }, []);

  useEffect(() => {
    if (!party) return;
    void updateTrayCount(
      party.members.filter((m) => m.status !== "offline").length,
    );
  }, [party]);

  /* ---------- 모달이 떠 있으면 팝오버가 스스로 닫히지 않게 ---------- */
  const canAutoHide =
    modal.kind === "none" && pendingRemove === null && palette === null;

  useEffect(() => {
    void setAutoHide(canAutoHide);
  }, [canAutoHide]);

  /* ---------- 창이 포커스를 잃으면 닫는다 (웹뷰 쪽 안전망) ----------
   * 네이티브 이벤트만 믿으면, 앱이 활성화되지 않아 창이 키 윈도우가 되지
   * 못한 경우 blur 이 영영 안 와서 팝오버가 계속 떠 있는다. 웹뷰가 보는
   * blur 로도 닫을 수 있게 길을 하나 더 낸다. 러스트 쪽에서도 같은
   * 조건으로 한 번 더 거른다. */
  useEffect(() => {
    if (!canAutoHide) return;
    const onBlur = () => void hidePopover();
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [canAutoHide]);

  /* ---------- Esc 로 언제나 닫을 수 있게 ----------
   * 포커스 신호가 안 오는 환경에서는 위의 자동 숨김이 전부 실패한다.
   * 그때 팝오버가 화면에 박혀 있으면 끌 방법이 없으므로, 어떤 경로로도
   * 확실히 닫히는 손잡이를 하나 남긴다. 모달이 떠 있으면 모달만 닫는다. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (palette) return setPalette(null);
      if (pendingRemove) return setPendingRemove(null);
      if (modal.kind !== "none") return setModal({ kind: "none" });
      if (lobbyOpen && party) return setLobbyOpen(false);
      void hidePopover();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal.kind, pendingRemove, palette, lobbyOpen, party]);

  useEffect(() => save(LS.manual, manual), [manual]);
  useEffect(() => save(LS.settings, settings), [settings]);

  const patchMe = useCallback(
    (patch: MePatch) => void client?.updateMe(patch),
    [client],
  );

  if (fatal) {
    return (
      <div className="popover">
        <div className="fatal">
          <div className="fatal-ic">⚠️</div>
          <h4>연결하지 못했어요</h4>
          <p className="fatal-msg">{fatal.error}</p>
          {fatal.hint && <p className="fatal-hint">{fatal.hint}</p>}
          <button
            className="btn-full sec"
            onClick={() => window.location.reload()}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!client) return <div className="popover" />;
  const c = client;

  /* ---------- 방이 하나도 없으면 소개 → 첫 방 만들기 ---------- */
  if (!party && parties.length === 0 && !lobbyOpen) {
    return (
      <Onboarding
        onCreate={async (partyName, myName) => {
          // 이름을 먼저 올린다. 파티에 들어간 뒤에 올리면 친구 화면에
          // "이름 없음"이 잠깐이라도 보인다.
          await c.updateMe({ name: myName });
          await c.createParty(partyName);
          // 만들자마자 코드를 보여준다. 여기서 안 보여주면 파티는
          // 만들었는데 친구를 부를 방법이 없는 상태가 된다.
          setModal({ kind: "invite" });
        }}
        onJoin={async (code, myName) => {
          await c.updateMe({ name: myName });
          await c.joinParty(code);
        }}
      />
    );
  }

  /* ---------- 로비 ----------
   * 첫 화면이 아니다. 팝오버를 열면 지금 있는 방이 바로 보이고, 로비는
   * 헤더에서 들어온다. 방이 하나도 없을 때만 로비가 첫 화면이 된다. */
  if (lobbyOpen || !party) {
    return (
      <>
        <Lobby
          parties={parties}
          currentId={party?.id ?? null}
          onPick={(id) => {
            void c.switchParty(id);
            setLobbyOpen(false);
          }}
          onCreate={async (name) => {
            await c.createParty(name);
            setLobbyOpen(false);
            setModal({ kind: "invite" });
          }}
          onJoin={async (code) => {
            await c.joinParty(code);
            setLobbyOpen(false);
          }}
          onLeave={(id) => c.leaveParty(id)}
          onRename={(id, name) => c.renameParty(id, name)}
          onInvite={(id) => {
            void c.switchParty(id);
            setLobbyOpen(false);
            setModal({ kind: "invite" });
          }}
          onClose={party ? () => setLobbyOpen(false) : null}
        />
        {modal.kind === "invite" && party && (
          <InviteModal
            party={party}
            onClose={() => setModal({ kind: "none" })}
          />
        )}
      </>
    );
  }

  const me = party.members.find((m) => m.id === c.meId);
  const onlineCount = party.members.filter((m) => m.status !== "offline").length;
  const canLink = c.isLive() && c.isAnonymous();

  const nameOf = (id: string) =>
    party.members.find((m) => m.id === id)?.name ?? "알 수 없음";

  /** 셀·상세카드에 그릴 반응 묶음 (같은 이모지끼리 합침) */
  function stickersFor(memberId: string): StickerGroup[] {
    const list = reactions[memberId] ?? [];
    const order: string[] = [];
    const map = new Map<string, Reaction[]>();
    for (const r of list) {
      if (!map.has(r.emoji)) {
        map.set(r.emoji, []);
        order.push(r.emoji);
      }
      map.get(r.emoji)!.push(r);
    }
    return order.map((emoji) => {
      const rs = map.get(emoji)!;
      return {
        emoji,
        count: rs.length,
        byNames: rs.map((r) => nameOf(r.by)),
        mine: rs.some((r) => r.by === c.meId),
      };
    });
  }

  /**
   * 팔레트를 ♡ 버튼 위에 띄운다.
   * 팝오버가 382px 밖에 안 돼서 가장자리 셀에서는 밖으로 나가므로,
   * 좌우를 팝오버 안쪽으로 눌러준다.
   */
  function openPalette(memberId: string, btn: DOMRect) {
    const host = popoverRef.current?.getBoundingClientRect();
    if (!host) return;
    const PALETTE_W = 245;
    const raw = btn.left - host.left + btn.width / 2 - PALETTE_W / 2;
    const left = Math.min(Math.max(8, raw), host.width - PALETTE_W - 8);
    setPalette({ memberId, left, top: Math.max(8, btn.top - host.top - 46) });
  }

  function startTimer() {
    setTimerStartedAt(Date.now());
  }

  function stopTimer() {
    setTimerStartedAt(null);
    // 들어온 문으로 나간다 — 타이머로 켠 집중 중만 여기서 풀린다.
    if (!settings.releaseFocusOnTimerEnd && manual === null) {
      setManual("focus");
    }
  }

  const detailMember =
    modal.kind === "detail"
      ? party.members.find((m) => m.id === modal.memberId)
      : undefined;

  return (
    <div className="popover" ref={popoverRef}>
      <div className="pop-head">
        <button
          className="me-av"
          onClick={() => setModal({ kind: "status" })}
          title="내 상태"
        >
          {me && (
            <Face
              profile={me.profile}
              status={myStatus}
              className="me-av"
              dotClassName="dot"
            />
          )}
        </button>
        <div className="me-info">
          {me?.name === "이름 없음" ? (
            /* 이름을 한 번도 안 정한 사람. 친구 화면에도 "이름 없음"으로
               떠 있는 상태라 여기서 바로 눈에 띄게 해준다 */
            <button
              className="me-name needs-name"
              onClick={() => setModal({ kind: "profile" })}
            >
              이름 설정하기
            </button>
          ) : (
            <div className="me-name">{me?.name ?? "나"}</div>
          )}
          <div
            className="me-status"
            onClick={() => setModal({ kind: "status" })}
          >
            {me?.message?.text ?? "상태 메시지 남기기"}
          </div>
        </div>
        <button
          className="icon-btn"
          onClick={() => void openGameWindow()}
          title="미니게임"
        >
          🎮
        </button>
        <button
          className="icon-btn"
          onClick={() => setModal({ kind: "invite" })}
          title="친구 초대"
        >
          ＋
        </button>
        <button
          className="icon-btn"
          onClick={() => setModal({ kind: "settings" })}
          title="설정"
        >
          ⚙
        </button>
      </div>

      <div className="grid">
        {party.members.map((m) => (
          <MemberCell
            key={m.id}
            member={m.id === c.meId ? { ...m, status: myStatus } : m}
            stickers={stickersFor(m.id)}
            onClick={() =>
              setModal(
                m.id === c.meId
                  ? { kind: "status" }
                  : { kind: "detail", memberId: m.id },
              )
            }
            onDoubleClick={() => {
              if (m.message?.text) void c.addReaction(m.id, HEART);
            }}
            onStickerRemove={(emoji) =>
              setPendingRemove({ memberId: m.id, emoji })
            }
            onStickerAdd={(emoji) => void c.addReaction(m.id, emoji)}
            onReactClick={(rect) => openPalette(m.id, rect)}
            paletteOpen={palette?.memberId === m.id}
          />
        ))}
      </div>

      <div className="pop-foot">
        {timerStartedAt === null ? (
          <button className="timer-btn" onClick={startTimer}>
            ▶ 집중 시작
          </button>
        ) : (
          <div className="timer-live">
            <div>
              <div className="timer-num">
                {formatDuration((now - timerStartedAt) / 1000)}
              </div>
              <div className="timer-lbl">
                집중 중{settings.muteNotifications ? " · 알림 꺼짐" : ""}
              </div>
            </div>
            <button className="stop" onClick={stopTimer}>
              ■
            </button>
          </div>
        )}
        <div className="foot-meta">
          {!c.isLive() && <span className="mock-tag">목 데이터</span>}
          {/* 방 이름이 곧 로비 입구. 지금 어느 방을 보고 있는지도 여기서 알 수 있다 */}
          <button className="room-pill" onClick={() => setLobbyOpen(true)}>
            {party.name}
            {parties.length > 1 && (
              <span className="room-pill-n">{parties.length}</span>
            )}
          </button>
          <span className="foot-count">{onlineCount}명</span>
        </div>
      </div>

      {palette && (
        <ReactionPalette
          left={palette.left}
          top={palette.top}
          onPick={(e) => {
            void c.addReaction(palette.memberId, e);
            setPalette(null);
          }}
          onMore={() => {
            setModal({ kind: "detail", memberId: palette.memberId });
            setPalette(null);
          }}
          onClose={() => setPalette(null)}
        />
      )}

      {pendingRemove && (
        <ConfirmDialog
          preview={pendingRemove.emoji}
          onCancel={() => setPendingRemove(null)}
          onConfirm={() => {
            void c.removeReaction(pendingRemove.memberId, pendingRemove.emoji);
            setPendingRemove(null);
          }}
        />
      )}

      {modal.kind === "status" && me && (
        <StatusModal
          me={{ ...me, status: myStatus }}
          defaultExpiryHours={settings.defaultExpiryHours}
          onEditProfile={() => setModal({ kind: "profile" })}
          onClose={() => setModal({ kind: "none" })}
          onSave={(message: StatusMessage | null, background, isDark) => {
            patchMe({ message, background, backgroundIsDark: isDark });
            setModal({ kind: "none" });
          }}
        />
      )}

      {modal.kind === "profile" && me && (
        <ProfileModal
          profile={me.profile}
          name={me.name}
          onClose={() => setModal({ kind: "none" })}
          onBack={() => setModal({ kind: "status" })}
          onSave={(profile: Profile, name: string) => {
            patchMe({ profile, name });
            setModal({ kind: "status" });
          }}
        />
      )}

      {modal.kind === "invite" && (
        <InviteModal party={party} onClose={() => setModal({ kind: "none" })} />
      )}

      {modal.kind === "settings" && (
        <SettingsModal
          settings={settings}
          party={party}
          canLinkAccount={canLink}
          onLinkAccount={() => void c.linkAccount()}
          onInvite={() => setModal({ kind: "invite" })}
          onOpenLobby={() => {
            setModal({ kind: "none" });
            setLobbyOpen(true);
          }}
          onChange={(patch) => {
            setSettings((s) => {
              if (patch.autoLaunch !== undefined)
                void setAutoLaunch(patch.autoLaunch);
              return { ...s, ...patch };
            });
          }}
          onClose={() => setModal({ kind: "none" })}
        />
      )}

      {detailMember && (
        <DetailCard
          member={detailMember}
          now={now}
          stickers={stickersFor(detailMember.id)}
          onAddReaction={(e) => void c.addReaction(detailMember.id, e)}
          onPlusReaction={(e) => void c.addReaction(detailMember.id, e)}
          onRemoveReaction={(e) =>
            setPendingRemove({ memberId: detailMember.id, emoji: e })
          }
          onClose={() => setModal({ kind: "none" })}
        />
      )}
    </div>
  );
}
