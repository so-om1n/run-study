import { useState } from "react";
import type { Party } from "../types";

interface Props {
  party: Party;
  onClose: () => void;
}

/**
 * 초대 코드를 보여주고 복사시킨다.
 *
 * 파티를 만든 직후 자동으로 열린다. 코드를 어디서도 볼 수 없으면
 * 파티를 만들어놓고 친구를 못 부르는 상태가 된다.
 */
export function InviteModal({ party, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(party.code);
    } catch {
      // 클립보드 권한이 없거나 보안 컨텍스트가 아닐 때의 옛날 방식
      const ta = document.createElement("textarea");
      ta.value = party.code;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* 그래도 안 되면 눈으로 보고 치는 수밖에 */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">친구 초대</div>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="invite-lead">
            <b>{party.name}</b> 에 들어올 수 있는 코드예요.
            <br />
            친구가 앱에서 <b>코드로 참여하기</b> 를 누르고 넣으면 돼요.
          </div>

          <button className="invite-code" onClick={() => void copy()}>
            <span className="invite-code-text">{party.code}</span>
            <span className="invite-code-hint">
              {copied ? "복사됐어요" : "눌러서 복사"}
            </span>
          </button>

          <div className="invite-note">
            지금 {party.members.length}명 · 코드는 바뀌지 않아요
          </div>
        </div>
      </div>
    </div>
  );
}
