from __future__ import annotations

import ctypes
import json
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


FOCUS_WINDOW_SCRIPT = r"""
$patterns = ($env:ALICE_WINDOW_PATTERNS -split '\|') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
$matchesPattern = {
  param($value)
  foreach ($pattern in $patterns) {
    if ($value -like $pattern) {
      return $true
    }
  }
  return $false
}

$targets = Get-Process | Where-Object {
  $_.MainWindowHandle -ne 0 -and (
    (& $matchesPattern $_.ProcessName) -or
    (& $matchesPattern $_.MainWindowTitle)
  )
}

if (-not $targets) { throw 'Nao encontrei a janela do app.' }

$wshell = New-Object -ComObject WScript.Shell
foreach ($target in $targets) {
  if ($wshell.AppActivate($target.Id)) {
    Start-Sleep -Milliseconds 120
    [PSCustomObject]@{
      ok = $true
      processName = $target.ProcessName
      windowTitle = $target.MainWindowTitle
      processId = $target.Id
    } | ConvertTo-Json -Compress
    return
  }
}

throw 'Encontrei a janela, mas nao consegui foca-la.'
"""

LIST_WINDOWS_SCRIPT = r"""
Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and -not [string]::IsNullOrWhiteSpace($_.MainWindowTitle) } |
Select-Object ProcessName,Id,MainWindowTitle |
ConvertTo-Json -Compress
"""

UI_AUTOMATION_LOOKUP_SCRIPT = r"""
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
"""


class SidecarError(RuntimeError):
    def __init__(self, message: str, error_code: str = "sidecar_error") -> None:
        super().__init__(message)
        self.error_code = error_code


@dataclass
class ForegroundContext:
    window_title: str
    process_name: str
    process_id: int | None
    app_alias: str | None

    def to_artifacts(self) -> dict[str, Any]:
        return {
            "windowTitle": self.window_title,
            "processName": self.process_name,
            "processId": self.process_id,
            "appAlias": self.app_alias,
        }


def _is_windows() -> bool:
    return os.name == "nt"


def normalize_app_alias(name: str | None, window_title: str | None = None) -> str | None:
    tokens = " ".join([name or "", window_title or ""]).lower()
    if not tokens.strip():
        return None

    if any(item in tokens for item in ("chrome", "msedge", "edge", "firefox", "brave", "opera", "browser", "navegador")):
        return "browser"
    if any(item in tokens for item in ("explorer", "explorador", "arquivos", "file explorer")):
        return "file_explorer"
    if any(item in tokens for item in ("notepad", "bloco de notas")):
        return "notepad"
    if any(item in tokens for item in ("calc", "calculator", "calculadora")):
        return "calculator"
    if "spotify" in tokens:
        return "Spotify"
    return None


def wildcard_patterns(value: str) -> str:
    cleaned = str(value or "").strip()
    if not cleaned:
        raise SidecarError("app ou windowTitle obrigatorio.", "window_not_found")
    normalized = cleaned.lower()

    aliases = {
        "browser": ["*chrome*", "*msedge*", "*firefox*", "*brave*", "*opera*", "*browser*", "*navegador*"],
        "navegador": ["*chrome*", "*msedge*", "*firefox*", "*brave*", "*opera*", "*browser*", "*navegador*"],
        "file_explorer": ["*explorer*", "*explorador*", "*arquivos*"],
        "notepad": ["*notepad*", "*bloco de notas*"],
        "calculator": ["*calc*", "*calculator*", "*calculadora*"],
    }
    patterns = aliases.get(normalized, [f"*{cleaned}*"])
    return "|".join(patterns)


def run_powershell(script: str, env: dict[str, str] | None = None, timeout_ms: int = 4_000) -> subprocess.CompletedProcess[str]:
    if not _is_windows():
        raise SidecarError("Automacao Windows indisponivel neste ambiente.", "python_sidecar_unavailable")

    full_env = os.environ.copy()
    if env:
        full_env.update(env)

    try:
        return subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                script,
            ],
            env=full_env,
            capture_output=True,
            text=True,
            timeout=max(0.1, timeout_ms / 1000),
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise SidecarError(
            f"PowerShell expirou apos {timeout_ms}ms.",
            "python_timeout",
        ) from error
    except OSError as error:
        raise SidecarError(
            f"Nao consegui iniciar o backend PowerShell do sidecar: {error}",
            "python_sidecar_unavailable",
        ) from error


def ensure_success(result: subprocess.CompletedProcess[str], default_message: str, error_code: str) -> str:
    if result.returncode == 0:
        text = (result.stdout or "").strip()
        return text or default_message

    stderr = (result.stderr or "").strip()
    stdout = (result.stdout or "").strip()
    message = stderr or stdout or default_message
    raise SidecarError(message, error_code)


def _get_user32() -> Any:
    user32 = ctypes.windll.user32
    user32.GetForegroundWindow.restype = ctypes.c_void_p
    user32.GetWindowTextLengthW.argtypes = [ctypes.c_void_p]
    user32.GetWindowTextLengthW.restype = ctypes.c_int
    user32.GetWindowTextW.argtypes = [ctypes.c_void_p, ctypes.c_wchar_p, ctypes.c_int]
    user32.GetWindowTextW.restype = ctypes.c_int
    user32.GetWindowThreadProcessId.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_ulong)]
    user32.GetWindowThreadProcessId.restype = ctypes.c_ulong
    user32.SetCursorPos.argtypes = [ctypes.c_int, ctypes.c_int]
    user32.SetCursorPos.restype = ctypes.c_int
    user32.mouse_event.argtypes = [
        ctypes.c_uint,
        ctypes.c_uint,
        ctypes.c_uint,
        ctypes.c_uint,
        ctypes.c_ulong,
    ]
    return user32


def get_process_name(process_id: int | None) -> str:
    if not process_id:
        return ""

    result = run_powershell(
        "(Get-Process -Id $env:ALICE_PROCESS_ID | Select-Object -ExpandProperty ProcessName)",
        env={"ALICE_PROCESS_ID": str(process_id)},
        timeout_ms=2_000,
    )
    return ensure_success(result, "", "window_not_found")


def get_foreground_context() -> ForegroundContext:
    if not _is_windows():
        raise SidecarError("Automacao Windows indisponivel neste ambiente.", "python_sidecar_unavailable")

    user32 = _get_user32()
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        raise SidecarError("Nao encontrei janela em foco.", "window_not_found")

    length = user32.GetWindowTextLengthW(hwnd)
    buffer = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(hwnd, buffer, length + 1)
    title = buffer.value.strip()
    if not title:
        raise SidecarError("A janela em foco nao possui titulo utilizavel.", "window_not_found")

    process_id = ctypes.c_ulong()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(process_id))
    process_name = get_process_name(process_id.value).strip()
    return ForegroundContext(
        window_title=title,
        process_name=process_name,
        process_id=process_id.value or None,
        app_alias=normalize_app_alias(process_name, title),
    )


def list_windows() -> list[dict[str, Any]]:
    result = run_powershell(LIST_WINDOWS_SCRIPT, timeout_ms=4_000)
    text = ensure_success(result, "[]", "window_not_found")
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as error:
        raise SidecarError(f"Falha ao interpretar lista de janelas: {error}", "uia_failure") from error

    if isinstance(parsed, dict):
        parsed = [parsed]
    windows = []
    for item in parsed:
        process_name = str(item.get("ProcessName") or "").strip()
        window_title = str(item.get("MainWindowTitle") or "").strip()
        windows.append(
            {
                "processName": process_name,
                "windowTitle": window_title,
                "processId": item.get("Id"),
                "appAlias": normalize_app_alias(process_name, window_title),
            }
        )
    return windows


def focus_window(app: str | None = None, window_title: str | None = None) -> dict[str, Any]:
    needle = window_title or app
    patterns = wildcard_patterns(needle)
    result = run_powershell(
        FOCUS_WINDOW_SCRIPT,
        env={"ALICE_WINDOW_PATTERNS": patterns},
        timeout_ms=4_000,
    )
    text = ensure_success(result, "Janela focada.", "window_not_found")
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return {"message": text}
    parsed["appAlias"] = normalize_app_alias(parsed.get("processName"), parsed.get("windowTitle"))
    return parsed


def resolve_target(target: str) -> dict[str, Any]:
    cleaned = str(target or "").strip()
    if not cleaned:
        raise SidecarError("target obrigatorio.", "target_not_found")

    result = run_powershell(
        UI_AUTOMATION_LOOKUP_SCRIPT,
        env={"ALICE_UI_TARGET": cleaned},
        timeout_ms=5_000,
    )
    text = ensure_success(result, "", "uia_failure")
    try:
        parsed = json.loads(text) if text else {}
    except json.JSONDecodeError as error:
        raise SidecarError(f"Falha ao interpretar UI Automation: {error}", "uia_failure") from error

    if not parsed or not parsed.get("found"):
        raise SidecarError(f"Nenhum elemento acessivel corresponde a '{cleaned}'.", "target_not_found")

    return {
        "target": parsed.get("name") or cleaned,
        "controlType": parsed.get("controlType"),
        "left": parsed.get("left"),
        "top": parsed.get("top"),
        "width": parsed.get("width"),
        "height": parsed.get("height"),
    }


def click_target(target: str, button: str = "left") -> dict[str, Any]:
    if button not in {"left", "right"}:
        raise SidecarError(f"Botao de mouse nao permitido: {button}", "uia_failure")

    resolved = resolve_target(target)
    left = int(resolved.get("left") or 0)
    top = int(resolved.get("top") or 0)
    width = int(resolved.get("width") or 0)
    height = int(resolved.get("height") or 0)
    if width <= 1 or height <= 1:
        raise SidecarError("UI Automation retornou um retangulo invalido para o alvo.", "uia_failure")

    pixel_x = left + width // 2
    pixel_y = top + height // 2
    if not _is_windows():
        raise SidecarError("Automacao Windows indisponivel neste ambiente.", "python_sidecar_unavailable")

    user32 = _get_user32()
    if user32.SetCursorPos(pixel_x, pixel_y) == 0:
        raise SidecarError("Windows recusou mover o cursor.", "uia_failure")

    event_down = 0x0002 if button == "left" else 0x0008
    event_up = 0x0004 if button == "left" else 0x0010
    user32.mouse_event(event_down, 0, 0, 0, 0)
    user32.mouse_event(event_up, 0, 0, 0, 0)
    return {
        "message": f"Clique acessivel executado em '{resolved['target']}' em {pixel_x},{pixel_y}.",
        "target": resolved["target"],
        "controlType": resolved.get("controlType"),
        "x": pixel_x,
        "y": pixel_y,
    }


def build_response(
    request_id: str,
    ok: bool,
    message: str,
    *,
    artifacts: dict[str, Any] | list[Any] | None = None,
    stdout: str | None = None,
    stderr: str | None = None,
    error_code: str | None = None,
) -> dict[str, Any]:
    response: dict[str, Any] = {
        "id": request_id,
        "ok": ok,
        "message": message,
        "artifacts": artifacts,
        "stdout": stdout,
        "stderr": stderr,
    }
    if error_code:
        response["errorCode"] = error_code
    return response


def handle_request(request: dict[str, Any]) -> dict[str, Any]:
    request_id = str(request.get("id") or "").strip() or "unknown"
    action = str(request.get("action") or "").strip()
    args = request.get("args") or {}

    try:
        if request.get("domain") != "window_ui":
            raise SidecarError("Dominio nao suportado pelo sidecar Python.", "python_sidecar_unavailable")

        if action == "get_foreground_context":
            context = get_foreground_context()
            return build_response(
                request_id,
                True,
                "Janela em foco identificada.",
                artifacts=context.to_artifacts(),
            )

        if action == "list_windows":
            windows = list_windows()
            return build_response(
                request_id,
                True,
                "Lista de janelas obtida.",
                artifacts={"windows": windows},
            )

        if action == "focus_window":
            focused = focus_window(args.get("app"), args.get("windowTitle"))
            return build_response(
                request_id,
                True,
                "Janela focada.",
                artifacts=focused,
            )

        if action == "resolve_target":
            resolved = resolve_target(args.get("target"))
            return build_response(
                request_id,
                True,
                f"Alvo resolvido para '{resolved['target']}'.",
                artifacts=resolved,
            )

        if action == "click_target":
            clicked = click_target(args.get("target"), args.get("button") or "left")
            return build_response(
                request_id,
                True,
                clicked["message"],
                artifacts=clicked,
            )

        raise SidecarError(f"Acao window/ui nao suportada: {action}", "python_sidecar_unavailable")
    except SidecarError as error:
        return build_response(request_id, False, str(error), error_code=error.error_code)
    except Exception as error:  # pragma: no cover - defensive normalization
        return build_response(request_id, False, str(error), error_code="python_sidecar_unavailable")


def iter_requests(stream: Any) -> Any:
    for line in stream:
        stripped = line.strip()
        if not stripped:
            continue
        yield json.loads(stripped)


def sidecar_main(input_stream: Any = None, output_stream: Any = None) -> int:
    input_stream = input_stream or sys.stdin
    output_stream = output_stream or sys.stdout

    for request in iter_requests(input_stream):
        response = handle_request(request)
        output_stream.write(json.dumps(response, ensure_ascii=True) + "\n")
        output_stream.flush()

    return 0


def resolve_sidecar_entrypoint() -> Path:
    return Path(__file__).resolve()
