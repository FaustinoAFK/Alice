import ctypes
import ctypes.wintypes
import time

from element_recognition import elements_from_ocr
from input_controller import mouse_position
from ocr import create_ocr_provider

user32 = ctypes.windll.user32


def active_window_title():
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return ""
    length = user32.GetWindowTextLengthW(hwnd)
    buffer = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(hwnd, buffer, length + 1)
    return buffer.value


def build_visual_context(capture):
    ocr_result = {"available": False, "raw_text": "", "visible_texts": [], "error": ""}
    if capture.get("ok") and capture.get("screenshot_path"):
        provider = create_ocr_provider()
        ocr_result = provider.extract_text(capture["screenshot_path"])
    visible_texts = ocr_result.get("visible_texts") or []
    return {
        "screenshot_path": capture.get("screenshot_path") or "",
        "screenshot_id": capture.get("screenshot_id") or "",
        "timestamp": int(time.time() * 1000),
        "active_window_title": active_window_title(),
        "visible_texts": visible_texts,
        "detected_elements": elements_from_ocr(visible_texts),
        "mouse_position": mouse_position(),
        "confidence": 0.45 if visible_texts else 0.2,
        "raw_ocr": ocr_result.get("raw_text") or "",
        "notes": [ocr_result.get("error")] if ocr_result.get("error") else [],
        "ocr": ocr_result,
    }
