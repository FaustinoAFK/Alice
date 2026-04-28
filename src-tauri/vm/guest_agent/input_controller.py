import ctypes
import ctypes.wintypes
import time

user32 = ctypes.windll.user32

KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_UNICODE = 0x0004
INPUT_KEYBOARD = 1
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010


ULONG_PTR = ctypes.c_ulonglong if ctypes.sizeof(ctypes.c_void_p) == 8 else ctypes.c_ulong


class KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ("wVk", ctypes.wintypes.WORD),
        ("wScan", ctypes.wintypes.WORD),
        ("dwFlags", ctypes.wintypes.DWORD),
        ("time", ctypes.wintypes.DWORD),
        ("dwExtraInfo", ULONG_PTR),
    ]


class INPUTUNION(ctypes.Union):
    _fields_ = [
        ("ki", KEYBDINPUT),
    ]


class INPUT(ctypes.Structure):
    _anonymous_ = ("union",)
    _fields_ = [
        ("type", ctypes.wintypes.DWORD),
        ("union", INPUTUNION),
    ]


user32.SendInput.argtypes = (ctypes.wintypes.UINT, ctypes.POINTER(INPUT), ctypes.c_int)
user32.SendInput.restype = ctypes.wintypes.UINT

VK = {
    "enter": 0x0D,
    "esc": 0x1B,
    "escape": 0x1B,
    "tab": 0x09,
    "space": 0x20,
    "backspace": 0x08,
    "delete": 0x2E,
    "ctrl": 0x11,
    "control": 0x11,
    "shift": 0x10,
    "alt": 0x12,
    "win": 0x5B,
    "left": 0x25,
    "up": 0x26,
    "right": 0x27,
    "down": 0x28,
    "a": 0x41,
    "c": 0x43,
    "v": 0x56,
    "x": 0x58,
    "s": 0x53,
}


def foreground_window_title():
    hwnd = user32.GetForegroundWindow()
    buffer = ctypes.create_unicode_buffer(512)
    user32.GetWindowTextW(hwnd, buffer, 512)
    return buffer.value


def mouse_position():
    point = ctypes.wintypes.POINT()
    user32.GetCursorPos(ctypes.byref(point))
    return {"x": int(point.x), "y": int(point.y)}


def move_mouse(x, y):
    user32.SetCursorPos(int(x), int(y))
    return {"mouse_position": mouse_position()}


def click(x=None, y=None, button="left", clicks=1):
    if x is not None and y is not None:
        move_mouse(x, y)
    down = MOUSEEVENTF_RIGHTDOWN if button == "right" else MOUSEEVENTF_LEFTDOWN
    up = MOUSEEVENTF_RIGHTUP if button == "right" else MOUSEEVENTF_LEFTUP
    for _ in range(max(1, int(clicks))):
        user32.mouse_event(down, 0, 0, 0, 0)
        user32.mouse_event(up, 0, 0, 0, 0)
        time.sleep(0.05)
    return {"mouse_position": mouse_position(), "button": button, "clicks": clicks}


def _vk_for(key):
    key = str(key).strip().lower()
    if len(key) == 1 and "a" <= key <= "z":
        return ord(key.upper())
    if key.startswith("f") and key[1:].isdigit():
        number = int(key[1:])
        if 1 <= number <= 24:
            return 0x70 + number - 1
    if key not in VK:
        raise ValueError(f"unsupported_key: {key}")
    return VK[key]


def press_key(key):
    vk = _vk_for(key)
    user32.keybd_event(vk, 0, 0, 0)
    user32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)
    return {"key": key}


def hotkey(keys):
    vks = [_vk_for(key) for key in keys]
    for vk in vks:
        user32.keybd_event(vk, 0, 0, 0)
    for vk in reversed(vks):
        user32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)
    return {"keys": keys}


def _clipboard_paste(text):
    import subprocess
    escaped = str(text).replace("'", "''")
    script = f"Set-Clipboard -Value '{escaped}'"
    subprocess.run(["powershell.exe", "-NoProfile", "-Command", script], check=True)
    hotkey(["ctrl", "v"])
    return "clipboard_paste"


def _utf16_code_units(text):
    encoded = str(text).encode("utf-16-le", errors="surrogatepass")
    for index in range(0, len(encoded), 2):
        yield int.from_bytes(encoded[index:index + 2], "little")


def _send_unicode_unit(code_unit):
    down = INPUT(
        type=INPUT_KEYBOARD,
        union=INPUTUNION(ki=KEYBDINPUT(0, code_unit, KEYEVENTF_UNICODE, 0, 0)),
    )
    up = INPUT(
        type=INPUT_KEYBOARD,
        union=INPUTUNION(ki=KEYBDINPUT(0, code_unit, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP, 0, 0)),
    )
    sent_down = user32.SendInput(1, ctypes.byref(down), ctypes.sizeof(INPUT))
    sent_up = user32.SendInput(1, ctypes.byref(up), ctypes.sizeof(INPUT))
    if sent_down != 1 or sent_up != 1:
        raise RuntimeError("sendinput_unicode_failed")


def _type_unicode(text):
    for code_unit in _utf16_code_units(text):
        _send_unicode_unit(code_unit)
        time.sleep(0.002)
    return "unicode_sendinput"


def type_text(text, method="auto"):
    value = str(text)
    selected_method = str(method or "auto").strip().lower()
    before = foreground_window_title()
    used_method = ""
    fallback_error = ""

    try:
        if selected_method in {"clipboard", "paste"}:
            used_method = _clipboard_paste(value)
        else:
            used_method = _type_unicode(value)
    except Exception as exc:
        fallback_error = str(exc)
        if selected_method in {"unicode", "direct"}:
            raise
        used_method = _clipboard_paste(value)

    time.sleep(0.1)
    return {
        "typed_length": len(value),
        "method": used_method,
        "fallback_error": fallback_error,
        "active_window_before": before,
        "active_window_after": foreground_window_title(),
    }
