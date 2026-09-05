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
 * 맥이냐.
 *
 * 집중 모드(알림 끄기)는 맥에서만 경로가 있다. 윈도우의 집중 지원(Focus
 * Assist)은 서드파티가 켤 수 있는 공개 API가 없어서 흉내 낼 방법이 없다.
 * 그래서 윈도우에서는 해당 설정을 아예 감춘다 — 켜지지도 않는 토글을
 * 남겨두면 "고장났다"로 읽힌다.
 */
export function isMac(): boolean {
  if (typeof navigator === "undefined") return true;
  return /Mac|iPhone|iPad/.test(navigator.userAgent);
}

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

/**
 * 팝오버를 닫아달라고 요청한다.
 *
 * 네이티브 포커스 이벤트만 믿으면, 앱이 활성화되지 않아 창이 키 윈도우가
 * 못 된 경우 blur 이벤트 자체가 안 와서 팝오버가 계속 떠 있게 된다.
 * 웹뷰가 감지한 blur 로도 닫을 수 있게 낸 두 번째 길.
 * 모달이 떠 있는 동안에는 러스트 쪽에서 무시한다.
 */
export async function hidePopover() {
  const invoke = getInvoke();
  if (!invoke) return;
  try {
    await invoke("hide_popover");
  } catch {
    /* 예전 버전 바이너리면 커맨드가 없다 */
  }
}

/** 미니게임 창 열기 (없으면 만들고, 있으면 앞으로) */
export async function openGameWindow() {
  const invoke = getInvoke();
  if (!invoke) {
    // 브라우저에서는 새 탭으로 확인할 수 있게
    window.open(`${location.pathname}#game`, "_blank");
    return;
  }
  try {
    await invoke("open_game_window");
  } catch (e) {
    console.warn("[run study] 게임 창을 못 열었어요", e);
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

/**
 * 창 크기 조절을 시작한다.
 *
 * 테두리 없는 창은 OS 가 주는 모서리 손잡이가 없거나 잡기 어렵다.
 * 그래서 우하단에 손잡이를 직접 두고, 거기서 끌면 네이티브 리사이즈를
 * 시작하도록 알려준다.
 */
export async function startResize() {
  const w = window as unknown as {
    __TAURI__?: {
      window?: {
        getCurrentWindow?: () => {
          startResizeDragging: (dir: string) => Promise<void>;
        };
      };
    };
  };
  try {
    const win = w.__TAURI__?.window?.getCurrentWindow?.();
    await win?.startResizeDragging("SouthEast");
  } catch (e) {
    console.warn("[run study] 크기 조절을 시작하지 못했어요", e);
  }
}
