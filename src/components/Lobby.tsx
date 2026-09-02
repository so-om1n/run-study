import { useState } from "react";
import type { PartyBrief } from "../lib/presence";

interface Props {
  parties: PartyBrief[];
  currentId: string | null;
  onPick: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  onJoin: (code: string) => Promise<void>;
  onLeave: (id: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onInvite: (id: string) => void;
  /** 방이 하나라도 있을 때만 닫을 수 있다 */
  onClose: (() => void) | null;
}

type Mode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "join" }
  | { kind: "manage"; id: string };

/**
 * 방 목록·만들기·참여·관리.
 *
 * 첫 화면이 아니다. 팝오버를 열면 지금 있는 방이 바로 보이고, 로비는
 * 거기서 들어온다. 열자마자 방 목록이 덮으면 그게 디스코드 서버 목록이라
 * 이 앱이 피하려던 바로 그 무게가 된다.
 * 예외는 참여 중인 방이 하나도 없을 때 — 그때는 로비가 첫 화면이 된다.
 */
export function Lobby({
  parties,
  currentId,
  onPick,
  onCreate,
  onJoin,
  onLeave,
  onRename,
  onInvite,
  onClose,
}: Props) {
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [name, setName] = useState("우리끼리");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  async function run(fn: () => Promise<void>, then?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      then?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "잘 안 됐어요. 다시 해볼래요?");
    } finally {
      setBusy(false);
    }
  }

  const managed =
    mode.kind === "manage" ? parties.find((p) => p.id === mode.id) : undefined;

  function back() {
    setMode({ kind: "list" });
    setError(null);
    setConfirmLeave(false);
  }

  return (
    <div className="popover lobby">
      <div className="pop-head lobby-head">
        {mode.kind === "list" ? (
          <>
            <div className="lobby-title">내 방</div>
            {onClose && (
              <button className="icon-btn" onClick={onClose} title="닫기">
                ✕
              </button>
            )}
          </>
        ) : (
          <>
            <button className="icon-btn" onClick={back} title="뒤로">
              ‹
            </button>
            <div className="lobby-title">
              {mode.kind === "create"
                ? "방 만들기"
                : mode.kind === "join"
                  ? "코드로 참여"
                  : (managed?.name ?? "방 관리")}
            </div>
            <div style={{ width: 28 }} />
          </>
        )}
      </div>

      <div className="lobby-body">
        {mode.kind === "list" && (
          <>
            {parties.length === 0 && (
              <div className="lobby-empty">
                아직 들어간 방이 없어요.
                <br />
                방을 만들거나 친구한테 받은 코드로 들어가세요.
              </div>
            )}

            {parties.map((p) => (
              <div
                key={p.id}
                className={`room${p.id === currentId ? " cur" : ""}`}
              >
                <button className="room-main" onClick={() => onPick(p.id)}>
                  <div className="room-name">
                    {p.name}
                    {p.id === currentId && <span className="room-cur">보는 중</span>}
                  </div>
                  <div className="room-sub">
                    {p.memberCount}명 · {p.code}
                  </div>
                </button>
                <button
                  className="icon-btn"
                  title="방 관리"
                  onClick={() => setMode({ kind: "manage", id: p.id })}
                >
                  ⋯
                </button>
              </div>
            ))}

            <div className="lobby-actions">
              <button
                className="btn-full"
                onClick={() => setMode({ kind: "create" })}
              >
                방 만들기
              </button>
              <button
                className="btn-full sec"
                onClick={() => setMode({ kind: "join" })}
              >
                코드로 참여하기
              </button>
            </div>
          </>
        )}

        {mode.kind === "create" && (
          <>
            <div className="field-label">방 이름</div>
            <div className="input plain" style={{ marginBottom: 14 }}>
              <input
                value={name}
                maxLength={20}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            {error && <div className="form-error">{error}</div>}
            <button
              className="btn-full"
              disabled={busy}
              style={busy ? { opacity: 0.5 } : undefined}
              onClick={() => void run(() => onCreate(name), back)}
            >
              {busy ? "만드는 중…" : "만들기"}
            </button>
          </>
        )}

        {mode.kind === "join" && (
          <>
            <div className="field-label">초대 코드</div>
            <div className="input plain" style={{ marginBottom: 14 }}>
              <input
                placeholder="K7M2QX"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textAlign: "center",
                }}
              />
            </div>
            {error && <div className="form-error">{error}</div>}
            <button
              className="btn-full"
              disabled={code.length < 6 || busy}
              style={code.length < 6 || busy ? { opacity: 0.45 } : undefined}
              onClick={() => void run(() => onJoin(code), back)}
            >
              {busy ? "들어가는 중…" : "참여"}
            </button>
          </>
        )}

        {mode.kind === "manage" && managed && (
          <>
            <div className="field-label">방 이름</div>
            <div className="input plain" style={{ marginBottom: 6 }}>
              <input
                defaultValue={managed.name}
                maxLength={20}
                disabled={!managed.isOwner}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== managed.name)
                    void run(() => onRename(managed.id, v));
                }}
              />
            </div>
            <div className="lobby-hint">
              {managed.isOwner
                ? "방을 만든 사람만 이름을 바꿀 수 있어요"
                : "방을 만든 사람만 이름을 바꿀 수 있어요 (내 방이 아니에요)"}
            </div>

            <div className="list-item" style={{ marginTop: 6 }}>
              <div>
                <div className="li-main">초대 코드</div>
                <div className="li-sub">{managed.code}</div>
              </div>
              <button
                className="link-btn"
                onClick={() => onInvite(managed.id)}
              >
                초대
              </button>
            </div>

            {error && <div className="form-error">{error}</div>}

            {confirmLeave ? (
              <>
                <div className="lobby-warn">
                  이 방에서 나가면 친구들 화면에서도 사라져요.
                  {managed.isOwner && (
                    <>
                      <br />
                      방은 없어지지 않고 남은 사람끼리 계속 씁니다.
                    </>
                  )}
                </div>
                <button
                  className="btn-full danger"
                  disabled={busy}
                  onClick={() => void run(() => onLeave(managed.id), back)}
                >
                  {busy ? "나가는 중…" : "정말 나가기"}
                </button>
                <button
                  className="btn-full sec"
                  onClick={() => setConfirmLeave(false)}
                >
                  취소
                </button>
              </>
            ) : (
              <button
                className="btn-full sec danger-text"
                onClick={() => setConfirmLeave(true)}
              >
                이 방에서 나가기
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
