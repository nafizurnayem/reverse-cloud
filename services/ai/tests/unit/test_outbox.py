import httpx

from app.jobs.outbox import _lead_text, _payload, _safe_error


def test_lead_message_contains_contact_and_message() -> None:
	text = _lead_text({
		"lead_id": "lead-1",
		"name": "Nafiz",
		"email": "nafiz@example.com",
		"message": "I need a new website.",
	})
	assert "Name: Nafiz" in text
	assert "Email: nafiz@example.com" in text
	assert "I need a new website." in text


def test_payload_accepts_asyncpg_json_text() -> None:
	assert _payload('{"lead_id":"lead-1"}') == {"lead_id": "lead-1"}
	assert _payload("[]") == {}


def test_provider_errors_do_not_store_secret_urls() -> None:
	request = httpx.Request("POST", "https://api.telegram.org/botSECRET/sendMessage")
	response = httpx.Response(401, request=request)
	error = httpx.HTTPStatusError("bad response", request=request, response=response)
	message = _safe_error(error)
	assert message == "Notification provider returned HTTP 401"
	assert "SECRET" not in message
