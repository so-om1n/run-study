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
const isGame = w.__RUN_STUDY_GAME__ === true || window.location.hash.startsWith("#game");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{isGame ? <GameWindow /> : <App />}</React.StrictMode>,
);
