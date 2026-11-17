const defaultWordDelayMs = 24;

export function splitChatTextIntoWords(text: string) {
  if (!text) return [];
  return text.match(/\s*\S+(?:\s+|$)/gu) ?? [text];
}

function wait(delayMs: number, signal?: AbortSignal) {
  if (delayMs <= 0) return Promise.resolve();
  signal?.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, delayMs);
    const abort = () => {
      window.clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export async function revealChatTextByWord(
  text: string,
  append: (segment: string) => void,
  options: { delayMs?: number; signal?: AbortSignal } = {},
) {
  const segments = splitChatTextIntoWords(text);
  const delayMs = options.delayMs ?? defaultWordDelayMs;

  for (let index = 0; index < segments.length; index += 1) {
    options.signal?.throwIfAborted();
    append(segments[index]);
    if (index < segments.length - 1) await wait(delayMs, options.signal);
  }
}
