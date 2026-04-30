import argparse
import json
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from action_executor import execute_action
from protocol import make_response, now_ms
from validation import validate_action_request


class AgentServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, server_address, request_handler_class, token=""):
        super().__init__(server_address, request_handler_class)
        self.token = token or ""
        self.started_at = now_ms()


class AgentRequestHandler(BaseHTTPRequestHandler):
    server_version = "AliceGuestAgent/1.0"

    def log_message(self, _format, *_args):
        return

    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self):
        token = getattr(self.server, "token", "")
        if not token:
            return True
        return self.headers.get("X-Alice-Agent-Token", "") == token

    def do_GET(self):
        if self.path != "/health":
            self._send_json(404, {"ok": False, "error": "not_found"})
            return
        if not self._authorized():
            self._send_json(401, {"ok": False, "error": "unauthorized"})
            return
        self._send_json(200, {
            "ok": True,
            "agent": "alice_guest_agent_resident",
            "uptime_ms": max(0, now_ms() - getattr(self.server, "started_at", now_ms())),
        })

    def do_POST(self):
        if self.path != "/v1/action":
            self._send_json(404, {"success": False, "error": "not_found"})
            return
        if not self._authorized():
            self._send_json(401, {"success": False, "error": "unauthorized"})
            return

        started_at = now_ms()
        request = {}
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 1_000_000:
                raise ValueError("invalid_content_length")
            raw = self.rfile.read(content_length).decode("utf-8")
            request = json.loads(raw)
            if not isinstance(request, dict):
                raise ValueError("request_must_be_object")
            action, parameters = validate_action_request(request)
            result, screenshot_id = execute_action(action, parameters)
            self._send_json(200, make_response(
                request,
                True,
                result=result,
                screenshot_id=screenshot_id,
                started_at=started_at,
            ))
        except Exception as exc:
            self._send_json(200, make_response(
                request,
                False,
                error=str(exc),
                started_at=started_at,
            ))


def main(argv=None):
    parser = argparse.ArgumentParser(description="Alice VM Guest Interaction Agent resident server")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=38948)
    parser.add_argument("--token", default="")
    args = parser.parse_args(argv)

    if args.port <= 0 or args.port > 65535:
        raise ValueError("invalid_port")

    server = AgentServer((args.host, args.port), AgentRequestHandler, token=args.token)
    print(json.dumps({
        "ok": True,
        "agent": "alice_guest_agent_resident",
        "host": args.host,
        "port": args.port,
        "timestamp": int(time.time() * 1000),
    }, ensure_ascii=False, separators=(",", ":")), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    sys.exit(main())
