import json
import os
import subprocess
import sys
import time


def now_ms():
    return int(time.time() * 1000)


def write_status(task_dir, payload):
    path = os.path.join(task_dir, "status.json")
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, path)


def main(argv=None):
    argv = argv or sys.argv[1:]
    if len(argv) < 4:
        return 2
    task_dir, command, args_json, timeout_text = argv[:4]
    os.makedirs(task_dir, exist_ok=True)
    stdout_path = os.path.join(task_dir, "stdout.log")
    stderr_path = os.path.join(task_dir, "stderr.log")
    timeout_seconds = int(timeout_text or "7200")
    args = json.loads(args_json or "[]")
    base_status = {
        "background_task_id": os.path.basename(task_dir),
        "command": command,
        "args": args,
        "pid": os.getpid(),
        "stdout_path": stdout_path,
        "stderr_path": stderr_path,
        "started_at": now_ms(),
    }
    write_status(task_dir, {**base_status, "status": "running", "exit_code": None, "finished_at": 0, "error": ""})
    try:
        with open(stdout_path, "w", encoding="utf-8", errors="replace") as stdout, open(stderr_path, "w", encoding="utf-8", errors="replace") as stderr:
            completed = subprocess.run([command, *args], stdout=stdout, stderr=stderr, text=True, timeout=timeout_seconds)
        write_status(task_dir, {
            **base_status,
            "status": "completed" if completed.returncode == 0 else "failed",
            "exit_code": completed.returncode,
            "finished_at": now_ms(),
            "error": "",
        })
        return completed.returncode
    except subprocess.TimeoutExpired:
        write_status(task_dir, {**base_status, "status": "timeout", "exit_code": None, "finished_at": now_ms(), "error": "background_command_timeout"})
        return 124
    except Exception as exc:
        write_status(task_dir, {**base_status, "status": "failed", "exit_code": None, "finished_at": now_ms(), "error": str(exc)})
        return 1


if __name__ == "__main__":
    sys.exit(main())
