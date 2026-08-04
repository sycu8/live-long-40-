import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
import { DISCLAIMER } from "@shared/constants/product";

export function ProfilePage() {
  return (
    <AppShell>
      <div className="space-y-8 fade-up">
        <div>
          <h1 className="font-display text-3xl">Hồ sơ</h1>
          <p className="mt-2 text-[var(--color-ink-muted)]">
            Bạn đang dùng phiên ẩn danh. Không cần tạo tài khoản để dùng các tính
            năng cốt lõi.
          </p>
        </div>

        <section>
          <h2 className="font-display text-xl">Những gì bạn có thể làm</h2>
          <ul className="mt-3 space-y-3 text-[var(--color-ink-muted)]">
            <li>
              <Link className="font-medium text-[var(--color-green)]" to="/danh-gia">
                Đánh giá sẵn sàng
              </Link>
              {" — "}
              khoảng 7 phút, nhận hồ sơ theo sức khỏe, tài chính và chăm sóc.
            </li>
            <li>
              <Link className="font-medium text-[var(--color-green)]" to="/ke-hoach">
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
              <Link className="font-medium text-[var(--color-green)]" to="/thu-vien">
                Thư viện
              </Link>
              {" — "}
              bài học ngắn theo chủ đề.
            </li>
          </ul>
        </section>

        <section className="border-t border-[var(--color-sand)]/40 pt-6">
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
        </section>

        <section className="border-t border-[var(--color-sand)]/40 pt-6">
          <h2 className="font-display text-xl">Giới hạn của sản phẩm</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
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
