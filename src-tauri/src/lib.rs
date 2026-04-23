#![cfg_attr(test, allow(dead_code))]

use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

const GEMINI_LIVE_WS_ENDPOINT: &str =
    "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const MAX_TARGET_CHARS: usize = 120;
const MAX_MEMORY_JSON_BYTES: usize = 262_144;
const ALICE_MEMORY_FILE_NAME: &str = "alice-memory.json";

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
    ClickTarget {
        target: String,
        button: String,
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

fn validate_memory_json_payload(json: &str) -> Result<(), String> {
    let trimmed = json.trim();
    if trimmed.is_empty() {
        return Err("Memoria da Alice nao pode ser vazia.".to_string());
    }

    if trimmed.len() > MAX_MEMORY_JSON_BYTES {
        return Err(format!(
            "Memoria da Alice excede o limite de {} bytes.",
            MAX_MEMORY_JSON_BYTES
        ));
    }

    Ok(())
}

fn resolve_alice_memory_path(base_dir: &std::path::Path) -> PathBuf {
    base_dir.join(ALICE_MEMORY_FILE_NAME)
}

fn read_memory_json(path: &std::path::Path) -> Result<Option<String>, String> {
    match fs::read_to_string(path) {
        Ok(json) => Ok(Some(json)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!(
            "Falha ao ler a memoria local da Alice em {}: {error}",
            path.display()
        )),
    }
}

fn write_memory_json_atomic(path: &std::path::Path, json: &str) -> Result<(), String> {
    validate_memory_json_payload(json)?;

    let parent_dir = path.parent().ok_or_else(|| {
        format!(
            "Nao consegui resolver a pasta da memoria local da Alice em {}.",
            path.display()
        )
    })?;
    fs::create_dir_all(parent_dir).map_err(|error| {
        format!(
            "Falha ao criar a pasta da memoria local da Alice em {}: {error}",
            parent_dir.display()
        )
    })?;

    let temp_path = path.with_extension("json.tmp");
    let mut temp_file = File::create(&temp_path).map_err(|error| {
        format!(
            "Falha ao criar arquivo temporario da memoria local da Alice em {}: {error}",
            temp_path.display()
        )
    })?;
    temp_file.write_all(json.as_bytes()).map_err(|error| {
        format!(
            "Falha ao gravar o arquivo temporario da memoria local da Alice em {}: {error}",
            temp_path.display()
        )
    })?;
    temp_file.sync_all().map_err(|error| {
        format!(
            "Falha ao sincronizar o arquivo temporario da memoria local da Alice em {}: {error}",
            temp_path.display()
        )
    })?;
    drop(temp_file);

    if path.exists() {
        fs::remove_file(path).map_err(|error| {
            format!(
                "Falha ao substituir a memoria local da Alice em {}: {error}",
                path.display()
            )
        })?;
    }

    fs::rename(&temp_path, path).map_err(|error| {
        let _ = fs::remove_file(&temp_path);
        format!(
            "Falha ao concluir a gravacao atomica da memoria local da Alice em {}: {error}",
            path.display()
        )
    })?;

    Ok(())
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

fn validate_mouse_button(button: &str) -> Result<(), String> {
    match button {
        "left" | "right" => Ok(()),
        _ => Err(format!("Botao de mouse nao permitido: {button}")),
    }
}

fn validate_click_target_text(target: &str) -> Result<(), String> {
    let trimmed = target.trim();
    if trimmed.is_empty() {
        return Err("Alvo textual nao pode ser vazio.".to_string());
    }

    if trimmed.chars().count() > MAX_TARGET_CHARS {
        return Err(format!(
            "Alvo textual excede {MAX_TARGET_CHARS} caracteres."
        ));
    }

    Ok(())
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
            validate_mouse_button(button)?;

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
        DesktopAction::ClickTarget { target, button } => {
            validate_click_target_text(target)?;
            validate_mouse_button(button)
        }
        DesktopAction::TypeText { .. } => Ok(()),
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
    use std::process::Command;
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

    pub(crate) const UI_AUTOMATION_LOOKUP_SCRIPT: &str = r#"
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

function Get-SearchRoot {
  $focused = [System.Windows.Automation.AutomationElement]::FocusedElement
  if ($null -eq $focused) {
    return [System.Windows.Automation.AutomationElement]::RootElement
  }

  $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
  $current = $focused
  $parent = $walker.GetParent($current)

  while ($null -ne $parent -and $parent -ne [System.Windows.Automation.AutomationElement]::RootElement) {
    $current = $parent
    $parent = $walker.GetParent($current)
  }

  return $current
}

$target = ($env:ALICE_UI_TARGET ?? '').Trim()
if ([string]::IsNullOrWhiteSpace($target)) {
  throw 'Alvo textual ausente para UI Automation.'
}

$needle = $target.ToLowerInvariant()
$roots = @()
$searchRoot = Get-SearchRoot
if ($null -ne $searchRoot) {
  $roots += $searchRoot
}
$roots += [System.Windows.Automation.AutomationElement]::RootElement

$best = $null
$bestRect = $null
$bestScore = [int]::MinValue

foreach ($root in $roots) {
  if ($null -eq $root) {
    continue
  }

  $all = $root.FindAll(
    [System.Windows.Automation.TreeScope]::Subtree,
    [System.Windows.Automation.Condition]::TrueCondition
  )

  foreach ($candidate in $all) {
    try {
      $name = $candidate.Current.Name
      if ([string]::IsNullOrWhiteSpace($name)) {
        continue
      }

      if ($candidate.Current.IsOffscreen) {
        continue
      }

      $rect = $candidate.Current.BoundingRectangle
      if ($rect.Width -le 1 -or $rect.Height -le 1) {
        continue
      }

      $normalizedName = $name.ToLowerInvariant()
      if ($normalizedName.IndexOf($needle) -lt 0 -and $needle.IndexOf($normalizedName) -lt 0) {
        continue
      }

      $score = 0
      if ($normalizedName -eq $needle) {
        $score += 1000
      }
      $score += [Math]::Max(0, 250 - [Math]::Abs($normalizedName.Length - $needle.Length))

      $controlType = $candidate.Current.LocalizedControlType
      if ($controlType -match 'button|menu item|tab item|hyperlink|list item') {
        $score += 100
      }

      if ($score -gt $bestScore) {
        $bestScore = $score
        $best = $candidate
        $bestRect = $rect
      }
    } catch {
      continue
    }
  }

  if ($null -ne $best) {
    break
  }
}

if ($null -eq $best -or $null -eq $bestRect) {
  [PSCustomObject]@{ found = $false } | ConvertTo-Json -Compress
  return
}

[PSCustomObject]@{
  found = $true
  name = $best.Current.Name
  controlType = $best.Current.LocalizedControlType
  left = [Math]::Round($bestRect.Left)
  top = [Math]::Round($bestRect.Top)
  width = [Math]::Round($bestRect.Width)
  height = [Math]::Round($bestRect.Height)
} | ConvertTo-Json -Compress
"#;

    #[derive(Debug, serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub(crate) struct UiAutomationLookupResult {
        found: bool,
        name: Option<String>,
        control_type: Option<String>,
        left: Option<i32>,
        top: Option<i32>,
        width: Option<i32>,
        height: Option<i32>,
    }

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

    fn move_cursor_absolute(pixel_x: i32, pixel_y: i32) -> Result<(), String> {
        let moved = unsafe { SetCursorPos(pixel_x, pixel_y) };

        if moved == 0 {
            return Err("Windows recusou mover o cursor.".to_string());
        }

        Ok(())
    }

    fn click_current_cursor(button: &str) -> Result<(), String> {
        let (down, up) = match button {
            "left" => (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP),
            "right" => (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP),
            _ => return Err(format!("Botao de mouse nao permitido: {button}")),
        };

        send_inputs(&[mouse_input(0, 0, down), mouse_input(0, 0, up)])
    }

    pub(crate) fn parse_ui_automation_lookup_result(
        output: &[u8],
    ) -> Result<Option<UiAutomationLookupResult>, String> {
        let text = String::from_utf8_lossy(output).trim().to_string();
        if text.is_empty() {
            return Ok(None);
        }

        let parsed: UiAutomationLookupResult =
            serde_json::from_str(&text).map_err(|error| format!("Falha ao interpretar UI Automation: {error}"))?;

        if parsed.found {
            Ok(Some(parsed))
        } else {
            Ok(None)
        }
    }

    fn run_ui_automation_lookup(target: &str) -> Result<Option<UiAutomationLookupResult>, String> {
        let output = Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                UI_AUTOMATION_LOOKUP_SCRIPT,
            ])
            .env("ALICE_UI_TARGET", target)
            .output()
            .map_err(|error| format!("Falha ao executar UI Automation via PowerShell: {error}"))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(if stderr.is_empty() {
                "UI Automation falhou ao procurar o alvo acessivel.".to_string()
            } else {
                format!("UI Automation falhou ao procurar o alvo acessivel: {stderr}")
            });
        }

        parse_ui_automation_lookup_result(&output.stdout)
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
        move_cursor_absolute(pixel_x, pixel_y)?;

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

        click_current_cursor(button)?;
        Ok("Clique executado.".to_string())
    }

    pub fn click_target(button: &str, target: &str) -> Result<String, String> {
        let lookup = run_ui_automation_lookup(target)?
            .ok_or_else(|| format!("Nenhum elemento acessivel corresponde a '{target}'."))?;

        let left = lookup
            .left
            .ok_or_else(|| "UI Automation nao retornou a coordenada esquerda.".to_string())?;
        let top = lookup
            .top
            .ok_or_else(|| "UI Automation nao retornou a coordenada superior.".to_string())?;
        let width = lookup
            .width
            .ok_or_else(|| "UI Automation nao retornou a largura do alvo.".to_string())?;
        let height = lookup
            .height
            .ok_or_else(|| "UI Automation nao retornou a altura do alvo.".to_string())?;

        if width <= 1 || height <= 1 {
            return Err("UI Automation retornou um retangulo invalido para o alvo.".to_string());
        }

        let pixel_x = left + (width / 2);
        let pixel_y = top + (height / 2);
        move_cursor_absolute(pixel_x, pixel_y)?;
        click_current_cursor(button)?;

        let target_name = lookup.name.unwrap_or_else(|| target.to_string());
        let control_type = lookup
            .control_type
            .unwrap_or_else(|| "controle".to_string());

        Ok(format!(
            "Clique acessivel executado em '{target_name}' ({control_type}) em {pixel_x},{pixel_y}."
        ))
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
            DesktopAction::ClickTarget { target, button } => click_target(button, target),
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
        | DesktopAction::ClickTarget { .. }
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
fn load_alice_memory_json(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Falha ao localizar a pasta de dados da Alice: {error}"))?;
    read_memory_json(&resolve_alice_memory_path(&app_data_dir))
}

#[tauri::command]
fn save_alice_memory_json(app: tauri::AppHandle, json: String) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Falha ao localizar a pasta de dados da Alice: {error}"))?;
    write_memory_json_atomic(&resolve_alice_memory_path(&app_data_dir), &json)
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
            load_alice_memory_json,
            save_alice_memory_json,
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
    fn validation_rejects_invalid_mouse_button() {
        assert!(validate_mouse_button("middle").is_err());
    }

    #[test]
    fn validation_accepts_large_type_text_payload() {
        let action = DesktopAction::TypeText {
            text: "a".repeat(20_000),
        };

        assert!(validate_desktop_action(&action).is_ok());
    }

    #[test]
    fn validation_rejects_empty_click_target() {
        let action = DesktopAction::ClickTarget {
            target: "   ".to_string(),
            button: "left".to_string(),
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
            DesktopAction::ClickTarget {
                target: "Salvar".to_string(),
                button: "left".to_string(),
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

    #[test]
    fn validate_memory_json_payload_rejects_empty_payload() {
        assert!(validate_memory_json_payload("   ").is_err());
    }

    #[test]
    fn resolve_alice_memory_path_appends_expected_file_name() {
        let path = resolve_alice_memory_path(std::path::Path::new("C:\\temp\\alice"));

        assert_eq!(
            path,
            PathBuf::from("C:\\temp\\alice").join(ALICE_MEMORY_FILE_NAME)
        );
    }

    #[test]
    fn read_memory_json_returns_none_for_missing_file() {
        let base_dir =
            std::env::temp_dir().join(format!("alice-memory-test-missing-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base_dir);
        let memory_path = resolve_alice_memory_path(&base_dir);

        assert_eq!(read_memory_json(&memory_path), Ok(None));
    }

    #[test]
    fn write_memory_json_atomic_creates_and_replaces_file_contents() {
        let base_dir = std::env::temp_dir().join(format!(
            "alice-memory-test-write-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let memory_path = resolve_alice_memory_path(&base_dir);

        write_memory_json_atomic(&memory_path, "{\"ok\":true}").unwrap();
        assert_eq!(
            read_memory_json(&memory_path),
            Ok(Some("{\"ok\":true}".to_string()))
        );

        write_memory_json_atomic(&memory_path, "{\"ok\":false}").unwrap();
        assert_eq!(
            read_memory_json(&memory_path),
            Ok(Some("{\"ok\":false}".to_string()))
        );

        let _ = fs::remove_dir_all(&base_dir);
    }

    #[test]
    fn ui_automation_script_mentions_the_target_environment_variable() {
        assert!(windows_input::UI_AUTOMATION_LOOKUP_SCRIPT.contains("ALICE_UI_TARGET"));
    }

    #[test]
    fn parse_ui_automation_lookup_result_handles_found_payload() {
        let parsed = windows_input::parse_ui_automation_lookup_result(
            br#"{"found":true,"name":"Salvar","controlType":"button","left":100,"top":200,"width":80,"height":24}"#,
        )
        .unwrap();

        assert!(parsed.is_some());
    }

    #[test]
    fn parse_ui_automation_lookup_result_handles_not_found_payload() {
        let parsed =
            windows_input::parse_ui_automation_lookup_result(br#"{"found":false}"#).unwrap();

        assert!(parsed.is_none());
    }
}
