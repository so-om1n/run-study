import { useMemo, useState } from "react";
import type { Member, StatusMessage } from "../types";
import { MAX_MESSAGE_LENGTH, PALETTE, PROMPTS } from "../types";
import { EXPIRY_OPTIONS, formatExpiry } from "../lib/status";
import { Face } from "./Face";

interface Props {
  me: Member;
  defaultExpiryHours: number | null;
  /** 미리보기 아바타를 누르면 프로필 편집으로 넘어간다 */
  onEditProfile: () => void;
  onClose: () => void;
  onSave: (
    message: StatusMessage | null,
    background: string,
    backgroundIsDark: boolean,
  ) => void;
}

export function StatusModal({
  me,
  defaultExpiryHours,
  onEditProfile,
  onClose,
  onSave,
}: Props) {
  const [text, setText] = useState(me.message?.text ?? "");
  const [background, setBackground] = useState(me.background);
  const [isDark, setIsDark] = useState(me.backgroundIsDark);
  const [hours, setHours] = useState<number | null>(defaultExpiryHours);

  // 설정창을 열 때마다 질문 하나를 뽑는다. 본인 화면에서만 보인다.
  const prompt = useMemo(
    () => PROMPTS[Math.floor(Math.random() * PROMPTS.length)],
    [],
  );

  const expiresAt = hours === null ? null : Date.now() + hours * 3600_000;

  function pickImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setBackground(`url(${reader.result}) center/cover`);
        setIsDark(true);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">상태 설정하기</div>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="preview-card" style={{ background }}>
            <div className="pv-row">
              <button
                className="pv-blob-btn"
                onClick={onEditProfile}
                title="프로필 바꾸기"
              >
                <Face
                  profile={me.profile}
                  status={me.status}
                  className="pv-blob"
                  dotClassName="dot"
                />
                <span className="pv-edit">✎</span>
              </button>
              <div className="pv-bubble-outer">
                <div className="pv-bubble">
                  <div
                    className="bubble-text"
                    style={!text ? { color: "var(--ink-soft)" } : undefined}
                  >
                    {text || prompt}
                  </div>
                </div>
              </div>
            </div>
            <div className="pv-name" style={isDark ? { color: "#fff" } : undefined}>
              {me.name}
            </div>
            <div
              className="pv-handle"
              style={isDark ? { color: "rgba(255,255,255,.85)" } : undefined}
            >
              {me.handle}
            </div>
          </div>

          <div className="field-label">상태</div>
          <div className="input">
            <textarea
              rows={3}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder={prompt}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
          </div>
          <div className="counter">
            {text.length} / {MAX_MESSAGE_LENGTH}
          </div>

          <div className="field-label" style={{ marginTop: 14 }}>
            배경
          </div>
          <div className="swatches">
            {PALETTE.map((c) => (
              <button
                key={c}
                className={`sw${background === c ? " sel" : ""}`}
                style={{ background: c }}
                onClick={() => {
                  setBackground(c);
                  setIsDark(false);
                }}
              />
            ))}
            <button className="sw-img" onClick={pickImage}>
              ＋
            </button>
          </div>
        </div>

        <div className="modal-foot">
          <select
            className="sel-val"
            value={hours === null ? "null" : String(hours)}
            onChange={(e) =>
              setHours(e.target.value === "null" ? null : Number(e.target.value))
            }
          >
            {EXPIRY_OPTIONS.map((o) => (
              <option key={o.label} value={o.hours === null ? "null" : o.hours}>
                {o.hours === null ? "지우지 않음" : formatExpiry(Date.now() + o.hours * 3600_000)}
              </option>
            ))}
          </select>
          <button
            className="save"
            onClick={() =>
              onSave(
                text.trim()
                  ? { text: text.trim(), emoji: null, expiresAt }
                  : null,
                background,
                isDark,
              )
            }
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
