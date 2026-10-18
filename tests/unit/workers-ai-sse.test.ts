import { describe, expect, it } from "vitest";
import { WORKERS_AI_MAX_TOKENS } from "../../worker/ai/models";
import { createAiStreamReader, readAiChunk } from "../../worker/ai/run";

const encoder = new TextEncoder();

function decodeChunks(bytes: Uint8Array, splitAt: number): string {
  const reader = createAiStreamReader();
  const first = reader.push(bytes.slice(0, splitAt));
  const second = reader.push(bytes.slice(splitAt));
  const tail = reader.flush();
  return [...first, ...second, ...tail].join("");
}

describe("Workers AI SSE chunks", () => {
  it("decodes data lines, skips [DONE], and reads response", () => {
    const bytes = encoder.encode(
      [
        'data: {"response":"Đi bộ "}',
        "",
        'data: {"response":"đều"}',
        "",
        "data: [DONE]",
        "",
      ].join("\n"),
    );
    expect(readAiChunk(bytes)).toBe("Đi bộ đều");
  });

  it("keeps a JSON event that is split across byte chunks", () => {
    const bytes = encoder.encode('data: {"response":"xin chào"}\n\ndata: [DONE]\n\n');
    expect(decodeChunks(bytes, 10)).toBe("xin chào");
  });

  it("does not garble Vietnamese when a character is split across chunks", () => {
    const text = "Đi bộ buổi sáng giữ sức khỏe tiếng Việt.";
    const bytes = encoder.encode(`data: ${JSON.stringify({ response: text })}\n\n`);
    const splitAt = bytes.findIndex((byte, index) => index > 0 && (byte & 0xc0) === 0x80);
    expect(splitAt).toBeGreaterThan(0);
    const joined = decodeChunks(bytes, splitAt);
    expect(joined).toBe(text);
    expect(joined).not.toContain("\uFFFD");
  });

  it("keeps the last response event when the stream has no [DONE]", () => {
    const bytes = encoder.encode(
      'data: {"response":"Đi bộ "}\n\ndata: {"response":"đều"}',
    );
    const reader = createAiStreamReader();
    const pushed = reader.push(bytes);
    const tail = reader.flush();
    expect([...pushed, ...tail].join("")).toBe("Đi bộ đều");
    expect(reader.cutoff).toBeNull();
  });

  it("marks an error event and a token-limit event as cut off", () => {
    const errorReader = createAiStreamReader();
    errorReader.push(encoder.encode('data: {"response":"đã có [S1]"}\n\n'));
    errorReader.push(encoder.encode('event: error\ndata: {"error":"upstream"}\n\n'));
    errorReader.flush();
    expect(errorReader.cutoff).toBe("error");

    const limitReader = createAiStreamReader({ maxTokens: WORKERS_AI_MAX_TOKENS });
    const usage = {
      response: "",
      usage: {
        completion_tokens: WORKERS_AI_MAX_TOKENS,
        prompt_tokens: 3,
        total_tokens: 1,
      },
    };
    limitReader.push(encoder.encode(`data: ${JSON.stringify(usage)}\n\n`));
    limitReader.flush();
    expect(limitReader.cutoff).toBe("length");
  });
});
