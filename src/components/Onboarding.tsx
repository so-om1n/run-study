import { useState } from "react";
import { CHARACTERS, DEFAULT_CROP } from "../types";
import { Face } from "./Face";

interface Props {
  onCreate: (partyName: string, myName: string) => Promise<void>;
  onJoin: (code: string, myName: string) => Promise<void>;
}

/**
 * 3스텝 고정. 여기서 한 스텝만 늘어나도 이탈이 생긴다.
 *   1) 소개  2) 파티 만들기 / 코드로 참여  3) 완료
 */
export function Onboarding({ onCreate, onJoin }: Props) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"pick" | "create" | "join">("pick");
  const [code, setCode] = useState("");
  const [name, setName] = useState("우리끼리");
  // 첫 실행에 여기서 안 받으면 친구들 화면에 "이름 없음"으로 뜬다.
  // 스텝을 늘리지 않으려고 기존 폼 위에 얹었다.
  const [myName, setMyName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "잘 안 됐어요. 다시 해볼래요?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="popover">
      <div className="modal-body" style={{ padding: 22, marginTop: 8 }}>
        <div className="steps">
          {[0, 1].map((i) => (
            <div key={i} className={`step${i <= step ? " act" : ""}`} />
          ))}
        </div>

        {step === 0 && (
          <>
            <div className="hero">
              <div className="hero-blob">
                <Face
                  profile={{
                    characterColor: CHARACTERS[0].color,
                    photo: null,
                    shape: "cloud",
                    crop: DEFAULT_CROP,
                  }}
                  className="hero-blob"
                />
              </div>
              <h3>
                같이 있진 않지만
                <br />
                같이 있는 느낌
              </h3>
              <p>
                친구들이 지금 뭘 하는지
                <br />
                말 없이 곁에서 느껴보세요
              </p>
            </div>
            <button className="btn-full" onClick={() => setStep(1)}>
              시작하기
            </button>
          </>
        )}

        {step === 1 && mode === "pick" && (
          <>
            <div className="hero">
              <h3>파티 만들기</h3>
              <p>친구를 초대하거나 받은 코드로 들어가세요</p>
            </div>
            <button className="btn-full" onClick={() => setMode("create")}>
              파티 만들기
            </button>
            <button className="btn-full sec" onClick={() => setMode("join")}>
              코드로 참여하기
            </button>
          </>
        )}

        {step === 1 && mode === "create" && (
          <>
            <div className="field-label">내 이름</div>
            <div className="input plain" style={{ marginBottom: 14 }}>
              <input
                value={myName}
                maxLength={12}
                placeholder="친구들에게 보일 이름"
                onChange={(e) => setMyName(e.target.value)}
              />
            </div>

            <div className="field-label">파티 이름</div>
            <div className="input plain" style={{ marginBottom: 14 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {error && <div className="form-error">{error}</div>}
            <button
              className="btn-full"
              disabled={busy || myName.trim().length === 0}
              style={
                busy || myName.trim().length === 0
                  ? { opacity: 0.5 }
                  : undefined
              }
              onClick={() => void run(() => onCreate(name, myName.trim()))}
            >
              {busy ? "만드는 중…" : "만들기"}
            </button>
            <button className="btn-full sec" onClick={() => setMode("pick")}>
              뒤로
            </button>
          </>
        )}

        {step === 1 && mode === "join" && (
          <>
            <div className="field-label">내 이름</div>
            <div className="input plain" style={{ marginBottom: 14 }}>
              <input
                value={myName}
                maxLength={12}
                placeholder="친구들에게 보일 이름"
                onChange={(e) => setMyName(e.target.value)}
              />
            </div>

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
              disabled={code.length < 6 || busy || myName.trim().length === 0}
              style={
                code.length < 6 || busy || myName.trim().length === 0
                  ? { opacity: 0.45 }
                  : undefined
              }
              onClick={() => void run(() => onJoin(code, myName.trim()))}
            >
              {busy ? "들어가는 중…" : "참여"}
            </button>
            <button className="btn-full sec" onClick={() => setMode("pick")}>
              뒤로
            </button>
          </>
        )}

      </div>
    </div>
  );
}
