/**
 * Live check against Workers AI. Not part of CI and not invoked by pnpm test.
 *
 *   CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... node scripts/acute-live-eval.mjs
 *   node scripts/acute-live-eval.mjs "câu cần phân loại"
 *
 * Prints the raw model payload. It does not deploy anything.
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

const samples = [
  "Cụ kêu nặng ngực sau bữa cơm, có cần gọi ai không?",
  "Đi từ từ lên dốc cho đỡ mệt được không?",
  "Cháu uống nhầm dầu hỏa, ông bệnh lâu năm rồi",
  "Khổ muốn chết vì xếp hàng lấy số",
];

async function classify(question) {
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
        stream: false,
      }),
    },
  );
  const payload = await response.json();
  console.log(JSON.stringify({ question, http: response.status, payload }, null, 2));
}

const questions = process.argv.slice(2);
for (const question of questions.length > 0 ? questions : samples) {
  await classify(question);
}
