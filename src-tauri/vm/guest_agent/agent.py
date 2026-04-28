import argparse
import sys

from action_executor import execute_action
from protocol import decode_request, make_response, now_ms, print_response
from validation import validate_action_request


def main(argv=None):
    parser = argparse.ArgumentParser(description="Alice VM Guest Interaction Agent")
    parser.add_argument("--request-json", required=True, help="Base64 encoded JSON request")
    args = parser.parse_args(argv)
    started_at = now_ms()
    request = {}
    try:
        request = decode_request(args.request_json)
        action, parameters = validate_action_request(request)
        result, screenshot_id = execute_action(action, parameters)
        print_response(make_response(request, True, result=result, screenshot_id=screenshot_id, started_at=started_at))
        return 0
    except Exception as exc:
        print_response(make_response(request, False, error=str(exc), started_at=started_at))
        return 1


if __name__ == "__main__":
    sys.exit(main())
