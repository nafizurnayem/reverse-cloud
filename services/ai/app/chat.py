from collections.abc import AsyncIterator

from openai import AsyncOpenAI

from .config import get_settings
from .schemas.chat import ChatMessage, ChatRequest


async def stream_chat_completion(payload: ChatRequest) -> AsyncIterator[str]:
	settings = get_settings()
	if not settings.llm_api_key:
		raise RuntimeError("chat service is not configured")

	client = AsyncOpenAI(api_key=settings.llm_api_key)
	messages = [
		{
			"role": message.role,
			"content": message.content,
		}
		for message in payload.messages
	]
	stream = await client.chat.completions.create(
		model=settings.llm_model,
		messages=messages,
		stream=True,
	)
	try:
		async for chunk in stream:
			text = chunk.choices[0].delta.content if chunk.choices else None
			if text:
				yield text
	finally:
		await client.close()