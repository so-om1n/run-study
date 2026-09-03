/**
 * 미니게임 창의 진입점.
 *
 * 팝오버와 같은 페이지를 쓰면서 플래그로 갈랐더니, 그 플래그가 안 잡히는
 * 경우를 디버깅할 방법이 없었다. 창마다 HTML 을 따로 두면 "어느 화면을
 * 그릴까"를 판단할 일 자체가 사라진다. 번들은 여전히 공유한다.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { GameWindow } from "./GameWindow";
import { installCrashScreen, Boundary } from "./crash";
import "./styles.css";

installCrashScreen();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Boundary>
      <GameWindow />
    </Boundary>
  </React.StrictMode>,
);
