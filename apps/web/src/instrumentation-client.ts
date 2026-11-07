type DetailValue = string | number | boolean;
type ActivityDetails = Record<string, DetailValue>;
type QueuedEvent = {
  type: string;
  page: string;
  clientTimestamp: number;
  details: ActivityDetails;
};

const endpoint = "/api/activity";
const originalFetch: typeof window.fetch = window.fetch.bind(window);
const queue: QueuedEvent[] = [];
let flushTimer: number | null = null;

function sessionId() {
  const key = "reverse-cloud-activity-session";
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

const browserSessionId = sessionId();

function stableSegment(segment: string) {
  if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment)) return ":id";
  if (segment.length > 48) return ":value";
  return /^[A-Za-z0-9._~-]+$/.test(segment) ? segment : ":value";
}

function safePath(input: string | URL) {
  try {
    const url = new URL(String(input), window.location.origin);
    const segments = url.pathname.split("/").map(stableSegment);
    return segments.join("/").slice(0, 200) || "/";
  } catch {
    return "/unknown";
  }
}

function identifier(value: string | null | undefined) {
  const candidate = value?.trim() ?? "";
  return /^[A-Za-z0-9:_-]{1,80}$/.test(candidate) ? candidate : "";
}

function elementDescriptor(target: EventTarget | null) {
  if (!(target instanceof Element)) return "unknown";
  const element = target.closest("a,button,input,select,textarea,[role='button'],[data-activity]") ?? target;
  const parts = [element.tagName.toLowerCase()];
  const activity = identifier(element.getAttribute("data-activity"));
  const id = identifier(element.id);
  const name = identifier(element.getAttribute("name"));
  const role = identifier(element.getAttribute("role"));
  const type = identifier(element.getAttribute("type"));

  if (activity) parts.push(`activity:${activity}`);
  if (id) parts.push(`id:${id}`);
  if (name) parts.push(`name:${name}`);
  if (role) parts.push(`role:${role}`);
  if (type) parts.push(`type:${type}`);
  if (element instanceof HTMLAnchorElement) parts.push(`href:${safePath(element.href)}`);
  return parts.join("|").slice(0, 160);
}

function fieldName(target: EventTarget | null) {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
    return "unknown";
  }
  return identifier(target.name) || identifier(target.id) || target.tagName.toLowerCase();
}

function scheduleFlush() {
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flush();
  }, 500);
}

function enqueue(type: string, details: ActivityDetails = {}) {
  queue.push({
    type,
    page: safePath(window.location.href),
    clientTimestamp: Date.now(),
    details,
  });
  if (queue.length > 100) queue.splice(0, queue.length - 100);
  scheduleFlush();
}

async function flush() {
  if (queue.length === 0) return;
  const events = queue.splice(0, 25);
  try {
    await originalFetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: browserSessionId, events }),
      credentials: "same-origin",
      keepalive: true,
    });
  } catch {
    // Monitoring must never interrupt the website or expose an error to users.
  }
  if (queue.length > 0) scheduleFlush();
}

function flushBeforeLeaving() {
  if (queue.length === 0 || !navigator.sendBeacon) return;
  const events = queue.splice(0, 25);
  const body = new Blob(
    [JSON.stringify({ sessionId: browserSessionId, events })],
    { type: "application/json" },
  );
  navigator.sendBeacon(endpoint, body);
}

document.addEventListener("click", (event) => {
  enqueue("click", { target: elementDescriptor(event.target) });
}, true);

document.addEventListener("submit", (event) => {
  enqueue("form_submit", { target: elementDescriptor(event.target) });
}, true);

document.addEventListener("change", (event) => {
  enqueue("field_change", {
    target: elementDescriptor(event.target),
    field: fieldName(event.target),
  });
}, true);

window.addEventListener("error", (event) => {
  enqueue("client_error", {
    errorName: event.error instanceof Error ? event.error.name : "Error",
  });
});

window.addEventListener("unhandledrejection", (event) => {
  enqueue("promise_rejection", {
    errorName: event.reason instanceof Error ? event.reason.name : "UnhandledRejection",
  });
});

window.addEventListener("pagehide", flushBeforeLeaving);

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  let url: URL | null = null;
  try {
    url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
  } catch {
    // Preserve native fetch behavior for malformed input.
  }

  const tracked = Boolean(
    url
    && url.origin === window.location.origin
    && url.pathname.startsWith("/api/")
    && url.pathname !== endpoint,
  );
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const startedAt = performance.now();

  if (tracked && url) enqueue("api_request", { method, target: safePath(url) });
  try {
    const response = await originalFetch(input, init);
    if (tracked && url) {
      enqueue("api_response", {
        method,
        target: safePath(url),
        status: response.status,
        ok: response.ok,
        durationMs: performance.now() - startedAt,
      });
    }
    return response;
  } catch (error) {
    if (tracked && url) {
      enqueue("api_error", {
        method,
        target: safePath(url),
        durationMs: performance.now() - startedAt,
        errorName: error instanceof Error ? error.name : "FetchError",
      });
    }
    throw error;
  }
};

enqueue("page_view", { target: "document" });

export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse",
) {
  enqueue("navigation", {
    target: safePath(url),
    navigationType,
  });
}
