/**
 * Tauri 브리지. 브라우저(vite dev)에서도 그냥 돌아가도록 전부 방어적으로 감쌌다.
 */

type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

function getInvoke(): InvokeFn | null {
  const w = window as unknown as {
    __TAURI__?: { core?: { invoke?: InvokeFn }; invoke?: InvokeFn };
  };
  return w.__TAURI__?.core?.invoke ?? w.__TAURI__?.invoke ?? null;
}

export const isTauri = () => getInvoke() !== null;

/**
 * macOS 집중 모드 토글.
 *
 * macOS 는 서드파티 앱이 집중 모드를 켜는 공개 API를 주지 않는다.
 * 그래서 사용자가 등록해 둔 단축어를 `shortcuts run` 으로 실행한다.
 * (Rust 쪽 set_focus_mode 커맨드 참고)
 */
export async function setFocusMode(on: boolean, shortcutName: string) {
  const invoke = getInvoke();
  if (!invoke) {
    console.info(`[run study] 집중 모드 ${on ? "ON" : "OFF"} (브라우저라 무시)`);
    return;
  }
  try {
    await invoke("set_focus_mode", { on, shortcutName });
  } catch (e) {
    console.warn("[run study] 집중 모드 전환 실패", e);
  }
}

/** 트레이 아이콘 뱃지에 접속 인원 수를 반영 */
export async function updateTrayCount(online: number) {
  const invoke = getInvoke();
  if (!invoke) return;
  try {
    await invoke("update_tray_count", { online });
  } catch {
    /* 트레이가 아직 없으면 무시 */
  }
}

type UnlistenFn = () => void;

/**
 * 트레이 우클릭 메뉴에서 온 이벤트.
 * id: "online" | "focus" | "offline" | "status_message" | "settings"
 */
export function onTrayMenu(handler: (id: string) => void): UnlistenFn {
  const w = window as unknown as {
    __TAURI__?: {
      event?: {
        listen?: (
          e: string,
          cb: (p: { payload: string }) => void,
        ) => Promise<UnlistenFn>;
      };
    };
  };
  const listen = w.__TAURI__?.event?.listen;
  if (!listen) return () => {};

  let unlisten: UnlistenFn | null = null;
  let cancelled = false;
  void listen("tray-menu", (e) => handler(e.payload)).then((fn) => {
    if (cancelled) fn();
    else unlisten = fn;
  });
  return () => {
    cancelled = true;
    unlisten?.();
  };
}

/**
 * 팝오버가 포커스를 잃었을 때 스스로 숨을지.
 * 모달(이모지 창·사진 고르기 등)이 떠 있는 동안에는 꺼둬야 한다.
 * 안 그러면 시스템 이모지 창을 여는 순간 앱이 꺼진 것처럼 사라진다.
 */
export async function setAutoHide(enabled: boolean) {
  const invoke = getInvoke();
  if (!invoke) return;
  try {
    await invoke("set_auto_hide", { enabled });
  } catch {
    /* 아직 커맨드가 없으면 무시 */
  }
}

export async function setAutoLaunch(enabled: boolean) {
  const invoke = getInvoke();
  if (!invoke) return;
  try {
    await invoke("set_auto_launch", { enabled });
  } catch (e) {
    console.warn("[run study] 자동 실행 설정 실패", e);
  }
}
