def elements_from_ocr(visible_texts):
    elements = []
    for index, text in enumerate(visible_texts or []):
        lowered = text.lower()
        element_type = "text"
        clickable = False
        if any(token in lowered for token in ["ok", "cancel", "salvar", "save", "abrir", "open", "sim", "yes"]):
            element_type = "button"
            clickable = True
        elif "http" in lowered or "www." in lowered:
            element_type = "link"
            clickable = True
        elements.append({
            "type": element_type,
            "label": text,
            "bounding_box": {"x": 0, "y": index * 20, "width": 0, "height": 0},
            "confidence": 0.35,
            "source": "ocr",
            "clickable": clickable,
            "metadata": {"ocr_index": index},
        })
    return elements
