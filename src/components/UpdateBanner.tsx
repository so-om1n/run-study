import { useEffect, useState } from "react";
import { isTauri } from "../lib/tauri";

type Phase =
  | { kind: "idle" }
  | { kind: "found"; version: string; notes: string }
  | { kind: "downloading"; percent: number | null }
  | { kind: "ready" }
  | { kind: "failed"; message: string };

/**
 * 새 버전이 있으면 알리고, 눌러서 바로 받아 설치한다.
 *
 * 친구가 GitHub 에 들어가 파일을 다시 받을 필요가 없어야 한다는 게 목적.
 * 업데이트 파일은 서명이 확인돼야만 설치된다 — 아무나 가짜 업데이트를
 * 밀어넣지 못하게 하는 장치고, 앱 실행 경고를 없애는 코드 서명과는
 * 다른 키다.
 *
 * 브라우저(`npm run dev`)에서는 조용히 아무것도 안 한다.
 */
export function UpdateBanner() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  // 이번 실행에서 무시한 버전. 다음 실행 때 다시 물어본다.
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let alive = true;

    void (async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (!alive || !update) return;
        setPhase({
          kind: "found",
          version: update.version,
          notes: (update.body ?? "").trim(),
        });
      } catch (e) {
        // 업데이트 확인 실패로 앱을 멈추게 하지는 않는다.
        // 인터넷이 없거나 릴리스가 아직 없을 때도 여기로 온다.
        console.info("[run study] 업데이트 확인 실패", e);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function install() {
    try {
      setPhase({ kind: "downloading", percent: null });
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (!update) return setPhase({ kind: "idle" });

      let total = 0;
      let got = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
          setPhase({ kind: "downloading", percent: total ? 0 : null });
        } else if (event.event === "Progress") {
          got += event.data.chunkLength;
          setPhase({
            kind: "downloading",
            percent: total ? Math.round((got / total) * 100) : null,
          });
        } else if (event.event === "Finished") {
          setPhase({ kind: "ready" });
        }
      });
      setPhase({ kind: "ready" });
    } catch (e) {
      setPhase({
        kind: "failed",
        message: e instanceof Error ? e.message : "업데이트에 실패했어요",
      });
    }
  }

  async function restart() {
    try {
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch {
      setPhase({
        kind: "failed",
        message: "앱을 직접 껐다 켜주세요",
      });
    }
  }

  if (phase.kind === "idle" || dismissed) return null;

  return (
    <div className="update-bar">
      {phase.kind === "found" && (
        <>
          <div className="ub-text">
            <b>새 버전 {phase.version}</b>
            {phase.notes && <span className="ub-notes">{phase.notes}</span>}
          </div>
          <button className="ub-go" onClick={() => void install()}>
            업데이트
          </button>
          <button
            className="ub-x"
            title="나중에"
            onClick={() => setDismissed(true)}
          >
            ✕
          </button>
        </>
      )}

      {phase.kind === "downloading" && (
        <div className="ub-text">
          받는 중{phase.percent !== null ? ` ${phase.percent}%` : "…"}
        </div>
      )}

      {phase.kind === "ready" && (
        <>
          <div className="ub-text">다 받았어요. 껐다 켜면 적용돼요</div>
          <button className="ub-go" onClick={() => void restart()}>
            지금 재시작
          </button>
        </>
      )}

      {phase.kind === "failed" && (
        <>
          <div className="ub-text">{phase.message}</div>
          <button className="ub-x" onClick={() => setDismissed(true)}>
            ✕
          </button>
        </>
      )}
    </div>
  );
}
