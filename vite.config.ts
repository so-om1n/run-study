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
  },
});
