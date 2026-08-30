/** 빠른 반응 6개. 그 외에는 ＋ 로 반응 달기 창을 연다. */
export const QUICK_REACTIONS = ["❤️", "👍", "😄", "🔥", "👀", "💪"];

interface Props {
  /** 팝오버 기준 좌표 */
  left: number;
  top: number;
  onPick: (emoji: string) => void;
  onMore: () => void;
  onClose: () => void;
}

export function ReactionPalette({ left, top, onPick, onMore, onClose }: Props) {
  return (
    <>
      {/* 바깥을 누르면 닫히도록 투명 판을 깐다 */}
      <div className="palette-catch" onMouseDown={onClose} />
      <div className="palette" style={{ left, top }}>
        {QUICK_REACTIONS.map((e) => (
          <button key={e} className="palette-item" onClick={() => onPick(e)}>
            {e}
          </button>
        ))}
        <button className="palette-item more" onClick={onMore} title="더 고르기">
          ＋
        </button>
      </div>
    </>
  );
}
