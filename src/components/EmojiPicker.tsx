import { useEffect, useRef, useState } from "react";

const RECENT_KEY = "runstudy.recentEmoji";

/** 항상 앞에 고정되는 기본 반응. 지워지지 않는다. */
const PINNED = ["❤️", "👍", "😄"];

/** 셀 안에서 한 줄로 보일 수 있는 한계. 카오모지 `꒰ ′ ꈊ̮ ‵ ꒱` 가 11자다. */
export const MAX_REACTION_LENGTH = 16;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function pushRecent(value: string) {
  try {
    const next = [value, ...loadRecent().filter((e) => e !== value)].slice(0, 24);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* 저장 실패해도 그만 */
  }
}

interface Props {
  onPick: (value: string) => void;
  onClose: () => void;
}

/**
 * 이모지든 카오모지든 짧은 텍스트든 그대로 단다.
 * 목록을 두지 않고, 입력창 + 최근 쓴 것만으로 굴린다.
 * (맥에서는 입력창에 포커스가 있을 때 ⌃⌘Space 로 시스템 이모지 창이 열린다)
 */
export function EmojiPicker({ onPick, onClose }: Props) {
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const value = q.trim().slice(0, MAX_REACTION_LENGTH);

  function commit(v: string) {
    const t = v.trim().slice(0, MAX_REACTION_LENGTH);
    if (!t) return;
    pushRecent(t);
    setRecent(loadRecent());
    onPick(t);
  }

  function removeRecent(v: string, e: React.MouseEvent) {
    e.stopPropagation();
    const next = loadRecent().filter((x) => x !== v);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* 무시 */
    }
    setRecent(next);
  }

  return (
    <div className="overlay" onMouseDown={onClose} style={{ zIndex: 60 }}>
      <div
        className="modal emoji-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div className="modal-title">반응 달기</div>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="input">
            <input
              ref={inputRef}
              placeholder="이모지 · 카오모지 · 짧은 텍스트"
              value={q}
              maxLength={MAX_REACTION_LENGTH}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && value) commit(value);
              }}
              style={{ fontSize: 17 }}
            />
            <button
              className="emoji-commit"
              onClick={() => commit(value)}
              disabled={!value}
              style={!value ? { opacity: 0.35 } : undefined}
              title="달기"
            >
              ↵
            </button>
          </div>
          <div className="counter">
            {q.length} / {MAX_REACTION_LENGTH}
          </div>

          <div className="field-label" style={{ marginTop: 10 }}>
            내 반응
          </div>
          <div className="recent-list">
            {PINNED.map((e) => (
              <button
                key={`pin-${e}`}
                className="recent-chip pinned"
                onClick={() => commit(e)}
              >
                <span>{e}</span>
              </button>
            ))}
            {recent
              .filter((e) => !PINNED.includes(e))
              .map((e, i) => (
                <button
                  key={`${e}-${i}`}
                  className="recent-chip"
                  onClick={() => commit(e)}
                >
                  <span>{e}</span>
                  <i onClick={(ev) => removeRecent(e, ev)} title="목록에서 지우기">
                    ✕
                  </i>
                </button>
              ))}
          </div>
          {recent.filter((e) => !PINNED.includes(e)).length === 0 && (
            <div className="empty-hint">달았던 반응이 뒤에 쌓여요</div>
          )}
        </div>
      </div>
    </div>
  );
}
