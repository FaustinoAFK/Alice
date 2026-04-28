import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import input_controller


class InputControllerTests(unittest.TestCase):
    def test_utf16_code_units_preserve_non_ascii_text(self):
        units = list(input_controller._utf16_code_units("ação 🚀"))

        self.assertIn(ord("ç"), units)
        self.assertIn(ord("ã"), units)
        self.assertGreater(len(units), len("ação "))

    def test_type_text_uses_unicode_sendinput_by_default(self):
        with mock.patch.object(input_controller, "foreground_window_title", side_effect=["Notepad", "*Notepad"]):
            with mock.patch.object(input_controller, "_type_unicode", return_value="unicode_sendinput") as typed:
                with mock.patch.object(input_controller, "_clipboard_paste") as clipboard:
                    result = input_controller.type_text("alice ok")

        typed.assert_called_once_with("alice ok")
        clipboard.assert_not_called()
        self.assertEqual(result["method"], "unicode_sendinput")
        self.assertEqual(result["active_window_before"], "Notepad")
        self.assertEqual(result["active_window_after"], "*Notepad")

    def test_type_text_auto_falls_back_to_clipboard_when_unicode_fails(self):
        with mock.patch.object(input_controller, "foreground_window_title", side_effect=["Notepad", "Notepad"]):
            with mock.patch.object(input_controller, "_type_unicode", side_effect=RuntimeError("sendinput failed")):
                with mock.patch.object(input_controller, "_clipboard_paste", return_value="clipboard_paste") as clipboard:
                    result = input_controller.type_text("alice fallback")

        clipboard.assert_called_once_with("alice fallback")
        self.assertEqual(result["method"], "clipboard_paste")
        self.assertEqual(result["fallback_error"], "sendinput failed")


if __name__ == "__main__":
    unittest.main()
