import base64
import json
import time
import uuid

PROTOCOL_VERSION = "1.0"


def now_ms():
    return int(time.time() * 1000)


def make_response(request, success, result=None, error=None, screenshot_id=None, started_at=None):
    return {
        "protocol_version": PROTOCOL_VERSION,
        "request_id": request.get("request_id") or "",
        "correlation_id": request.get("correlation_id") or "",
        "action": request.get("action") or "",
        "success": bool(success),
        "result": result or {},
        "error": error or "",
        "screenshot_id": screenshot_id or "",
        "timestamp": now_ms(),
        "duration_ms": max(0, now_ms() - (started_at or now_ms())),
    }


def decode_request(encoded):
    if not encoded:
        raise ValueError("request-json is required")
    raw = base64.b64decode(encoded).decode("utf-8")
    request = json.loads(raw)
    if not isinstance(request, dict):
        raise ValueError("request must be an object")
    request.setdefault("request_id", f"guest-{uuid.uuid4().hex}")
    request.setdefault("timestamp", now_ms())
    request.setdefault("parameters", {})
    return request


def print_response(response):
    print(json.dumps(response, ensure_ascii=False, separators=(",", ":")))
