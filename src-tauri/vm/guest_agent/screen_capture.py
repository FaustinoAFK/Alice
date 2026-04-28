import os
import time
import uuid


def screenshot_root():
    root = os.environ.get("ALICE_GUEST_SCREENSHOT_DIR") or os.path.join(os.environ.get("TEMP", "C:\\Temp"), "alice-guest-agent", "screens")
    os.makedirs(root, exist_ok=True)
    return root


def capture_screen():
    screenshot_id = f"screen-{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}"
    path = os.path.join(screenshot_root(), f"{screenshot_id}.png")
    try:
        from PIL import ImageGrab
    except Exception as exc:
        return {
            "ok": False,
            "error": f"screen_capture_requires_pillow: {exc}",
            "screenshot_id": screenshot_id,
            "screenshot_path": "",
            "capability": "disabled",
        }

    image = ImageGrab.grab()
    image.save(path, "PNG")
    return {
        "ok": True,
        "error": "",
        "screenshot_id": screenshot_id,
        "screenshot_path": path,
        "width": image.width,
        "height": image.height,
        "capability": "enabled",
    }
