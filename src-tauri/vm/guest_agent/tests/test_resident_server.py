import json
import os
import sys
import threading
import time
import unittest
from http.client import HTTPConnection
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AGENT_DIR))

from server import AgentRequestHandler, AgentServer


class ResidentServerTests(unittest.TestCase):
    def setUp(self):
        self.server = AgentServer(("127.0.0.1", 0), AgentRequestHandler, token="test-token")
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.host, self.port = self.server.server_address

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def request(self, method, path, body=None, token="test-token"):
        conn = HTTPConnection(self.host, self.port, timeout=5)
        headers = {}
        if token:
            headers["X-Alice-Agent-Token"] = token
        if body is not None:
            headers["Content-Type"] = "application/json"
            body = json.dumps(body)
        conn.request(method, path, body=body, headers=headers)
        response = conn.getresponse()
        payload = json.loads(response.read().decode("utf-8"))
        conn.close()
        return response.status, payload

    def test_health_requires_token_and_reports_online(self):
        unauthorized_status, unauthorized = self.request("GET", "/health", token="")
        status, payload = self.request("GET", "/health")

        self.assertEqual(unauthorized_status, 401)
        self.assertFalse(unauthorized["ok"])
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["agent"], "alice_guest_agent_resident")

    def test_action_uses_existing_protocol_shape(self):
        status, payload = self.request("POST", "/v1/action", {
            "protocol_version": "1.0",
            "request_id": "resident-test-wait",
            "correlation_id": "resident-test",
            "task_id": "resident-test",
            "action": "wait",
            "parameters": {"duration_ms": 1},
            "timestamp": int(time.time() * 1000),
        })

        self.assertEqual(status, 200)
        self.assertTrue(payload["success"])
        self.assertEqual(payload["request_id"], "resident-test-wait")
        self.assertEqual(payload["action"], "wait")
        self.assertEqual(payload["result"]["waited_ms"], 1)

    def test_action_error_is_json_not_connection_failure(self):
        status, payload = self.request("POST", "/v1/action", {
            "action": "unsupported_for_test",
            "parameters": {},
        })

        self.assertEqual(status, 200)
        self.assertFalse(payload["success"])
        self.assertIn("unsupported_action", payload["error"])


if __name__ == "__main__":
    unittest.main()
