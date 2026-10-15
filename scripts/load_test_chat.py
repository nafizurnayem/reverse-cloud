#!/usr/bin/env python3
"""Chat Load Testing Tool (plan sections 4.5, 10).

Simulates concurrent user chat streams against the AI service or web proxy,
measuring Time To First Token (TTFT), total duration, success rates, and latency percentiles.

Usage:
    python scripts/load_test_chat.py --concurrency 10 --requests 50 --url http://127.0.0.1:8000/v1/chat
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import hmac
import json
import statistics
import time
from typing import Any

import httpx


def make_signature(body: bytes, timestamp: str, secret: str) -> str:
    message = f"{timestamp}.".encode() + body
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


async def simulate_chat_user(
    session_id: int,
    url: str,
    secret: str,
    results: list[dict[str, Any]],
    client: httpx.AsyncClient,
) -> None:
    payload = {
        "conversation_id": f"load-test-session-{session_id}",
        "messages": [
            {"role": "user", "content": "Tell me about Reverse Cloud development services and pricing."}
        ],
    }
    body_bytes = json.dumps(payload).encode()
    timestamp = str(int(time.time()))
    headers = {
        "content-type": "application/json",
        "x-ai-timestamp": timestamp,
        "x-ai-signature": make_signature(body_bytes, timestamp, secret),
    }

    start = time.perf_counter()
    first_token_time: float | None = None
    chunks_received = 0
    status_code = 0
    error: str | None = None

    try:
        async with client.stream("POST", url, content=body_bytes, headers=headers, timeout=30.0) as resp:
            status_code = resp.status_code
            if resp.status_code == 200:
                async for line in resp.aiter_lines():
                    if line.startswith("data:"):
                        chunks_received += 1
                        if first_token_time is None:
                            first_token_time = time.perf_counter() - start
            else:
                error = f"HTTP {resp.status_code}"
    except Exception as exc:
        error = str(exc)

    total_time = time.perf_counter() - start
    results.append({
        "session_id": session_id,
        "status_code": status_code,
        "ttft": first_token_time,
        "total_time": total_time,
        "chunks": chunks_received,
        "error": error,
        "success": error is None and status_code == 200,
    })


def print_summary(results: list[dict[str, Any]], total_elapsed: float) -> None:
    total = len(results)
    successful = [r for r in results if r["success"]]
    failed = [r for r in results if not r["success"]]

    print("\n" + "=" * 60)
    print("CHAT LOAD TEST REPORT")
    print("=" * 60)
    print(f"Total Requests:     {total}")
    print(f"Successful:         {len(successful)} ({len(successful)/total*100:.1f}%)")
    print(f"Failed:             {len(failed)} ({len(failed)/total*100:.1f}%)")
    print(f"Total Duration:     {total_elapsed:.2f}s")
    print(f"Throughput:         {total / total_elapsed:.2f} req/s")

    if successful:
        totals = [r["total_time"] for r in successful]
        ttfts = [r["ttft"] for r in successful if r["ttft"] is not None]

        print("\nLatency (Total Response Time):")
        print(f"  Min:  {min(totals)*1000:.1f} ms")
        print(f"  Avg:  {statistics.mean(totals)*1000:.1f} ms")
        print(f"  P50:  {statistics.median(totals)*1000:.1f} ms")
        if len(totals) >= 5:
            sorted_totals = sorted(totals)
            p90 = sorted_totals[int(0.90 * len(sorted_totals))]
            p95 = sorted_totals[int(0.95 * len(sorted_totals))]
            print(f"  P90:  {p90*1000:.1f} ms")
            print(f"  P95:  {p95*1000:.1f} ms")
        print(f"  Max:  {max(totals)*1000:.1f} ms")

        if ttfts:
            print("\nTime To First Token (TTFT):")
            print(f"  Min:  {min(ttfts)*1000:.1f} ms")
            print(f"  Avg:  {statistics.mean(ttfts)*1000:.1f} ms")
            print(f"  P50:  {statistics.median(ttfts)*1000:.1f} ms")

    if failed:
        print("\nErrors breakdown:")
        error_counts: dict[str, int] = {}
        for r in failed:
            msg = r["error"] or f"Status {r['status_code']}"
            error_counts[msg] = error_counts.get(msg, 0) + 1
        for msg, count in error_counts.items():
            print(f"  [{count}x] {msg}")
    print("=" * 60 + "\n")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Chat stream load tester")
    parser.add_argument("--url", default="http://127.0.0.1:8000/v1/chat", help="Target chat URL")
    parser.add_argument("--secret", default="test-secret-key", help="HMAC secret for service authentication")
    parser.add_argument("--concurrency", type=int, default=10, help="Concurrent workers")
    parser.add_argument("--requests", type=int, default=20, help="Total requests to dispatch")
    args = parser.parse_args()

    results: list[dict[str, Any]] = []
    semaphore = asyncio.Semaphore(args.concurrency)

    async def worker(req_id: int, client: httpx.AsyncClient) -> None:
        async with semaphore:
            await simulate_chat_user(req_id, args.url, args.secret, results, client)

    print(f"Starting chat load test: {args.requests} requests across {args.concurrency} concurrent workers...")
    start = time.perf_counter()

    async with httpx.AsyncClient() as client:
        tasks = [worker(i + 1, client) for i in range(args.requests)]
        await asyncio.gather(*tasks)

    elapsed = time.perf_counter() - start
    print_summary(results, elapsed)


if __name__ == "__main__":
    asyncio.run(main())
