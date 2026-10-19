/**
 * One live call against the Workers AI binding. Not part of CI and not invoked by pnpm test.
 *
 *   CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... node scripts/acute-classifier-smoke.mjs
 *
 * Uses the fp8 chat model with temperature 0 and no response_format.
 * Exit 0 when a verdict parses, 1 when the call fails or the text is not a verdict, 2 when credentials are missing.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(join(root, "shared/rules/acute-classifier-prompt.ts"), "utf8");
const header = "export const ACUTE_CLASSIFIER_SYSTEM_PROMPT = `";
const start = src.indexOf(header);
const bodyStart = start + header.length;
const end = src.indexOf("`;", bodyStart);
if (start < 0 || end < 0) {
  console.error("Could not read ACUTE_CLASSIFIER_SYSTEM_PROMPT");
  process.exit(1);
}
const prompt = src.slice(bodyStart, end);
const model = "@cf/meta/llama-3.1-8b-instruct-fp8";
const question =
  "Cụ đang thấy nặng ngực và toát mồ hôi sau bữa cơm, có cần gọi ai không?";

function boolish(value) {
  return value === true || value === false || value === "true" || value === "false";
}

function parseVerdict(raw) {
  const text = String(raw ?? "");
  const open = text.indexOf("{");
  if (open < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let body = "";
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        body = text.slice(open, i + 1);
        break;
      }
    }
  }
  if (!body) return null;
  try {
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed.category !== "string") return null;
    if (
      !boolish(parsed.acute) ||
      !boolish(parsed.intent_first_person) ||
      !boolish(parsed.figurative)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function readText(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (typeof payload.response === "string") return payload.response;
  const result = payload.result;
  if (typeof result === "string") return result;
  if (result && typeof result === "object" && typeof result.response === "string") {
    return result.response;
  }
  return "";
}

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) {
  console.error(
    "Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN. This script is not part of CI.",
  );
  process.exit(2);
}

const response = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: question },
      ],
      max_tokens: 180,
      temperature: 0,
      stream: false,
    }),
  },
);
const payload = await response.json();
const dumped = JSON.stringify(payload);
if (!response.ok || /5025|5028|JSON Schema|JSON Mode|was retired/i.test(dumped)) {
  console.error(dumped);
  process.exit(1);
}
const verdict = parseVerdict(readText(payload));
if (!verdict) {
  console.error(dumped);
  process.exit(1);
}
console.log(
  JSON.stringify({
    acute_classifier_smoke: "ok",
    model,
    category: verdict.category,
    acute: verdict.acute,
  }),
);
