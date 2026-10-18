import { runWorkersAi } from "../ai/run";
import type { Env } from "../env";

const IMAGE_MODELS = [
  "@cf/black-forest-labs/flux-1-schnell",
  "@cf/bytedance/stable-diffusion-xl-lightning",
  "@cf/stabilityai/stable-diffusion-xl-base-1.0",
] as const;

export function blogCoverObjectKey(slug: string): string {
  return `blog-covers/${slug}.png`;
}

/**
 * Generate a calm, educational cover image with Workers AI and store on R2.
 * Best-effort: returns null when AI or R2 is unavailable.
 */
export async function generateAndStoreBlogCover(
  env: Env,
  slug: string,
  title: string,
  theme: string,
): Promise<{ key: string; alt: string } | null> {
  if (!env.AI || !env.SOURCES) return null;

  const alt = `Minh họa dịu dàng cho bài “${title}” — chủ đề ${theme}, không phải ảnh y khoa.`;
  const prompt = [
    "Soft editorial illustration for a Vietnamese healthy-aging education blog.",
    "Calm warm cream and green palette, gentle light, no text, no logos,",
    "no medical procedures, no scary imagery, suitable for readers 40+.",
    `Theme: ${theme}. Mood inspired by: ${title.slice(0, 120)}.`,
    "Flat modern illustration, wide 16:9 composition.",
  ].join(" ");

  for (const model of IMAGE_MODELS) {
    try {
      const result = await runWorkersAi(env, model, {
        prompt,
        // flux schnell accepts steps; other models ignore unknown fields
        num_steps: 4,
      });

      const bytes = await imageResultToUint8Array(result);
      if (!bytes || bytes.byteLength < 256) continue;

      const key = blogCoverObjectKey(slug);
      await env.SOURCES.put(key, bytes, {
        httpMetadata: { contentType: "image/png" },
        customMetadata: { slug, theme, model },
      });
      return { key, alt };
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "warn",
          message: "blog_cover_model_failed",
          model,
          error: String(err),
        }),
      );
    }
  }
  return null;
}

async function imageResultToUint8Array(
  result: unknown,
): Promise<Uint8Array | null> {
  if (!result) return null;
  if (result instanceof Uint8Array) return result;
  if (result instanceof ArrayBuffer) return new Uint8Array(result);
  if (typeof Blob !== "undefined" && result instanceof Blob) {
    return new Uint8Array(await result.arrayBuffer());
  }
  // Some Workers AI bindings return { image: base64 } or ReadableStream
  if (typeof result === "object" && result !== null) {
    const obj = result as Record<string, unknown>;
    if (typeof obj.image === "string") {
      const bin = atob(obj.image);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    if (typeof ReadableStream !== "undefined" && obj instanceof ReadableStream) {
      const res = new Response(obj);
      return new Uint8Array(await res.arrayBuffer());
    }
  }
  return null;
}

export async function readBlogCover(
  env: Env,
  key: string,
): Promise<R2ObjectBody | null> {
  if (!env.SOURCES || !key.startsWith("blog-covers/")) return null;
  return env.SOURCES.get(key);
}
