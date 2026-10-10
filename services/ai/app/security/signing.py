import hashlib
import hmac
import time


class InvalidSignature(ValueError):
    pass


def verify_request_signature(body: bytes, timestamp: str, signature: str, secret: str, *, now: int | None = None) -> None:
    try:
        timestamp_value = int(timestamp)
    except (TypeError, ValueError) as error:
        raise InvalidSignature("invalid timestamp") from error
    current_time = int(time.time()) if now is None else now
    if abs(current_time - timestamp_value) > 300:
        raise InvalidSignature("expired timestamp")
    expected = hmac.new(secret.encode(), f"{timestamp}.{body.decode('utf-8')}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise InvalidSignature("invalid signature")
