    use super::{
        choose_target_screen, normalized_point_to_screen_pixel, DesktopAction, ScreenRect,
    };
    use std::mem::size_of;
    use std::process::Command;
    use std::ptr::null;
    use windows_sys::Win32::Foundation::{LPARAM, RECT};
    use windows_sys::Win32::Graphics::Gdi::{
        EnumDisplayMonitors, GetMonitorInfoW, HDC, HMONITOR, MONITORINFO,
    };
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, INPUT_MOUSE, KEYBDINPUT, KEYEVENTF_KEYUP,
        KEYEVENTF_UNICODE, MOUSEEVENTF_HWHEEL, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP,
        MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP, MOUSEEVENTF_WHEEL, MOUSEINPUT, VIRTUAL_KEY,
        VK_A, VK_C, VK_CONTROL, VK_ESCAPE, VK_MENU, VK_RETURN, VK_S, VK_TAB, VK_V, VK_Z,
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

$rawTarget = $env:ALICE_UI_TARGET
if ($null -eq $rawTarget) {
  $rawTarget = ''
}
$target = $rawTarget.Trim()
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

    fn mouse_wheel_input(data: i32, flags: u32) -> INPUT {
        INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT {
                    dx: 0,
                    dy: 0,
                    mouseData: data as u32,
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

        let parsed: UiAutomationLookupResult = serde_json::from_str(&text)
            .map_err(|error| format!("Falha ao interpretar UI Automation: {error}"))?;

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

    pub fn resolve_target(target: &str) -> Result<Option<serde_json::Value>, String> {
        Ok(run_ui_automation_lookup(target)?.map(|lookup| {
            serde_json::json!({
                "found": true,
                "name": lookup.name,
                "controlType": lookup.control_type,
                "left": lookup.left,
                "top": lookup.top,
                "width": lookup.width,
                "height": lookup.height,
            })
        }))
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

    pub fn press_key_name(key: &str) -> Result<String, String> {
        match key.trim().to_lowercase().as_str() {
            "enter" => press_key(VK_RETURN)?,
            "escape" | "esc" => press_key(VK_ESCAPE)?,
            "tab" => press_key(VK_TAB)?,
            _ => return Err(format!("Tecla nao suportada: {key}")),
        }

        Ok("Tecla executada.".to_string())
    }

    pub fn scroll(delta_x: i32, delta_y: i32) -> Result<String, String> {
        let mut inputs = Vec::new();

        if delta_y != 0 {
            inputs.push(mouse_wheel_input(delta_y, MOUSEEVENTF_WHEEL));
        }

        if delta_x != 0 {
            inputs.push(mouse_wheel_input(delta_x, MOUSEEVENTF_HWHEEL));
        }

        if inputs.is_empty() {
            return Err("Scroll precisa de deltaX ou deltaY.".to_string());
        }

        send_inputs(&inputs)?;
        Ok("Scroll executado.".to_string())
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
