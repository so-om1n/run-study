import type { Party, Settings } from "../types";
import { EXPIRY_OPTIONS } from "../lib/status";
import { isMac } from "../lib/tauri";

interface Props {
  settings: Settings;
  party: Party;
  /** 익명 계정일 때만 노출 */
  canLinkAccount: boolean;
  onLinkAccount: () => void;
  onInvite: () => void;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

export function SettingsModal({
  settings,
  party,
  canLinkAccount,
  onLinkAccount,
  onInvite,
  onChange,
  onClose,
}: Props) {
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">설정</div>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="list-item">
            <div>
              <div className="li-main">컴퓨터 켤 때 자동 실행</div>
            </div>
            <button
              className={`toggle${settings.autoLaunch ? " on" : ""}`}
              onClick={() => onChange({ autoLaunch: !settings.autoLaunch })}
            />
          </div>

          {isMac() && (
            <div className="list-item">
              <div>
                <div className="li-main">집중 중일 때 알림 끄기</div>
                <div className="li-sub">
                  macOS 집중 모드 단축어 "{settings.shortcutName}" 실행
                </div>
              </div>
              <button
                className={`toggle${settings.muteNotifications ? " on" : ""}`}
                onClick={() =>
                  onChange({ muteNotifications: !settings.muteNotifications })
                }
              />
            </div>
          )}

          <div className="list-item">
            <div>
              <div className="li-main">상태 메시지 기본 만료</div>
            </div>
            <select
              className="sel-val"
              value={
                settings.defaultExpiryHours === null
                  ? "null"
                  : String(settings.defaultExpiryHours)
              }
              onChange={(e) =>
                onChange({
                  defaultExpiryHours:
                    e.target.value === "null" ? null : Number(e.target.value),
                })
              }
            >
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.label} value={o.hours === null ? "null" : o.hours}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="list-item">
            <div>
              <div className="li-main">타이머 종료 시 집중 중 해제</div>
              <div className="li-sub">수동으로 켠 집중 중은 유지됩니다</div>
            </div>
            <button
              className={`toggle${settings.releaseFocusOnTimerEnd ? " on" : ""}`}
              onClick={() =>
                onChange({
                  releaseFocusOnTimerEnd: !settings.releaseFocusOnTimerEnd,
                })
              }
            />
          </div>

          <div className="list-item">
            <div>
              <div className="li-main">파티</div>
              <div className="li-sub">
                {party.name} · {party.members.length}명 · 코드 {party.code}
              </div>
            </div>
            <button className="link-btn" onClick={onInvite}>
              초대
            </button>
          </div>

          {canLinkAccount && (
            <div className="list-item">
              <div>
                <div className="li-main">계정 연결</div>
                <div className="li-sub">
                  지금은 이 기기에만 저장돼요. GitHub 을 연결하면
                  다른 기기에서도 같은 나로 들어올 수 있어요
                </div>
              </div>
              <button className="link-btn" onClick={onLinkAccount}>
                연결
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
