import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { GameWindow } from "./GameWindow";
import "./styles.css";

/**
 * 창이 두 개다. 번들은 하나를 같이 쓰고, 어느 창인지로 갈린다.
 *
 * 판별을 해시(#game)로만 하면 안 된다. Tauri 의 WebviewUrl::App 은
 * 경로를 받기 때문에 '#' 가 파일 이름의 일부가 되어버린다. 그래서
 * 게임 창을 띄울 때 러스트가 주입하는 플래그를 먼저 본다.
 * 해시는 브라우저에서 `npm run dev` 로 볼 때를 위한 길이다.
 */
const w = window as unknown as { __RUN_STUDY_GAME__?: boolean };
const isGame =
  w.__RUN_STUDY_GAME__ === true || window.location.hash.startsWith("#game");

/**
 * 하얀 화면을 만들지 않는다.
 *
 * 자바스크립트가 죽으면 창이 텅 빈 채로 남는다. 사용자 눈에는 "하얗게
 * 뜨고 아무 반응 없음"으로만 보이고, 릴리스 빌드에서는 원인을 볼 방법이
 * 없어서 "에러 난다"는 말만 오간다. 그래서 어떤 오류든 화면에 적는다.
 */
function paintError(title: string, detail: string) {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `
    <div class="crash">
      <h4>${title}</h4>
      <pre class="crash-detail"></pre>
      <p class="crash-hint">이 내용을 그대로 알려주시면 고칠 수 있어요.
      버전 ${__APP_VERSION__}</p>
    </div>`;
  // 오류 문구는 textContent 로 넣는다. innerHTML 로 넣으면 그 안의
  // 꺾쇠가 다시 태그로 해석돼서 정작 읽어야 할 내용이 사라진다.
  const pre = root.querySelector(".crash-detail");
  if (pre) pre.textContent = detail;
}

window.addEventListener("error", (e) => {
  paintError("화면을 그리지 못했어요", `${e.message}\n${e.filename}:${e.lineno}`);
});
window.addEventListener("unhandledrejection", (e) => {
  const r = e.reason;
  paintError(
    "처리하지 못한 오류가 있어요",
    r instanceof Error ? `${r.message}\n${r.stack ?? ""}` : String(r),
  );
});

/** 렌더 도중 터진 것까지 잡는다 (위의 window 리스너로는 안 잡힌다) */
class Boundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="crash">
        <h4>화면을 그리지 못했어요</h4>
        <pre className="crash-detail">
          {error.message}
          {"\n"}
          {error.stack}
        </pre>
        <p className="crash-hint">
          이 내용을 그대로 알려주시면 고칠 수 있어요. 버전 {__APP_VERSION__}
        </p>
      </div>
    );
  }
}

try {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <Boundary>{isGame ? <GameWindow /> : <App />}</Boundary>
    </React.StrictMode>,
  );
} catch (e) {
  paintError(
    "앱을 시작하지 못했어요",
    e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e),
  );
}
