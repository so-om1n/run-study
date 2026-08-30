use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, PhysicalPosition,
};
use tauri_plugin_autostart::MacosLauncher;

/// 팝오버가 포커스를 잃었을 때 스스로 숨을지 여부.
///
/// 시스템 이모지 창(⌃⌘Space)이나 파일 선택창을 열면 팝오버가 포커스를 잃는다.
/// 그때 무조건 숨겨버리면 사용자 눈에는 "앱이 꺼졌다"로 보인다.
/// 그래서 모달이 떠 있는 동안에는 프론트가 이 값을 false 로 내려둔다.
struct AutoHide(AtomicBool);

#[tauri::command]
fn set_auto_hide(state: tauri::State<'_, AutoHide>, enabled: bool) {
    state.0.store(enabled, Ordering::Relaxed);
}

/// macOS 집중 모드 토글.
///
/// macOS 는 서드파티 앱이 집중 모드를 직접 켜는 공개 API를 제공하지 않는다.
/// 유일하게 지원되는 경로가 단축어(Shortcuts)라서, 사용자가 미리 만들어 둔
/// 단축어를 `shortcuts run` 으로 실행한다.
///
/// 필요한 단축어 2개:
///   "<이름> 켜기"  — 집중 모드 켜기
///   "<이름> 끄기"  — 집중 모드 끄기
#[tauri::command]
fn set_focus_mode(on: bool, shortcut_name: String) -> Result<(), String> {
    if !cfg!(target_os = "macos") {
        return Ok(());
    }
    let name = format!("{} {}", shortcut_name, if on { "켜기" } else { "끄기" });
    Command::new("shortcuts")
        .args(["run", &name])
        .spawn()
        .map_err(|e| format!("단축어 '{name}' 실행 실패: {e}"))?;
    Ok(())
}

/// 트레이 툴팁에 접속 인원 수를 표시.
#[tauri::command]
fn update_tray_count(app: tauri::AppHandle, online: u32) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_tooltip(Some(&format!("run study · {online}명 접속 중")))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_auto_launch(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let mgr = app.autolaunch();
    if enabled {
        mgr.enable().map_err(|e| e.to_string())
    } else {
        mgr.disable().map_err(|e| e.to_string())
    }
}

/// 범위가 뒤집혀도 패닉하지 않는 clamp.
/// (창이 모니터보다 큰 경우 lo > hi 가 되어 `f64::clamp` 는 패닉한다)
fn clamp(v: f64, lo: f64, hi: f64) -> f64 {
    if hi < lo {
        lo
    } else {
        v.max(lo).min(hi)
    }
}

/// 트레이 아이콘 옆에 창을 붙인다.
///
/// 맥은 메뉴 막대가 화면 위에 있어서 아이콘 **아래**로 내려야 하고,
/// 윈도우는 작업 표시줄이 아래에 있어서 아이콘 **위**로 올려야 한다.
/// OS 를 직접 보고 나누는 대신 트레이 아이콘이 모니터의 위쪽 절반에
/// 있는지로 판단한다 — 윈도우에서 작업 표시줄을 위/좌/우로 옮겨둔
/// 경우까지 같은 규칙으로 커버된다.
fn position_near_tray(
    window: &tauri::WebviewWindow,
    center_x: f64,
    rect_top: f64,
    rect_bottom: f64,
) {
    let Ok(size) = window.outer_size() else {
        return;
    };
    let (w, h) = (size.width as f64, size.height as f64);

    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());

    let (mon_x, mon_y, mon_w, mon_h) = match monitor {
        Some(m) => {
            let p = m.position();
            let s = m.size();
            (p.x as f64, p.y as f64, s.width as f64, s.height as f64)
        }
        // 모니터 정보를 못 얻으면 클램프를 사실상 끈다
        None => (
            f64::MIN / 4.0,
            f64::MIN / 4.0,
            f64::MAX / 2.0,
            f64::MAX / 2.0,
        ),
    };

    const GAP: f64 = 6.0;
    const EDGE: f64 = 8.0;

    let below = rect_top - mon_y < mon_h / 2.0;
    let y = if below {
        rect_bottom + GAP
    } else {
        rect_top - h - GAP
    };

    let x = clamp(center_x - w / 2.0, mon_x + EDGE, mon_x + mon_w - w - EDGE);
    let y = clamp(y, mon_y + EDGE, mon_y + mon_h - h - EDGE);

    let _ = window.set_position(PhysicalPosition::new(x, y));
}

fn toggle_popover(app: &tauri::AppHandle, at: Option<(f64, f64, f64)>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let visible = window.is_visible().unwrap_or(false);
    if visible {
        let _ = window.hide();
    } else {
        if let Some((cx, top, bottom)) = at {
            position_near_tray(&window, cx, top, bottom);
        }
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(AutoHide(AtomicBool::new(true)))
        .invoke_handler(tauri::generate_handler![
            set_focus_mode,
            update_tray_count,
            set_auto_launch,
            set_auto_hide
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // ---- 트레이 우클릭 메뉴 ----
            let online = MenuItem::with_id(app, "online", "온라인", true, None::<&str>)?;
            let focus = MenuItem::with_id(app, "focus", "집중 중", true, None::<&str>)?;
            let offline =
                MenuItem::with_id(app, "offline", "오프라인으로 표시", true, None::<&str>)?;
            let status_msg = MenuItem::with_id(
                app,
                "status_message",
                "상태 메시지 바꾸기…",
                true,
                None::<&str>,
            )?;
            let settings = MenuItem::with_id(app, "settings", "설정…", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let sep2 = PredefinedMenuItem::separator(app)?;

            let menu = Menu::with_items(
                app,
                &[
                    &online,
                    &focus,
                    &offline,
                    &sep1,
                    &status_msg,
                    &settings,
                    &sep2,
                    &quit,
                ],
            )?;

            // 트레이 아이콘은 앱 아이콘과 따로 간다.
            //
            // 맥: 템플릿 모드라 색이 전부 무시되고 알파만 쓰인다. 그래서
            //     눈이 "구멍"으로 뚫린 전용 이미지를 써야 눈이 보인다.
            // 윈도우: 템플릿 개념이 없다. 같은 이미지를 쓰면 작업 표시줄에서
            //     검은 실루엣으로 뭉개지므로 색이 들어간 버전을 쓴다.
            #[cfg(target_os = "macos")]
            let tray_icon =
                tauri::image::Image::from_bytes(include_bytes!("../icons/tray@2x.png"))?;
            #[cfg(not(target_os = "macos"))]
            let tray_icon =
                tauri::image::Image::from_bytes(include_bytes!("../icons/tray-color.png"))?;

            let tray = TrayIconBuilder::with_id("main")
                .icon(tray_icon)
                .tooltip("run study")
                .menu(&menu)
                // 좌클릭은 메뉴가 아니라 팝오버를 연다
                .show_menu_on_left_click(false);

            // 맥 전용 옵션이라 다른 OS 에서는 아예 호출하지 않는다
            #[cfg(target_os = "macos")]
            let tray = tray.icon_as_template(true);

            tray.on_menu_event(move |app, event| match event.id.as_ref() {
                "quit" => app.exit(0),
                id => {
                    // 프론트에서 처리 (상태 변경, 모달 열기)
                    let _ = app.emit("tray-menu", id);
                    if id == "status_message" || id == "settings" {
                        toggle_popover(app, None);
                    }
                }
            })
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    rect,
                    ..
                } = event
                {
                    let app = tray.app_handle();
                    // 논리 좌표로 올 수도 있어서 실제 배율로 환산한다.
                    // (윈도우는 125%·150% 배율이 기본인 기기가 많다)
                    let scale = app
                        .get_webview_window("main")
                        .and_then(|w| w.scale_factor().ok())
                        .unwrap_or(1.0);
                    let pos = rect.position.to_physical::<f64>(scale);
                    let size = rect.size.to_physical::<f64>(scale);
                    toggle_popover(
                        app,
                        Some((pos.x + size.width / 2.0, pos.y, pos.y + size.height)),
                    );
                }
            })
            .build(app)?;

            // 독(Dock) 아이콘 숨기기 — 메뉴 막대 앱으로 동작
            #[cfg(target_os = "macos")]
            let _ = handle.set_activation_policy(tauri::ActivationPolicy::Accessory);
            let _ = handle;

            Ok(())
        })
        .on_window_event(|window, event| {
            // 포커스를 잃으면 팝오버를 닫는다.
            // 단, 모달이 떠 있으면(이모지 창·파일 선택창 등) 그대로 둔다.
            if let tauri::WindowEvent::Focused(false) = event {
                let keep_open = window
                    .try_state::<AutoHide>()
                    .map(|s| !s.0.load(Ordering::Relaxed))
                    .unwrap_or(false);
                if !keep_open {
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("run study 실행 실패");
}
