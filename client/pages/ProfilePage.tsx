import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
import { DISCLAIMER } from "@shared/constants/product";
import { api } from "../lib/api";
import {
  getChatHistoryOptIn,
  resolveChatHistoryOptIn,
  setChatHistoryOptIn,
} from "../lib/preferences";
import {
  TEXT_SCALE_OPTIONS,
  applyTextScale,
  readStoredTextScale,
  type TextScale,
} from "../lib/textScale";

export function ProfilePage() {
  const [historyOptIn, setHistoryOptIn] = useState(false);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [textScale, setTextScale] = useState<TextScale>(() =>
    typeof document !== "undefined" ? readStoredTextScale() : "comfortable",
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let productDefault = false;
      try {
        const meta = await api<{ chatHistoryDefault?: boolean }>("/meta");
        productDefault = Boolean(meta.chatHistoryDefault);
      } catch {
        /* ignore */
      }
      if (!cancelled) {
        setHistoryOptIn(resolveChatHistoryOptIn(productDefault));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleHistory(next: boolean) {
    setChatHistoryOptIn(next);
    setHistoryOptIn(next);
    setSavedHint(
      next
        ? "Đã bật lưu hội thoại cho các phiên chat mới trên thiết bị này."
        : "Đã tắt lưu hội thoại. Phiên mới sẽ không giữ nội dung trên máy chủ.",
    );
  }

  function changeTextScale(next: TextScale) {
    applyTextScale(next);
    setTextScale(next);
  }

  return (
    <AppShell>
      <div className="space-y-8 fade-up lg:grid lg:grid-cols-2 lg:gap-12 lg:space-y-0">
        <div className="space-y-8">
          <div>
            <h1 className="font-display text-3xl lg:text-4xl">Hồ sơ</h1>
            <p className="mt-2 text-[var(--color-ink-muted)]">
              Bạn đang dùng phiên ẩn danh. Không cần tạo tài khoản để dùng các tính
              năng cốt lõi.
            </p>
          </div>

          <section>
            <h2 className="font-display text-xl">Cỡ chữ</h2>
            <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
              Chọn cỡ chữ dễ đọc trên thiết bị này. Dùng font Lexica Ultralegible —
              thiết kế cho người đọc chữ khó, hỗ trợ tiếng Việt.
            </p>
            <div
              className="mt-4 flex flex-col gap-2 sm:flex-row"
              role="group"
              aria-label="Cỡ chữ"
            >
              {TEXT_SCALE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => changeTextScale(opt.id)}
                  aria-pressed={textScale === opt.id}
                  className={`min-h-14 flex-1 rounded-xl border px-4 py-3 text-left transition ${
                    textScale === opt.id
                      ? "border-[var(--color-green)] bg-[var(--color-green-soft)]"
                      : "border-[var(--color-sand)] bg-white/70 hover:border-[var(--color-green)]"
                  }`}
                >
                  <span className="block font-medium text-[var(--color-ink)]">
                    {opt.label}
                  </span>
                  <span className="mt-1 block text-sm text-[var(--color-ink-muted)]">
                    {opt.hint}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl">Những gì bạn có thể làm</h2>
            <ul className="mt-3 space-y-3 text-[var(--color-ink-muted)]">
              <li>
                <Link
                  className="font-medium text-[var(--color-green)]"
                  to="/danh-gia"
                >
                  Đánh giá sẵn sàng
                </Link>
                {" — "}
                khoảng 7 phút, nhận hồ sơ theo sức khỏe, tài chính và chăm sóc.
              </li>
              <li>
                <Link
                  className="font-medium text-[var(--color-green)]"
                  to="/ke-hoach"
                >
                  Kế hoạch 30 ngày
                </Link>
                {" — "}
                việc nhỏ mỗi tuần sau khi có kết quả đánh giá.
              </li>
              <li>
                <Link className="font-medium text-[var(--color-green)]" to="/hoi">
                  Hỏi Sống An
                </Link>
                {" — "}
                câu hỏi giáo dục có nguồn đã duyệt.
              </li>
              <li>
                <Link className="font-medium text-[var(--color-green)]" to="/blog">
                  Góc động viên
                </Link>
                {" — "}
                bài viết dài hơi, cập nhật mỗi ngày, giúp bạn giữ tinh thần thích
                nghi.
              </li>
              <li>
                <Link
                  className="font-medium text-[var(--color-green)]"
                  to="/thu-vien"
                >
                  Thư viện
                </Link>
                {" — "}
                bài viết giáo dục ngắn theo chủ đề — giải thích khái niệm, không phải
                danh sách việc phải làm.
              </li>
            </ul>
          </section>
        </div>

        <div className="space-y-8">
          <section className="border-t border-[var(--color-sand)]/40 pt-6 lg:border-t-0 lg:pt-0">
            <h2 className="font-display text-xl">Quyền riêng tư</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--color-ink-muted)]">
              <li>
                Phiên được lưu bằng cookie HttpOnly — không dùng localStorage cho
                token đăng nhập.
              </li>
              <li>
                Hội thoại AI mặc định không lưu nội dung đầy đủ trên máy chủ.
              </li>
              <li>
                Kết quả đánh giá và kế hoạch chỉ gắn với phiên hiện tại của bạn.
              </li>
              <li>
                Bạn có thể làm lại bài đánh giá bất cứ lúc nào để cập nhật hồ sơ.
              </li>
            </ul>

            <div className="mt-5 rounded-2xl bg-white/70 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 accent-[var(--color-green)]"
                  checked={historyOptIn}
                  onChange={(e) => toggleHistory(e.target.checked)}
                />
                <span>
                  <span className="font-medium text-[var(--color-ink)]">
                    Lưu hội thoại Hỏi Sống An trên máy chủ
                  </span>
                  <span className="mt-1 block text-sm text-[var(--color-ink-muted)]">
                    Chỉ bật khi bạn muốn xem lại câu hỏi đã hỏi trong phiên này.
                    Lựa chọn được nhớ trên thiết bị
                    {getChatHistoryOptIn() === null
                      ? " (chưa chọn lần nào)"
                      : ""}
                    .
                  </span>
                </span>
              </label>
              {savedHint ? (
                <p
                  role="status"
                  className="mt-3 text-sm text-[var(--color-green)]"
                >
                  {savedHint}
                </p>
              ) : null}
            </div>
          </section>

          <section className="border-t border-[var(--color-sand)]/40 pt-6">
            <h2 className="font-display text-xl">Giới hạn của sản phẩm</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
              {DISCLAIMER}
            </p>
          </section>

          <div className="flex flex-col gap-3 lg:max-w-sm">
            <Link to="/danh-gia">
              <Button className="w-full">Làm lại bài đánh giá</Button>
            </Link>
            <Link to="/hoi">
              <Button variant="secondary" className="w-full">
                Hỏi Sống An
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
