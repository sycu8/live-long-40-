import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
import { DISCLAIMER } from "@shared/constants/product";

export function ProfilePage() {
  return (
    <AppShell>
      <div className="space-y-6 fade-up">
        <div>
          <h1 className="font-display text-3xl">Hồ sơ</h1>
          <p className="mt-2 text-[var(--color-ink-muted)]">
            Bạn đang dùng phiên ẩn danh. Không cần tạo tài khoản để dùng các tính
            năng cốt lõi.
          </p>
        </div>

        <section className="space-y-3 rounded-2xl bg-white/70 p-4">
          <h2 className="font-display text-xl">Quyền riêng tư</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--color-ink-muted)]">
            <li>Phiên được lưu bằng cookie HttpOnly, không dùng localStorage cho token.</li>
            <li>Hội thoại AI mặc định không lưu nội dung đầy đủ.</li>
            <li>Kết quả đánh giá chỉ gắn với phiên của bạn.</li>
          </ul>
        </section>

        <section className="space-y-3 rounded-2xl bg-white/70 p-4">
          <h2 className="font-display text-xl">Giới hạn của sản phẩm</h2>
          <p className="text-sm leading-relaxed text-[var(--color-ink-muted)]">
            {DISCLAIMER}
          </p>
        </section>

        <div className="flex flex-col gap-3">
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
    </AppShell>
  );
}
