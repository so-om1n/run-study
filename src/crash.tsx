import React from "react";

/**
 * 하얀 화면을 만들지 않는다.
 *
 * 자바스크립트가 죽으면 창이 텅 빈 채로 남는다. 사용자 눈에는 "하얗게
 * 뜨고 아무 반응 없음"으로만 보이고, 릴리스 빌드에서는 원인을 볼 방법이
 * 없어서 "에러 난다"는 말만 오간다. 그래서 어떤 오류든 화면에 적는다.
 *
 * 창이 둘이라 진입점도 둘이고, 이 장치는 양쪽에 다 걸려야 한다.
 */
export function paintError(title: string, detail: string) {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `
    <div class="crash">
      <h4></h4>
      <pre class="crash-detail"></pre>
      <p class="crash-hint">이 내용을 그대로 알려주시면 고칠 수 있어요.
      버전 ${__APP_VERSION__}</p>
    </div>`;
  // 제목과 내용은 textContent 로 넣는다. innerHTML 로 넣으면 그 안의
  // 꺾쇠가 다시 태그로 해석돼서 정작 읽어야 할 내용이 사라진다.
  const h = root.querySelector("h4");
  if (h) h.textContent = title;
  const pre = root.querySelector(".crash-detail");
  if (pre) pre.textContent = detail;
}

export function installCrashScreen() {
  window.addEventListener("error", (e) => {
    paintError(
      "화면을 그리지 못했어요",
      `${e.message}\n${e.filename}:${e.lineno}`,
    );
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    paintError(
      "처리하지 못한 오류가 있어요",
      r instanceof Error ? `${r.message}\n${r.stack ?? ""}` : String(r),
    );
  });
}

/** 렌더 도중 터진 것까지 잡는다 (위의 window 리스너로는 안 잡힌다) */
export class Boundary extends React.Component<
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
