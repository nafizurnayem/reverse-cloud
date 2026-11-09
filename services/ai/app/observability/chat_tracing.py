"""Structured completion logging kept outside orchestration."""

import logging

logger = logging.getLogger("reverse_cloud.chat")


def log_chat_completion(
    *,
    request_id: str,
    model: str,
    tokens_in: int,
    tokens_out: int,
    tools: list[str],
    duration_ms: int,
) -> None:
    logger.info(
        "AI chat complete request_id=%s model=%s tokens_in=%s tokens_out=%s tools=%s duration_ms=%s",
        request_id,
        model,
        tokens_in,
        tokens_out,
        ",".join(tools),
        duration_ms,
    )
