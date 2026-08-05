/** Comfortable / default / large text scale for 40+ readers (local only). */

export type TextScale = "comfortable" | "default" | "large";

export const TEXT_SCALE_KEY = "sa_text_scale";

export const TEXT_SCALE_OPTIONS: Array<{
  id: TextScale;
  label: string;
  hint: string;
}> = [
  {
    id: "default",
    label: "Vừa",
    hint: "Gần cỡ chữ phổ biến trên web",
  },
  {
    id: "comfortable",
    label: "Rõ",
    hint: "Mặc định Sống An — dễ đọc hơn một chút",
  },
  {
    id: "large",
    label: "Lớn",
    hint: "Phù hợp khi mắt mệt hoặc màn hình nhỏ",
  },
];

export function parseTextScale(value: string | null | undefined): TextScale {
  if (value === "default" || value === "large" || value === "comfortable") {
    return value;
  }
  return "comfortable";
}

export function readStoredTextScale(): TextScale {
  try {
    return parseTextScale(localStorage.getItem(TEXT_SCALE_KEY));
  } catch {
    return "comfortable";
  }
}

export function applyTextScale(scale: TextScale) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.textScale = scale;
  }
  try {
    localStorage.setItem(TEXT_SCALE_KEY, scale);
  } catch {
    /* ignore */
  }
}

export function applyStoredTextScale() {
  applyTextScale(readStoredTextScale());
}
