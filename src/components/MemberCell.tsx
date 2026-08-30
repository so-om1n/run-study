import { useEffect, useRef } from "react";
import type { Member, StickerGroup } from "../types";
import { Face } from "./Face";

interface Props {
  member: Member;
  /** 이 사람의 상태 메시지에 달린 반응들 */
  stickers?: StickerGroup[];
  onClick: () => void;
  /** 더블클릭하면 하트 하나 */
  onDoubleClick?: () => void;
  /** 내가 단 반응을 눌렀을 때 (떼기 확인) */
  onStickerRemove?: (emoji: string) => void;
  /** 남이 단 반응을 눌렀을 때 (나도 같은 반응) */
  onStickerAdd?: (emoji: string) => void;
  /** hover 로 나오는 반응 버튼. 팔레트를 띄울 위치를 넘긴다 */
  onReactClick?: (rect: DOMRect) => void;
  /** 이 셀의 팔레트가 열려 있는지 */
  paletteOpen?: boolean;
}

/**
 * 격자 한 칸.
 *  - 말풍선 자리는 높이 고정. 상태 메시지가 없으면 빈 공간으로 남는다.
 *  - 말풍선은 반투명 흰 카드라 어떤 배경색/이미지 위에서도 읽힌다.
 *  - 반응 스티커는 상태 메시지(말풍선) 위에만 붙는다.
 *  - 오프라인이면 얼굴을 흐리게.
 */
export function MemberCell({
  member,
  stickers: incoming,
  onClick,
  onDoubleClick,
  onStickerRemove,
  onStickerAdd,
  onReactClick,
  paletteOpen,
}: Props) {
  const offline = member.status === "offline";
  const hasMessage = Boolean(member.message?.text);
  const stickers = hasMessage ? (incoming ?? []) : [];

  // 스티커가 몇 줄을 차지할지 대략 계산해서 그만큼만 위를 비운다.
  // (개수로 세면 짧은 이모지 2개도 2줄로 잡혀 빈 공간이 생긴다)
  const INNER_W = 97; // 셀 113 - 좌우 여백
  const estWidth = stickers.reduce(
    (w, g) => w + 15 + [...g.emoji].length * 6.2 + (g.count > 1 ? 8 : 0) + 3,
    0,
  );
  const lines = stickers.length
    ? Math.min(3, Math.max(1, Math.ceil(estWidth / INNER_W)))
    : 0;

  // 한 번 클릭(상세/상태창)과 두 번 클릭(하트)을 구분한다.
  // 지연 없이 두면 더블클릭 때 창이 먼저 열려버린다.
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  function handleClick() {
    if (!onDoubleClick) {
      onClick();
      return;
    }
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      onClick();
    }, 220);
  }

  function handleDoubleClick() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    onDoubleClick?.();
  }

  return (
    <button
      className={`cell${offline ? " offline" : ""}${lines ? ` st-l${lines}` : ""}`}
      style={{ background: member.background }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {stickers.length > 0 && (
        <div className="stickers">
          {stickers.map((g) => (
            <span
              key={g.emoji}
              className={`sticker${g.mine ? " mine" : ""}`}
              title={`${g.byNames.join(", ")}님이 반응했어요`}
              onClick={(e) => {
                // 셀 클릭(창 열기)까지 같이 터지면 안 된다
                e.stopPropagation();
                if (g.mine) onStickerRemove?.(g.emoji);
                else onStickerAdd?.(g.emoji);
              }}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              {g.emoji}
              {g.count > 1 && <b>{g.count}</b>}
            </span>
          ))}
        </div>
      )}
      <div className="bubble-slot">
        {member.message?.text ? (
          /* bubble-outer 가 flex 자식 역할을 맡는다.
             clamp 대상(.bubble)이 직접 flex 자식이 되면 -webkit-box 가
             blockify 되면서 2줄 자르기가 깨진다. */
          <div className="bubble-outer">
            <div className="bubble">
              <div className="bubble-text">
                {member.message.emoji ? `${member.message.emoji} ` : ""}
                {member.message.text}
              </div>
            </div>
          </div>
        ) : null}
      </div>
      {hasMessage && onReactClick && (
        <span
          className={`react-btn${paletteOpen ? " open" : ""}`}
          role="button"
          title="반응 달기"
          onClick={(e) => {
            e.stopPropagation();
            onReactClick(e.currentTarget.getBoundingClientRect());
          }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          ♡
        </span>
      )}
      <div className="av-wrap">
        <Face profile={member.profile} status={member.status} />
      </div>
      <div
        className="cell-name"
        style={member.backgroundIsDark ? { color: "#fff" } : undefined}
      >
        {member.name}
      </div>
    </button>
  );
}
