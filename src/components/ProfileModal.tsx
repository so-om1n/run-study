import { useRef, useState } from "react";
import type { Crop, FaceShape, Profile } from "../types";
import { CHARACTERS, DEFAULT_CROP } from "../types";
import { Face, SHAPE_CLASS } from "./Face";

const SHAPES: FaceShape[] = [
  "cloud",
  "circle",
  "squircle",
  "leaf",
  "heart",
  "star",
];

interface Props {
  profile: Profile;
  name: string;
  onClose: () => void;
  onBack: () => void;
  onSave: (profile: Profile, name: string) => void;
}

/** DB 기본값. 이걸 그대로 두고 저장하게 두면 다 "이름 없음"이 된다 */
const PLACEHOLDER_NAME = "이름 없음";

export function ProfileModal({ profile, name, onClose, onBack, onSave }: Props) {
  const [tab, setTab] = useState<"character" | "photo">(
    profile.photo ? "photo" : "character",
  );
  const [draft, setDraft] = useState<Profile>(profile);
  // 기본값이면 빈칸으로 보여준다. 지우고 쓰게 만들면 손이 하나 더 간다
  const [nick, setNick] = useState(name === PLACEHOLDER_NAME ? "" : name);
  const dragRef = useRef<{ x: number; y: number; crop: Crop } | null>(null);

  function pickPhoto() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () =>
        setDraft((d) => ({
          ...d,
          photo: String(reader.result),
          crop: { ...DEFAULT_CROP },
        }));
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function setCrop(patch: Partial<Crop>) {
    setDraft((d) => ({ ...d, crop: { ...d.crop, ...patch } }));
  }

  /** 미리보기를 끌어서 보이는 위치를 옮긴다 */
  function onPointerDown(e: React.PointerEvent) {
    if (!draft.photo) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, crop: draft.crop };
  }
  function onPointerMove(e: React.PointerEvent) {
    const start = dragRef.current;
    if (!start) return;
    // 88px 박스 기준. 끌수록 반대편이 보이도록 부호를 뒤집는다.
    const dx = ((e.clientX - start.x) / 88) * 100;
    const dy = ((e.clientY - start.y) / 88) * 100;
    setCrop({
      x: Math.min(100, Math.max(0, start.crop.x - dx)),
      y: Math.min(100, Math.max(0, start.crop.y - dy)),
    });
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  return (
    <div className="overlay" onMouseDown={onBack}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <button className="icon-btn" onClick={onBack} title="뒤로">
            ‹
          </button>
          <div className="modal-title" style={{ flex: 1 }}>
            프로필
          </div>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="field-label">이름</div>
          <div className="input plain" style={{ marginBottom: 16 }}>
            <input
              value={nick}
              maxLength={12}
              placeholder="친구들에게 보일 이름"
              onChange={(e) => setNick(e.target.value)}
            />
          </div>

          <div className="tabs">
            <button
              className={`tab${tab === "character" ? " act" : ""}`}
              onClick={() => setTab("character")}
            >
              캐릭터
            </button>
            <button
              className={`tab${tab === "photo" ? " act" : ""}`}
              onClick={() => setTab("photo")}
            >
              내 사진
            </button>
          </div>

          {tab === "character" ? (
            <div className="char-grid">
              {CHARACTERS.map((c) => {
                const sel =
                  !draft.photo &&
                  draft.shape === c.shape &&
                  draft.characterColor === c.color;
                return (
                  <button
                    key={c.shape}
                    className={`char-opt${sel ? " sel" : ""}`}
                    style={{ background: c.bg }}
                    onClick={() =>
                      setDraft({
                        characterColor: c.color,
                        photo: null,
                        shape: c.shape,
                        crop: { ...DEFAULT_CROP },
                      })
                    }
                  >
                    <Face
                      profile={{
                        characterColor: c.color,
                        photo: null,
                        shape: c.shape,
                        crop: DEFAULT_CROP,
                      }}
                    />
                  </button>
                );
              })}
            </div>
          ) : draft.photo ? (
            <>
              <div className="crop-area">
                <div
                  className="crop-big"
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  title="끌어서 위치 조절"
                >
                  <div className={`shape ${SHAPE_CLASS[draft.shape]}`}>
                    <img
                      src={draft.photo}
                      alt=""
                      draggable={false}
                      style={{
                        objectPosition: `${draft.crop.x}% ${draft.crop.y}%`,
                        transform: `scale(${draft.crop.zoom})`,
                      }}
                    />
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="field-label" style={{ marginBottom: 4 }}>
                    얼굴 모양
                  </div>
                  <div className="shape-pick">
                    {SHAPES.map((s) => (
                      <button
                        key={s}
                        className={`sp ${SHAPE_CLASS[s]}${
                          draft.shape === s ? " sel" : ""
                        }`}
                        onClick={() => setDraft((d) => ({ ...d, shape: s }))}
                      />
                    ))}
                  </div>

                  <div className="field-label" style={{ margin: "12px 0 4px" }}>
                    확대 {draft.crop.zoom.toFixed(1)}×
                  </div>
                  <input
                    className="range"
                    type="range"
                    min={1}
                    max={3}
                    step={0.05}
                    value={draft.crop.zoom}
                    onChange={(e) => setCrop({ zoom: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="crop-hint">
                미리보기를 끌어서 보일 부분을 정하세요
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn-full sec"
                  style={{ marginTop: 0 }}
                  onClick={pickPhoto}
                >
                  다른 사진
                </button>
                <button
                  className="btn-full sec"
                  style={{ marginTop: 0 }}
                  onClick={() => setCrop({ ...DEFAULT_CROP })}
                >
                  위치 초기화
                </button>
              </div>
            </>
          ) : (
            <button
              className="photo-drop"
              onClick={pickPhoto}
              style={{ width: "100%" }}
            >
              <div style={{ fontSize: 24, marginBottom: 6 }}>＋</div>
              사진 고르기
            </button>
          )}
        </div>

        <div className="modal-foot">
          <span />
          <button
            className="save"
            disabled={nick.trim().length === 0}
            style={nick.trim().length === 0 ? { opacity: 0.45 } : undefined}
            onClick={() => onSave(draft, nick.trim())}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
