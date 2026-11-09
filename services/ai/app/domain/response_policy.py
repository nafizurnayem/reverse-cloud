"""Deterministic replies and minimum quality checks for public chat output."""

from __future__ import annotations

import re

_SPACE = re.compile(r"\s+")
_PUNCTUATION = re.compile(r"[^\w\u0980-\u09ff]+", re.UNICODE)
_REPEATED_CHARACTER = re.compile(r"(.)\1{7,}", re.DOTALL)
_LOW_VALUE_EN = re.compile(
    r"^(?:i\s+)?(?:do\s+not|don['’]?t)\s+know|^no\s+idea|^not\s+sure",
    re.IGNORECASE,
)
_LOW_VALUE_BN = re.compile(r"^(?:আমি\s+)?জানি\s+না|^নিশ্চিত\s+নই")

_GREETINGS_EN = {
    "hi",
    "hello",
    "hey",
    "hi there",
    "hello there",
    "good morning",
    "good afternoon",
    "good evening",
}
_GREETINGS_BN = {
    "হাই",
    "হ্যালো",
    "হেলো",
    "সালাম",
    "আসসালামু আলাইকুম",
    "শুভ সকাল",
    "শুভ সন্ধ্যা",
}
_THANKS_EN = {"thanks", "thank you", "thank you very much", "thanks a lot"}
_THANKS_BN = {"ধন্যবাদ", "অনেক ধন্যবাদ"}
_GOODBYES_EN = {"bye", "goodbye", "see you", "talk later"}
_GOODBYES_BN = {"বিদায়", "আবার দেখা হবে", "পরে কথা হবে"}


def _normalized(text: str) -> str:
    return _SPACE.sub(" ", _PUNCTUATION.sub(" ", text.casefold())).strip()


def direct_reply(text: str, locale: str) -> str | None:
    """Handle trivial conversational turns without invoking an LLM or tools."""
    normalized = _normalized(text)
    is_bn = locale == "bn"
    if normalized in (_GREETINGS_BN if is_bn else _GREETINGS_EN):
        return (
            "হ্যালো! রিভার্স ক্লাউডে স্বাগতম। আমি আমাদের সেবা, প্রজেক্টের বাজেট, "
            "মিটিং বুকিং বা আপনার প্রজেক্টের পরিকল্পনা নিয়ে সাহায্য করতে পারি। আপনি কী নিয়ে কাজ করছেন?"
            if is_bn
            else "Hello! Welcome to Reverse Cloud. I can help with our services, project estimates, "
            "meeting bookings, or planning your project. What are you working on?"
        )
    if normalized in (_THANKS_BN if is_bn else _THANKS_EN):
        return (
            "স্বাগতম! আর কিছু জানতে বা পরিকল্পনা করতে চাইলে বলুন।"
            if is_bn
            else "You’re welcome! Tell me if you’d like help with anything else."
        )
    if normalized in (_GOODBYES_BN if is_bn else _GOODBYES_EN):
        return (
            "বিদায়! প্রয়োজন হলে যেকোনো সময় আবার যোগাযোগ করুন।"
            if is_bn
            else "Goodbye! Come back anytime if you need help with your project."
        )
    return None


def safe_fallback_reply(locale: str) -> str:
    if locale == "bn":
        return (
            "আমি এই প্রশ্নের নির্ভরযোগ্য উত্তর এখনই যাচাই করতে পারিনি। তবে আমাদের সেবা, "
            "প্রজেক্টের আনুমানিক বাজেট বা মিটিং বুকিংয়ে সাহায্য করতে পারি। চাইলে আমি টিমের কারও সঙ্গেও যুক্ত করে দেব।"
        )
    return (
        "I couldn’t verify a reliable answer to that yet. I can still help with our services, "
        "a project estimate, or booking a meeting—and I can connect you with the team if needed."
    )


def ensure_useful_reply(text: str, locale: str) -> str:
    """Replace empty, repetitive, or bare uncertainty output with a useful response."""
    reply = _SPACE.sub(" ", text).strip()
    if not reply or _REPEATED_CHARACTER.search(reply):
        return safe_fallback_reply(locale)
    if _LOW_VALUE_EN.search(reply) or _LOW_VALUE_BN.search(reply):
        return safe_fallback_reply(locale)
    words = re.findall(r"[\w\u0980-\u09ff]+", reply.casefold())
    if len(words) >= 6 and max(words.count(word) for word in set(words)) / len(words) >= 0.6:
        return safe_fallback_reply(locale)
    return reply
