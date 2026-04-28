import json
import os
import sys
import tempfile
import time
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from action_executor import execute_action


class BackgroundActionTests(unittest.TestCase):
    def test_background_command_lifecycle(self):
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.dict(os.environ, {"ALICE_GUEST_TASKS_DIR": tmp}):
                result, screenshot_id = execute_action("start_background_command", {
                    "command": sys.executable,
                    "args": ["-c", "print('alice-bg-ok')"],
                    "timeout_seconds": 10,
                    "background_task_id": "task-bg-test",
                })

                self.assertIsNone(screenshot_id)
                self.assertEqual(result["background_task_id"], "task-bg-test")
                self.assertEqual(result["status"], "starting")

                status = None
                for _ in range(120):
                    status, _ = execute_action("get_background_command_status", {
                        "background_task_id": "task-bg-test",
                    })
                    if status["status"] in {"completed", "failed", "timeout"}:
                        break
                    time.sleep(0.1)

                if status["status"] == "running":
                    execute_action("cancel_background_command", {"background_task_id": "task-bg-test"})
                self.assertEqual(status["status"], "completed")
                self.assertEqual(status["exit_code"], 0)
                self.assertIn("alice-bg-ok", status["stdout_tail"])
                with open(os.path.join(tmp, "task-bg-test", "status.json"), "r", encoding="utf-8") as handle:
                    persisted = json.load(handle)
                self.assertEqual(persisted["status"], "completed")

    def test_background_status_requires_known_task(self):
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.dict(os.environ, {"ALICE_GUEST_TASKS_DIR": tmp}):
                with self.assertRaisesRegex(ValueError, "background_task_not_found"):
                    execute_action("get_background_command_status", {"background_task_id": "missing"})


if __name__ == "__main__":
    unittest.main()
