import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  // 화면에 버전을 띄우기 위해. "지금 몇 버전 쓰고 있어?"에 답할 수
  // 없으면 버그 하나 잡는 데 왕복이 몇 번씩 생긴다.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: "safari15",
    rollupOptions: {
      // 창마다 페이지를 따로 만든다. 한 페이지를 플래그로 갈랐더니
      // 그 플래그가 안 잡히는 경우를 릴리스 빌드에서 확인할 방법이
      // 없었다. 파일이 나뉘면 판단할 일 자체가 사라진다.
      input: {
        main: "index.html",
        game: "game.html",
      },
    },
  },
});
