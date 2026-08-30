interface Props {
  /** 뗄 반응 — 무엇을 지우는지 위에 보여준다 */
  preview?: string;
  label?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 반응 떼기 확인.
 * 글자 없이 쓰레기통 하나. 기본은 닫힌 뚜껑, 올리면 열린다.
 * 쓰레기통을 누르면 떼고, 바깥을 누르면 취소.
 *
 * 시스템 confirm() 을 쓰면 팝오버가 포커스를 잃어 사라지기 때문에 직접 만든다.
 */
export function ConfirmDialog({
  preview,
  label = "반응 떼기",
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="overlay" onMouseDown={onCancel} style={{ zIndex: 70 }}>
      <div
        className="modal confirm-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {preview && <div className="confirm-preview">{preview}</div>}
        <button className="trash-btn" onClick={onConfirm} title={label} aria-label={label}>
          <svg className="t-closed" viewBox="0 0 24 24" width="26" height="26">
            <rect
              x="9"
              y="2"
              width="6"
              height="3.4"
              rx="1.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
            />
            <rect x="2.8" y="4.9" width="18.4" height="2.9" rx="1.45" fill="currentColor" />
            <path
              d="M4.9 9.1h14.2l-1.25 11.3a1.6 1.6 0 0 1-1.6 1.42H7.75a1.6 1.6 0 0 1-1.6-1.42L4.9 9.1Z"
              fill="currentColor"
            />
            <rect x="8.5" y="11.4" width="1.7" height="7.6" rx=".85" fill="#fff" />
            <rect x="11.15" y="11.4" width="1.7" height="7.6" rx=".85" fill="#fff" />
            <rect x="13.8" y="11.4" width="1.7" height="7.6" rx=".85" fill="#fff" />
          </svg>

          <svg className="t-open" viewBox="0 0 24 24" width="26" height="26">
            <g transform="rotate(-20 12 6.4) translate(-1.1 -1.5)">
              <rect
                x="9"
                y="2"
                width="6"
                height="3.4"
                rx="1.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
              />
              <rect x="2.8" y="4.9" width="18.4" height="2.9" rx="1.45" fill="currentColor" />
            </g>
            <path d="M12.4 8.5h6.9a6.4 6.4 0 0 0-.85-2.7L12.4 8.5Z" fill="currentColor" />
            <path
              d="M4.9 9.6h14.2l-1.25 10.8a1.6 1.6 0 0 1-1.6 1.42H7.75a1.6 1.6 0 0 1-1.6-1.42L4.9 9.6Z"
              fill="currentColor"
            />
            <rect x="8.5" y="11.8" width="1.7" height="7.2" rx=".85" fill="#fff" />
            <rect x="11.15" y="11.8" width="1.7" height="7.2" rx=".85" fill="#fff" />
            <rect x="13.8" y="11.8" width="1.7" height="7.2" rx=".85" fill="#fff" />
            <path
              d="M21.4 3.2v1.5h1.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M22.8 8.2h-1.4v1.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
