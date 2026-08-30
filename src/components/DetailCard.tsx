import { useState } from "react";
import type { Member, StickerGroup } from "../types";
import { STATUS_LABEL, formatDuration } from "../lib/status";
import { Face } from "./Face";
import { EmojiPicker } from "./EmojiPicker";

interface Props {
  member: Member;
  now: number;
  stickers: StickerGroup[];
  onAddReaction: (emoji: string) => void;
  /** 남이 단 반응을 눌렀을 때 — 나도 같은 반응 */
  onPlusReaction: (emoji: string) => void;
  /** 내가 단 것을 눌렀을 때 — 뗄지 물어본다 */
  onRemoveReaction: (emoji: string) => void;
  onClose: () => void;
}

/**
 * 남의 셀을 누르면 뜨는 카드.
 * 셀에서 2줄로 잘린 상태 메시지 전문이 여기서 보이고, 반응도 여기서 단다.
 * 반응은 고정 목록이 아니라 + 로 원하는 이모지를 골라서 단다.
 */
export function DetailCard({
  member,
  now,
  stickers,
  onAddReaction,
  onPlusReaction,
  onRemoveReaction,
  onClose,
}: Props) {
  const [picking, setPicking] = useState(false);

  const focusFor =
    member.focusStartedAt !== null
      ? formatDuration((now - member.focusStartedAt) / 1000)
      : null;

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="detail" onMouseDown={(e) => e.stopPropagation()}>
        <button className="icon-btn d-close" onClick={onClose} title="닫기">
          ✕
        </button>
        <div className="d-top" style={{ background: member.background }} />
        <div className="d-body">
          <div className="d-blob">
            <div className="inner">
              <Face profile={member.profile} className="inner" />
            </div>
            <span
              className="d-dot"
              style={{
                background:
                  member.status === "online"
                    ? "var(--green)"
                    : member.status === "focus"
                      ? "var(--red)"
                      : "var(--gray)",
              }}
            />
          </div>

          <div className="d-name">{member.name}</div>
          <div className="d-handle">
            {member.handle} · {STATUS_LABEL[member.status]}
            {focusFor ? ` · ${focusFor}` : ""}
          </div>

          <div className="d-block">
            <div className="d-key">상태 메시지</div>
            <div className="d-val">
              {member.message?.text ?? (
                <span style={{ color: "var(--ink-soft)" }}>없음</span>
              )}
            </div>
          </div>

          {member.message?.text && (
            <div className="d-block">
              <div className="d-key">반응</div>
              <div className="reactions" style={{ marginTop: 0 }}>
                {stickers.map((g) => (
                  <button
                    key={g.emoji}
                    className={`rx${g.mine ? " active" : ""}`}
                    title={`${g.byNames.join(", ")}님이 반응했어요`}
                    onClick={() =>
                      g.mine ? onRemoveReaction(g.emoji) : onPlusReaction(g.emoji)
                    }
                  >
                    {g.emoji} <span>{g.count}</span>
                  </button>
                ))}
                <button
                  className="rx rx-add"
                  onClick={() => setPicking(true)}
                  title="반응 달기"
                >
                  ＋
                </button>
              </div>
              {stickers.length > 0 && (
                <div className="rx-who">
                  {stickers.map((g) => (
                    <div key={g.emoji}>
                      {g.emoji} <b>{g.byNames.join(", ")}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="d-block">
            <div className="d-key">파티 가입일</div>
            <div className="d-val">{member.joinedAt}</div>
          </div>
        </div>
      </div>

      {picking && (
        <EmojiPicker
          onPick={(e) => {
            onAddReaction(e);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
