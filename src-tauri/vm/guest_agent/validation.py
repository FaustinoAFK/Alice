def validate_action_request(request):
    action = str(request.get("action") or "").strip()
    if not action:
        raise ValueError("action_required")
    parameters = request.get("parameters") or {}
    if not isinstance(parameters, dict):
        raise ValueError("parameters_must_be_object")
    return action, parameters
