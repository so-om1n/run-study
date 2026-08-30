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

/// 트레이 아이콘 바로 아래에 창을 붙인다.
fn position_under_tray(window: &tauri::WebviewWindow, tray_rect_x: f64, tray_rect_y: f64) {
    if let Ok(size) = window.outer_size() {
        let x = (tray_rect_x - (size.width as f64) / 2.0).max(8.0);
        let y = tray_rect_y + 6.0;
        let _ = window.set_position(PhysicalPosition::new(x, y));
    }
}

fn toggle_popover(app: &tauri::AppHandle, at: Option<(f64, f64)>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let visible = window.is_visible().unwrap_or(false);
    if visible {
        let _ = window.hide();
    } else {
        if let Some((x, y)) = at {
            position_under_tray(&window, x, y);
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
            let offline = MenuItem::with_id(
                app,
                "offline",
                "오프라인으로 표시",
                true,
                None::<&str>,
            )?;
            let status_msg = MenuItem::with_id(
                app,
                "status_message",
                "상태 메시지 바꾸기…",
                true,
                None::<&str>,
            )?;
            let settings =
                MenuItem::with_id(app, "settings", "설정…", true, None::<&str>)?;
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

            // 메뉴 막대 아이콘은 앱 아이콘과 따로 간다.
            // 템플릿 모드에서는 색이 무시되고 알파만 쓰이기 때문에,
            // 눈이 "구멍"으로 뚫린 전용 이미지를 써야 눈이 보인다.
            let tray_icon = tauri::image::Image::from_bytes(include_bytes!(
                "../icons/tray@2x.png"
            ))?;

            TrayIconBuilder::with_id("main")
                .icon(tray_icon)
                .icon_as_template(true)
                .tooltip("run study")
                .menu(&menu)
                // 좌클릭은 메뉴가 아니라 팝오버를 연다
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id.as_ref() {
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
                        let pos = rect.position.to_physical::<f64>(1.0);
                        let size = rect.size.to_physical::<f64>(1.0);
                        toggle_popover(
                            tray.app_handle(),
                            Some((pos.x + size.width / 2.0, pos.y + size.height)),
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
