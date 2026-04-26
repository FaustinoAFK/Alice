from __future__ import annotations

import io
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import alice_window_sidecar as sidecar


class NormalizeAliasTests(unittest.TestCase):
    def test_normalizes_browser_alias(self) -> None:
        self.assertEqual(sidecar.normalize_app_alias("msedge", "Microsoft Edge"), "browser")

    def test_normalizes_file_explorer_alias(self) -> None:
        self.assertEqual(sidecar.normalize_app_alias("explorer", "Arquivos"), "file_explorer")

    def test_returns_none_for_unknown_alias(self) -> None:
        self.assertIsNone(sidecar.normalize_app_alias("customapp", "Minha janela"))


class ProtocolTests(unittest.TestCase):
    def test_handle_request_returns_foreground_context(self) -> None:
        with patch.object(
            sidecar,
            "get_foreground_context",
            return_value=sidecar.ForegroundContext(
                window_title="Spotify Premium",
                process_name="Spotify",
                process_id=42,
                app_alias="Spotify",
            ),
        ):
            response = sidecar.handle_request(
                {"id": "req-1", "domain": "window_ui", "action": "get_foreground_context", "args": {}}
            )

        self.assertTrue(response["ok"])
        self.assertEqual(response["artifacts"]["windowTitle"], "Spotify Premium")
        self.assertEqual(response["artifacts"]["appAlias"], "Spotify")

    def test_handle_request_normalizes_sidecar_error(self) -> None:
        with patch.object(
            sidecar,
            "resolve_target",
            side_effect=sidecar.SidecarError("alvo ausente", "target_not_found"),
        ):
            response = sidecar.handle_request(
                {"id": "req-2", "domain": "window_ui", "action": "resolve_target", "args": {"target": "Salvar"}}
            )

        self.assertFalse(response["ok"])
        self.assertEqual(response["errorCode"], "target_not_found")
        self.assertEqual(response["message"], "alvo ausente")

    def test_sidecar_main_processes_jsonl_requests(self) -> None:
        payload = json.dumps(
            {"id": "req-3", "domain": "window_ui", "action": "list_windows", "args": {}}
        )
        input_stream = io.StringIO(payload + "\n")
        output_stream = io.StringIO()

        with patch.object(
            sidecar,
            "list_windows",
            return_value=[{"processName": "msedge", "windowTitle": "Docs", "appAlias": "browser"}],
        ):
            exit_code = sidecar.sidecar_main(input_stream=input_stream, output_stream=output_stream)

        self.assertEqual(exit_code, 0)
        response = json.loads(output_stream.getvalue().strip())
        self.assertTrue(response["ok"])
        self.assertEqual(response["artifacts"]["windows"][0]["appAlias"], "browser")


class ResolveTargetTests(unittest.TestCase):
    def test_resolve_target_interprets_json_payload(self) -> None:
        completed = type(
            "Completed",
            (),
            {"returncode": 0, "stdout": '{"found":true,"name":"Salvar","left":10,"top":20,"width":100,"height":30}', "stderr": ""},
        )()
        with patch.object(sidecar, "run_powershell", return_value=completed):
            result = sidecar.resolve_target("Salvar")

        self.assertEqual(result["target"], "Salvar")
        self.assertEqual(result["left"], 10)
        self.assertEqual(result["width"], 100)

    def test_resolve_target_raises_for_not_found(self) -> None:
        completed = type("Completed", (), {"returncode": 0, "stdout": '{"found":false}', "stderr": ""})()
        with patch.object(sidecar, "run_powershell", return_value=completed):
            with self.assertRaises(sidecar.SidecarError) as context:
                sidecar.resolve_target("Salvar")

        self.assertEqual(context.exception.error_code, "target_not_found")


if __name__ == "__main__":
    unittest.main()
