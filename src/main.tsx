/**
 * 팝오버(메뉴 막대에서 열리는 창)의 진입점.
 * 미니게임 창은 game.html / src/game.tsx 로 따로 있다.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installCrashScreen, Boundary, paintError } from "./crash";
import "./styles.css";

installCrashScreen();

try {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <Boundary>
        <App />
      </Boundary>
    </React.StrictMode>,
  );
} catch (e) {
  paintError(
    "앱을 시작하지 못했어요",
    e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e),
  );
}
