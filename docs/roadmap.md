# Roadmap — Sống An 40+

Mục tiêu sản phẩm: giúp người Việt **40+** bớt tiêu cực, thích nghi, và chủ động cải thiện đời sống / chuẩn bị tuổi già qua các **việc nhỏ đều đặn**, nội dung động viên, và câu trả lời có nguồn.

Nguyên tắc: giáo dục + kế hoạch — **không** thay bác sĩ, tư vấn tài chính/pháp lý, không phải dịch vụ Nhà nước.

---

## Hiện trạng (MVP đã có)

| Vòng | Trạng thái |
| --- | --- |
| Đánh giá sẵn sàng (~20 câu) → hồ sơ 3 trụ cột | Có |
| Kế hoạch 30 ngày (2 + 1 việc / tuần) | Có |
| Hỏi Sống An (an toàn + nguồn) | Có |
| Thư viện bài học | Có |
| Góc động viên (blog 1 bài/ngày + crawl sitemap/feed) | Có |
| Admin nạp nguồn / duyệt | Có (MVP) |
| PWA + phiên ẩn danh | Có |

---

## Phase 1 — Vòng động lực *(đã làm)*

Giữ người dùng quay lại bằng **tiến độ rõ ràng + phản ánh nhẹ + động viên**.

1. **Khám phá Góc động viên** — đưa blog vào điều hướng chính; gắn gợi ý đọc trên Hôm nay.
2. **Tiến độ tuần trên Hôm nay** — % hoàn thành, lời khích lệ theo tiến độ, việc tiếp theo.
3. **Phản ánh khi hoàn thành việc** — độ khó / tự tin / ghi chú ngắn (API đã có, UI còn thiếu).
4. **Lưu hội thoại tùy chọn** — bật trong Hồ sơ; chỉ lưu khi người dùng đồng ý rõ ràng.
5. **Giao diện desktop riêng** — sidebar + bố cục rộng từ `lg` (1024px); mobile giữ bottom tabs (không stretch UI điện thoại trên máy tính).

**Xong khi:** người dùng thấy tiến độ tuần, hoàn thành việc có bước phản ánh, tìm được blog trong 1 lần chạm, có thể bật/tắt lưu chat, và desktop không còn nhìn như web mobile.

---

## Phase 2 — Cá nhân hóa nhẹ

1. Gợi ý bài blog / bài học theo khoảng trống đánh giá (health / finance / caregiving).
2. Nhắc việc tuần hiện tại trên Hôm nay (in-app, không SMS/Zalo).
3. Tóm tắt “tháng này bạn đã làm gì” (số việc hoàn thành, trụ cột đã chạm).
4. Cờ tính năng qua KV `CONFIG` (chat history mặc định, Turnstile site key công khai).

---

## Phase 3 — Chất lượng tri thức & tin cậy

1. Mở rộng nguồn đã duyệt để chat ít “từ chối vì thiếu bằng chứng”.
2. Dashboard admin: tỷ lệ abstain / high-risk / hoàn thành kế hoạch (analytics queue → D1, không lưu nội dung câu hỏi).
3. Admin soạn / lên lịch bài blog (cron publish + fill horizon đã có; `POST /api/v1/admin/blog/run-schedule`).
4. Siết Turnstile phía client khi đã cấu hình; xác minh Access JWT đúng chuẩn edge.

---

## Phase 4 — Mở rộng có kiểm soát *(ngoài phạm vi gần)*

Chỉ khi Phase 1–3 ổn định và có nhu cầu rõ:

- Tài khoản đăng nhập (đồng bộ đa thiết bị)
- Thông báo đẩy / email (opt-in)
- Tích hợp Zalo, thanh toán, telemedicine — **cố ý không nằm trong MVP**

---

## Đo thành công (định tính + vận hành)

- Người có kế hoạch quay lại hoàn thành ≥ 1 việc / tuần
- Blog được mở từ Hôm nay hoặc nav (không chỉ từ landing)
- Tỷ lệ abstain chat giảm khi KB tăng
- Không có sự cố lưu hội thoại khi chưa opt-in
