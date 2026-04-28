import subprocess
import json
import os
import sys
import time
import uuid

from input_controller import click, hotkey, move_mouse, press_key, type_text
from screen_capture import capture_screen
from visual_context import active_window_title, build_visual_context


def _tasks_root():
    root = os.environ.get("ALICE_GUEST_TASKS_DIR") or os.path.join(os.environ.get("TEMP", "C:\\Temp"), "alice-guest-agent", "tasks")
    os.makedirs(root, exist_ok=True)
    return root


def _tail(path, max_chars=4000):
    if not path or not os.path.exists(path):
        return ""
    with open(path, "r", encoding="utf-8", errors="replace") as handle:
        data = handle.read()
    return data[-max_chars:]


def _status_path(background_task_id):
    return os.path.join(_tasks_root(), background_task_id, "status.json")


def start_background_command(parameters):
    command = parameters.get("command")
    args = parameters.get("args") or []
    if not command:
        raise ValueError("start_background_command_requires_command")
    if not isinstance(args, list):
        raise ValueError("start_background_command_args_must_be_array")
    background_task_id = parameters.get("background_task_id") or parameters.get("backgroundTaskId") or f"guest-bg-{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}"
    task_dir = os.path.join(_tasks_root(), background_task_id)
    os.makedirs(task_dir, exist_ok=True)
    runner = os.path.join(os.path.dirname(__file__), "background_runner.py")
    timeout_seconds = int(parameters.get("timeout_seconds", parameters.get("timeoutSeconds", 7200)))
    status = {
        "background_task_id": background_task_id,
        "status": "starting",
        "runner_pid": None,
        "command": command,
        "args": args,
        "task_dir": task_dir,
        "status_path": _status_path(background_task_id),
        "stdout_path": os.path.join(task_dir, "stdout.log"),
        "stderr_path": os.path.join(task_dir, "stderr.log"),
        "started_at": int(time.time() * 1000),
    }
    with open(_status_path(background_task_id), "w", encoding="utf-8") as handle:
        json.dump(status, handle, ensure_ascii=False, separators=(",", ":"))
    process = subprocess.Popen(
        [sys.executable, runner, task_dir, command, json.dumps(args), str(timeout_seconds)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        close_fds=True,
    )
    status["runner_pid"] = process.pid
    return status


def get_background_command_status(parameters):
    background_task_id = parameters.get("background_task_id") or parameters.get("backgroundTaskId")
    if not background_task_id:
        raise ValueError("background_task_id_required")
    path = _status_path(background_task_id)
    if not os.path.exists(path):
        raise ValueError(f"background_task_not_found: {background_task_id}")
    with open(path, "r", encoding="utf-8", errors="replace") as handle:
        status = json.load(handle)
    stdout_path = status.get("stdout_path") or os.path.join(os.path.dirname(path), "stdout.log")
    stderr_path = status.get("stderr_path") or os.path.join(os.path.dirname(path), "stderr.log")
    return {
        **status,
        "stdout_tail": _tail(stdout_path),
        "stderr_tail": _tail(stderr_path),
    }


def cancel_background_command(parameters):
    status = get_background_command_status(parameters)
    pid = status.get("pid") or status.get("runner_pid")
    if not pid:
        raise ValueError("background_task_pid_unavailable")
    subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True, text=True)
    updated = {
        **status,
        "status": "cancelled",
        "finished_at": int(time.time() * 1000),
        "error": "cancelled_by_request",
    }
    with open(_status_path(status["background_task_id"]), "w", encoding="utf-8") as handle:
        json.dump(updated, handle, ensure_ascii=False, separators=(",", ":"))
    return updated


def execute_action(action, parameters):
    parameters = parameters or {}
    if action == "capture_screen":
        capture = capture_screen()
        return {"capture": capture, "visual_context": build_visual_context(capture)}, capture.get("screenshot_id")
    if action == "get_active_window":
        return {"active_window_title": active_window_title()}, None
    if action == "move_mouse":
        return move_mouse(parameters.get("x", 0), parameters.get("y", 0)), None
    if action == "click":
        return click(parameters.get("x"), parameters.get("y"), "left", 1), None
    if action == "double_click":
        return click(parameters.get("x"), parameters.get("y"), "left", 2), None
    if action == "right_click":
        return click(parameters.get("x"), parameters.get("y"), "right", 1), None
    if action == "type_text":
        return type_text(parameters.get("text", ""), parameters.get("method", "auto")), None
    if action == "press_key":
        return press_key(parameters.get("key", "")), None
    if action == "hotkey":
        return hotkey(parameters.get("keys", [])), None
    if action == "wait":
        duration_ms = max(0, min(60000, int(parameters.get("duration_ms", parameters.get("durationMs", 250)))))
        time.sleep(duration_ms / 1000)
        return {"waited_ms": duration_ms}, None
    if action == "run_command":
        command = parameters.get("command")
        args = parameters.get("args") or []
        if not command:
            raise ValueError("run_command_requires_command")
        completed = subprocess.run([command, *args], capture_output=True, text=True, timeout=parameters.get("timeout_seconds", 15))
        return {
            "exit_code": completed.returncode,
            "stdout": completed.stdout[-4000:],
            "stderr": completed.stderr[-4000:],
        }, None
    if action == "start_background_command":
        return start_background_command(parameters), None
    if action == "get_background_command_status":
        return get_background_command_status(parameters), None
    if action == "cancel_background_command":
        return cancel_background_command(parameters), None
    if action == "get_status":
        return {
            "online": True,
            "agent": "alice_guest_agent",
            "capabilities": {
                "can_capture_screen": True,
                "can_mouse": True,
                "can_keyboard": True,
                "can_type_unicode": True,
                "can_type_clipboard_fallback": True,
                "can_run_command": True,
                "can_run_background_command": True,
                "can_poll_background_command": True,
                "can_cancel_background_command": True,
                "ocr_provider": "optional",
            },
            "active_window_title": active_window_title(),
        }, None
    raise ValueError(f"unsupported_action: {action}")
