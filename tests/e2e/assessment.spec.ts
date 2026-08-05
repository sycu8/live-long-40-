import { test, expect } from "@playwright/test";

test.describe("mobile assessment smoke", () => {
  test("landing shows brand and primary CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("VivaAge", { exact: false }).first()).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: /Kiểm tra mức độ chuẩn bị trong 7 phút/i,
      }),
    ).toBeVisible();
  });

  test("can open assessment and answer first question", async ({ page }) => {
    await page.goto("/danh-gia");
    await expect(page.getByText(/Câu 1\//)).toBeVisible({ timeout: 30_000 });
    const option = page.getByRole("button").filter({ hasText: /40/ }).first();
    await option.click();
    await expect(page.getByText(/Câu 2\//)).toBeVisible({ timeout: 15_000 });
  });
});
