import { describe, expect, it } from "vitest";
import { createAiStreamReader, readAiChunk } from "../../worker/ai/run";

const encoder = new TextEncoder();

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
    const reader = createAiStreamReader();
    const mid = 10;
    const first = reader.push(bytes.slice(0, mid));
    const second = reader.push(bytes.slice(mid));
    const tail = reader.flush();
    expect([...first, ...second, ...tail].join("")).toBe("xin chào");
  });
});
