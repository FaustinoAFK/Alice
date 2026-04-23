#![cfg_attr(test, allow(dead_code))]

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

const GEMINI_LIVE_WS_ENDPOINT: &str =
    "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const MAX_TEXT_CHARS: usize = 500;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiLiveAccess {
    url: String,
}

#[derive(Debug, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DesktopAction {
    OpenApp {
        app: String,
    },
    OpenFolder {
        folder: String,
    },
    MouseMove {
        x: f64,
        y: f64,
        #[serde(rename = "captureWidth")]
        capture_width: Option<i32>,
        #[serde(rename = "captureHeight")]
        capture_height: Option<i32>,
    },
    MouseClick {
        button: String,
        x: Option<f64>,
        y: Option<f64>,
        #[serde(rename = "captureWidth")]
        capture_width: Option<i32>,
        #[serde(rename = "captureHeight")]
        capture_height: Option<i32>,
    },
    TypeText {
        text: String,
    },
    PressHotkey {
        hotkey: String,
    },
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopActionResult {
    ok: bool,
    message: String,
}

fn gemini_api_key_from_env() -> Result<String, String> {
    std::env::var("GEMINI_API_KEY")
        .or_else(|_| std::env::var("GOOGLE_API_KEY"))
        .map_err(|_| {
            "GEMINI_API_KEY nao encontrada nas variaveis de ambiente. Reinicie o VS Code/terminal depois de criar a variavel.".to_string()
        })
}

fn build_gemini_live_url(api_key: &str) -> String {
    format!(
        "{GEMINI_LIVE_WS_ENDPOINT}?key={}",
        urlencoding::encode(api_key)
    )
}

fn validate_app(app: &str) -> Result<(), String> {
    match app {
        "notepad" | "calculator" | "browser" | "file_explorer" => Ok(()),
        _ => Err(format!("Aplicativo nao permitido: {app}")),
    }
}

fn validate_folder(folder: &str) -> Result<(), String> {
    match folder {
        "desktop" | "downloads" | "documents" | "alice_project" => Ok(()),
        _ => Err(format!("Pasta nao permitida: {folder}")),
    }
}

fn validate_hotkey(hotkey: &str) -> Result<(), String> {
    match hotkey {
        "copy" | "paste" | "select_all" | "enter" | "escape" | "tab" | "alt_tab" | "ctrl_s"
        | "ctrl_z" => Ok(()),
        _ => Err(format!("Atalho nao permitido: {hotkey}")),
    }
}

fn validate_coordinate(value: f64, label: &str) -> Result<(), String> {
    if !value.is_finite() || !(0.0..=1000.0).contains(&value) {
        return Err(format!("Coordenada {label} fora do intervalo 0..1000"));
    }

    Ok(())
}

fn normalized_coordinate_to_pixel(value: f64, extent: i32, label: &str) -> Result<i32, String> {
    validate_coordinate(value, label)?;
    if extent <= 0 {
        return Err(format!("Resolucao invalida para eixo {label}: {extent}"));
    }

    Ok(((value / 1000.0) * f64::from(extent - 1)).round() as i32)
}

fn validate_capture_extent(value: Option<i32>, label: &str) -> Result<(), String> {
    if let Some(value) = value {
        if !(1..=20000).contains(&value) {
            return Err(format!("Dimensao da captura {label} invalida: {value}"));
        }
    }

    Ok(())
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct ScreenRect {
    left: i32,
    top: i32,
    width: i32,
    height: i32,
    primary: bool,
}

fn choose_target_screen(
    screens: &[ScreenRect],
    capture_width: Option<i32>,
    capture_height: Option<i32>,
) -> Option<ScreenRect> {
    match (capture_width, capture_height) {
        (Some(capture_width), Some(capture_height)) if capture_width > 0 && capture_height > 0 => {
            screens
                .iter()
                .min_by_key(|screen| {
                    (screen.width - capture_width).abs() + (screen.height - capture_height).abs()
                })
                .copied()
        }
        _ => screens
            .iter()
            .find(|screen| screen.primary)
            .copied()
            .or_else(|| screens.first().copied()),
    }
}

fn normalized_point_to_screen_pixel(
    x: f64,
    y: f64,
    screen: ScreenRect,
) -> Result<(i32, i32), String> {
    Ok((
        screen.left + normalized_coordinate_to_pixel(x, screen.width, "x")?,
        screen.top + normalized_coordinate_to_pixel(y, screen.height, "y")?,
    ))
}

fn validate_desktop_action(action: &DesktopAction) -> Result<(), String> {
    match action {
        DesktopAction::OpenApp { app } => validate_app(app),
        DesktopAction::OpenFolder { folder } => validate_folder(folder),
        DesktopAction::MouseMove {
            x,
            y,
            capture_width,
            capture_height,
        } => {
            validate_coordinate(*x, "x")?;
            validate_coordinate(*y, "y")?;
            validate_capture_extent(*capture_width, "width")?;
            validate_capture_extent(*capture_height, "height")
        }
        DesktopAction::MouseClick {
            button,
            x,
            y,
            capture_width,
            capture_height,
        } => {
            match button.as_str() {
                "left" | "right" => {}
                _ => return Err(format!("Botao de mouse nao permitido: {button}")),
            }

            validate_capture_extent(*capture_width, "width")?;
            validate_capture_extent(*capture_height, "height")?;

            match (x, y) {
                (Some(x), Some(y)) => {
                    validate_coordinate(*x, "x")?;
                    validate_coordinate(*y, "y")
                }
                (None, None) => Ok(()),
                _ => {
                    Err("Mouse click precisa receber x e y juntos, ou nenhum dos dois.".to_string())
                }
            }
        }
        DesktopAction::TypeText { text } => {
            if text.chars().count() > MAX_TEXT_CHARS {
                return Err(format!("Texto excede {MAX_TEXT_CHARS} caracteres."));
            }
            Ok(())
        }
        DesktopAction::PressHotkey { hotkey } => validate_hotkey(hotkey),
    }
}

fn user_folder(name: &str) -> Result<PathBuf, String> {
    let home = std::env::var("USERPROFILE")
        .map_err(|_| "USERPROFILE nao encontrado para abrir pasta.".to_string())?;
    Ok(PathBuf::from(home).join(name))
}

fn alice_project_folder() -> Result<PathBuf, String> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .map(PathBuf::from)
        .ok_or_else(|| "Nao consegui resolver a pasta do projeto Alice.".to_string())
}

fn open_app(app: &str) -> Result<String, String> {
    match app {
        "notepad" => {
            Command::new("notepad.exe")
                .spawn()
                .map_err(|error| format!("Falha ao abrir Bloco de Notas: {error}"))?;
            Ok("Bloco de Notas aberto.".to_string())
        }
        "calculator" => {
            Command::new("calc.exe")
                .spawn()
                .map_err(|error| format!("Falha ao abrir Calculadora: {error}"))?;
            Ok("Calculadora aberta.".to_string())
        }
        "browser" => {
            Command::new("explorer.exe")
                .arg("https://www.google.com")
                .spawn()
                .map_err(|error| format!("Falha ao abrir navegador: {error}"))?;
            Ok("Navegador aberto.".to_string())
        }
        "file_explorer" => {
            Command::new("explorer.exe")
                .spawn()
                .map_err(|error| format!("Falha ao abrir Explorador de Arquivos: {error}"))?;
            Ok("Explorador de Arquivos aberto.".to_string())
        }
        _ => Err(format!("Aplicativo nao permitido: {app}")),
    }
}

fn open_folder(folder: &str) -> Result<String, String> {
    let path = match folder {
        "desktop" => user_folder("Desktop")?,
        "downloads" => user_folder("Downloads")?,
        "documents" => user_folder("Documents")?,
        "alice_project" => alice_project_folder()?,
        _ => return Err(format!("Pasta nao permitida: {folder}")),
    };

    Command::new("explorer.exe")
        .arg(&path)
        .spawn()
        .map_err(|error| format!("Falha ao abrir pasta: {error}"))?;

    Ok(format!("Pasta aberta: {}", path.display()))
}

#[cfg(windows)]
mod windows_input {
    use super::{
        choose_target_screen, normalized_point_to_screen_pixel, DesktopAction, ScreenRect,
    };
    use std::mem::size_of;
    use std::ptr::null;
    use windows_sys::Win32::Foundation::{LPARAM, RECT};
    use windows_sys::Win32::Graphics::Gdi::{
        EnumDisplayMonitors, GetMonitorInfoW, HDC, HMONITOR, MONITORINFO,
    };
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, INPUT_MOUSE, KEYBDINPUT, KEYEVENTF_KEYUP,
        KEYEVENTF_UNICODE, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP, MOUSEEVENTF_RIGHTDOWN,
        MOUSEEVENTF_RIGHTUP, MOUSEINPUT, VIRTUAL_KEY, VK_A, VK_C, VK_CONTROL, VK_ESCAPE, VK_MENU,
        VK_RETURN, VK_S, VK_TAB, VK_V, VK_Z,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{SetCursorPos, MONITORINFOF_PRIMARY};

    fn send_inputs(inputs: &[INPUT]) -> Result<(), String> {
        let sent = unsafe {
            SendInput(
                inputs.len() as u32,
                inputs.as_ptr(),
                size_of::<INPUT>() as i32,
            )
        };

        if sent == inputs.len() as u32 {
            Ok(())
        } else {
            Err("Windows recusou a automacao de entrada.".to_string())
        }
    }

    fn mouse_input(dx: i32, dy: i32, flags: u32) -> INPUT {
        INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT {
                    dx,
                    dy,
                    mouseData: 0,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        }
    }

    fn key_input(vk: VIRTUAL_KEY, flags: u32) -> INPUT {
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk,
                    wScan: 0,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        }
    }

    fn unicode_input(unit: u16, flags: u32) -> INPUT {
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: 0,
                    wScan: unit,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        }
    }

    unsafe extern "system" fn collect_monitor(
        monitor: HMONITOR,
        _hdc: HDC,
        _rect: *mut RECT,
        data: LPARAM,
    ) -> i32 {
        let screens = &mut *(data as *mut Vec<ScreenRect>);
        let mut info = MONITORINFO {
            cbSize: size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };

        if GetMonitorInfoW(monitor, &mut info) == 0 {
            return 1;
        }

        let width = info.rcMonitor.right - info.rcMonitor.left;
        let height = info.rcMonitor.bottom - info.rcMonitor.top;
        if width > 0 && height > 0 {
            screens.push(ScreenRect {
                left: info.rcMonitor.left,
                top: info.rcMonitor.top,
                width,
                height,
                primary: info.dwFlags & MONITORINFOF_PRIMARY != 0,
            });
        }

        1
    }

    fn enumerate_screens() -> Result<Vec<ScreenRect>, String> {
        let mut screens = Vec::<ScreenRect>::new();
        let ok = unsafe {
            EnumDisplayMonitors(
                std::ptr::null_mut(),
                null(),
                Some(collect_monitor),
                &mut screens as *mut Vec<ScreenRect> as LPARAM,
            )
        };

        if ok == 0 || screens.is_empty() {
            return Err("Nao consegui enumerar os monitores do Windows.".to_string());
        }

        Ok(screens)
    }

    pub fn move_mouse(
        x: f64,
        y: f64,
        capture_width: Option<i32>,
        capture_height: Option<i32>,
    ) -> Result<String, String> {
        let screens = enumerate_screens()?;
        let screen = choose_target_screen(&screens, capture_width, capture_height)
            .ok_or_else(|| "Nao encontrei um monitor compativel para mover o mouse.".to_string())?;
        let (pixel_x, pixel_y) = normalized_point_to_screen_pixel(x, y, screen)?;
        let moved = unsafe { SetCursorPos(pixel_x, pixel_y) };

        if moved == 0 {
            return Err("Windows recusou mover o cursor.".to_string());
        }

        Ok(format!(
            "Mouse movido para {pixel_x},{pixel_y} no monitor {}x{} em {},{}.",
            screen.width, screen.height, screen.left, screen.top
        ))
    }

    pub fn click_mouse(
        button: &str,
        x: Option<f64>,
        y: Option<f64>,
        capture_width: Option<i32>,
        capture_height: Option<i32>,
    ) -> Result<String, String> {
        if let (Some(x), Some(y)) = (x, y) {
            move_mouse(x, y, capture_width, capture_height)?;
        }

        let (down, up) = match button {
            "left" => (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP),
            "right" => (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP),
            _ => return Err(format!("Botao de mouse nao permitido: {button}")),
        };

        send_inputs(&[mouse_input(0, 0, down), mouse_input(0, 0, up)])?;
        Ok("Clique executado.".to_string())
    }

    pub fn type_text(text: &str) -> Result<String, String> {
        let mut inputs = Vec::new();
        for unit in text.encode_utf16() {
            inputs.push(unicode_input(unit, KEYEVENTF_UNICODE));
            inputs.push(unicode_input(unit, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP));
        }

        if !inputs.is_empty() {
            send_inputs(&inputs)?;
        }

        Ok("Texto digitado.".to_string())
    }

    fn press_key(vk: VIRTUAL_KEY) -> Result<(), String> {
        send_inputs(&[key_input(vk, 0), key_input(vk, KEYEVENTF_KEYUP)])
    }

    fn press_combo(modifiers: &[VIRTUAL_KEY], key: VIRTUAL_KEY) -> Result<(), String> {
        let mut inputs = Vec::new();

        for modifier in modifiers {
            inputs.push(key_input(*modifier, 0));
        }
        inputs.push(key_input(key, 0));
        inputs.push(key_input(key, KEYEVENTF_KEYUP));
        for modifier in modifiers.iter().rev() {
            inputs.push(key_input(*modifier, KEYEVENTF_KEYUP));
        }

        send_inputs(&inputs)
    }

    pub fn press_hotkey(hotkey: &str) -> Result<String, String> {
        match hotkey {
            "copy" => press_combo(&[VK_CONTROL], VK_C)?,
            "paste" => press_combo(&[VK_CONTROL], VK_V)?,
            "select_all" => press_combo(&[VK_CONTROL], VK_A)?,
            "enter" => press_key(VK_RETURN)?,
            "escape" => press_key(VK_ESCAPE)?,
            "tab" => press_key(VK_TAB)?,
            "alt_tab" => press_combo(&[VK_MENU], VK_TAB)?,
            "ctrl_s" => press_combo(&[VK_CONTROL], VK_S)?,
            "ctrl_z" => press_combo(&[VK_CONTROL], VK_Z)?,
            _ => return Err(format!("Atalho nao permitido: {hotkey}")),
        }

        Ok("Atalho executado.".to_string())
    }

    pub fn execute_input_action(action: &DesktopAction) -> Result<String, String> {
        match action {
            DesktopAction::MouseMove {
                x,
                y,
                capture_width,
                capture_height,
            } => move_mouse(*x, *y, *capture_width, *capture_height),
            DesktopAction::MouseClick {
                button,
                x,
                y,
                capture_width,
                capture_height,
            } => click_mouse(button, *x, *y, *capture_width, *capture_height),
            DesktopAction::TypeText { text } => type_text(text),
            DesktopAction::PressHotkey { hotkey } => press_hotkey(hotkey),
            _ => Err("Acao de entrada invalida.".to_string()),
        }
    }
}

#[cfg(not(windows))]
mod windows_input {
    use super::DesktopAction;

    pub fn execute_input_action(_action: &DesktopAction) -> Result<String, String> {
        Err("Automacao de mouse/teclado so esta disponivel no Windows.".to_string())
    }
}

fn perform_desktop_action(action: &DesktopAction) -> Result<String, String> {
    match action {
        DesktopAction::OpenApp { app } => open_app(app),
        DesktopAction::OpenFolder { folder } => open_folder(folder),
        DesktopAction::MouseMove { .. }
        | DesktopAction::MouseClick { .. }
        | DesktopAction::TypeText { .. }
        | DesktopAction::PressHotkey { .. } => windows_input::execute_input_action(action),
    }
}

#[tauri::command]
fn create_gemini_live_url() -> Result<GeminiLiveAccess, String> {
    Ok(GeminiLiveAccess {
        url: build_gemini_live_url(&gemini_api_key_from_env()?),
    })
}

#[tauri::command]
fn execute_desktop_action(action: DesktopAction) -> Result<DesktopActionResult, String> {
    validate_desktop_action(&action)?;
    let message = perform_desktop_action(&action)?;
    Ok(DesktopActionResult { ok: true, message })
}

#[cfg(not(test))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_gemini_live_url,
            execute_desktop_action
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn live_url_uses_v1beta_websocket_endpoint_with_encoded_api_key() {
        let url = build_gemini_live_url("key with spaces");

        assert_eq!(
            url,
            "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=key%20with%20spaces"
        );
        assert!(!url.contains(' '));
    }

    #[test]
    fn validation_rejects_unknown_app() {
        let action = DesktopAction::OpenApp {
            app: "powershell".to_string(),
        };

        assert!(validate_desktop_action(&action).is_err());
    }

    #[test]
    fn validation_rejects_unknown_folder() {
        let action = DesktopAction::OpenFolder {
            folder: "system32".to_string(),
        };

        assert!(validate_desktop_action(&action).is_err());
    }

    #[test]
    fn validation_rejects_unknown_hotkey() {
        let action = DesktopAction::PressHotkey {
            hotkey: "delete".to_string(),
        };

        assert!(validate_desktop_action(&action).is_err());
    }

    #[test]
    fn validation_rejects_text_above_limit() {
        let action = DesktopAction::TypeText {
            text: "a".repeat(MAX_TEXT_CHARS + 1),
        };

        assert!(validate_desktop_action(&action).is_err());
    }

    #[test]
    fn validation_rejects_coordinates_outside_normalized_range() {
        let action = DesktopAction::MouseMove {
            x: 1001.0,
            y: 1.0,
            capture_width: None,
            capture_height: None,
        };

        assert!(validate_desktop_action(&action).is_err());
    }

    #[test]
    fn validation_rejects_invalid_capture_dimensions() {
        let action = DesktopAction::MouseClick {
            button: "left".to_string(),
            x: Some(500.0),
            y: Some(500.0),
            capture_width: Some(0),
            capture_height: Some(1080),
        };

        assert!(validate_desktop_action(&action).is_err());
    }

    #[test]
    fn normalized_coordinate_to_pixel_maps_edges_to_screen_pixels() {
        assert_eq!(normalized_coordinate_to_pixel(0.0, 1920, "x"), Ok(0));
        assert_eq!(normalized_coordinate_to_pixel(500.0, 1920, "x"), Ok(960));
        assert_eq!(normalized_coordinate_to_pixel(1000.0, 1920, "x"), Ok(1919));
    }

    #[test]
    fn normalized_coordinate_to_pixel_rejects_invalid_extent() {
        assert!(normalized_coordinate_to_pixel(500.0, 0, "x").is_err());
    }

    #[test]
    fn normalized_point_to_screen_pixel_applies_monitor_offset() {
        let screen = ScreenRect {
            left: 1920,
            top: 0,
            width: 1280,
            height: 720,
            primary: false,
        };

        assert_eq!(
            normalized_point_to_screen_pixel(500.0, 500.0, screen),
            Ok((2560, 360))
        );
    }

    #[test]
    fn choose_target_screen_prefers_capture_size_match() {
        let screens = [
            ScreenRect {
                left: 0,
                top: 0,
                width: 1920,
                height: 1080,
                primary: true,
            },
            ScreenRect {
                left: 1920,
                top: 0,
                width: 1280,
                height: 720,
                primary: false,
            },
        ];

        assert_eq!(
            choose_target_screen(&screens, Some(1280), Some(720)),
            Some(screens[1])
        );
    }

    #[test]
    fn choose_target_screen_uses_primary_without_capture_size() {
        let screens = [
            ScreenRect {
                left: 1920,
                top: 0,
                width: 1280,
                height: 720,
                primary: false,
            },
            ScreenRect {
                left: 0,
                top: 0,
                width: 1920,
                height: 1080,
                primary: true,
            },
        ];

        assert_eq!(choose_target_screen(&screens, None, None), Some(screens[1]));
    }

    #[test]
    fn validation_accepts_allowed_actions() {
        let actions = [
            DesktopAction::OpenApp {
                app: "notepad".to_string(),
            },
            DesktopAction::OpenFolder {
                folder: "downloads".to_string(),
            },
            DesktopAction::MouseMove {
                x: 500.0,
                y: 500.0,
                capture_width: Some(1920),
                capture_height: Some(1080),
            },
            DesktopAction::MouseClick {
                button: "left".to_string(),
                x: None,
                y: None,
                capture_width: None,
                capture_height: None,
            },
            DesktopAction::TypeText {
                text: "ola".to_string(),
            },
            DesktopAction::PressHotkey {
                hotkey: "copy".to_string(),
            },
        ];

        for action in actions {
            assert!(validate_desktop_action(&action).is_ok());
        }
    }
}
