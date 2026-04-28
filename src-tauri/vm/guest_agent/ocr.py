class NullOCRProvider:
    name = "null_ocr"
    available = False

    def extract_text(self, screenshot_path):
        return {
            "provider": self.name,
            "available": False,
            "raw_text": "",
            "visible_texts": [],
            "error": "ocr_provider_unavailable",
        }


class TesseractOCRProvider:
    name = "pytesseract"

    def __init__(self):
        import pytesseract
        from PIL import Image
        self._pytesseract = pytesseract
        self._image = Image
        self.available = True

    def extract_text(self, screenshot_path):
        image = self._image.open(screenshot_path)
        raw = self._pytesseract.image_to_string(image)
        lines = [line.strip() for line in raw.splitlines() if line.strip()]
        return {
            "provider": self.name,
            "available": True,
            "raw_text": raw,
            "visible_texts": lines,
            "error": "",
        }


def create_ocr_provider():
    try:
        return TesseractOCRProvider()
    except Exception:
        return NullOCRProvider()
