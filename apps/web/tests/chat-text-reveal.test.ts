import { describe, expect, it, vi } from "vitest";
import { revealChatTextByWord, splitChatTextIntoWords } from "../src/lib/chat/text-reveal";

describe("chat text reveal", () => {
  it("preserves whitespace while splitting a reply into word-sized segments", () => {
    expect(splitChatTextIntoWords("Hello, smooth world.")).toEqual([
      "Hello, ",
      "smooth ",
      "world.",
    ]);
  });

  it("reveals every word in order without changing the reply", async () => {
    const append = vi.fn();
    await revealChatTextByWord("One two three.", append, { delayMs: 0 });

    expect(append.mock.calls.map(([segment]) => segment).join("")).toBe("One two three.");
    expect(append).toHaveBeenCalledTimes(3);
  });
});
