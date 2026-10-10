import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
	const serviceUrl = process.env.AI_SERVICE_URL;
	const secret = process.env.AI_HMAC_SECRET_CURRENT;
	if (!serviceUrl || !secret) {
		return NextResponse.json({ error: "Estimate service is not configured" }, { status: 503 });
	}

	const body = await request.text();
	const timestamp = Math.floor(Date.now() / 1000).toString();
	const signature = createHmac("sha256", secret)
		.update(`${timestamp}.${body}`)
		.digest("hex");

	let response: Response;
	try {
		response = await fetch(`${serviceUrl.replace(/\/$/, "")}/v1/estimate`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-ai-timestamp": timestamp,
				"x-ai-signature": signature,
			},
			body,
			cache: "no-store",
		});
	} catch {
		return NextResponse.json({ error: "Estimate service unavailable" }, { status: 502 });
	}

	const responseBody = await response.text();
	return new NextResponse(responseBody, {
		status: response.status,
		headers: { "content-type": "application/json" },
	});
}
