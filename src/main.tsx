import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { GameWindow } from "./GameWindow";
import "./styles.css";

/**
 * 창이 두 개다. 번들은 하나를 같이 쓰고 해시로 갈린다.
 *   (없음)  팝오버
 *   #game   미니게임 창
 * 엔트리를 따로 두지 않은 이유는 목·Supabase 계층과 스타일을 그대로
 * 공유하기 위해서다. 게임 창만 따로 빌드하면 그게 다 두 벌이 된다.
 */
const isGame = window.location.hash.startsWith("#game");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{isGame ? <GameWindow /> : <App />}</React.StrictMode>,
);
