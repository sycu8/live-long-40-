# Nguồn chính thống trong VivaAge

## Nguyên tắc
- Câu trả lời chat **bắt buộc** kèm nguồn chính thống (cơ quan VN hoặc hướng dẫn quốc tế uy tín như WHO) với **đường dẫn tới đúng tài liệu** (bài, tờ thông tin, trang thủ tục/tra cứu cụ thể).
- **Không** dẫn chỉ trang chủ cơ quan (`moh.gov.vn/`, `baohiemxahoi.gov.vn/`, `sbv.gov.vn/`, `who.int/`).
- Tiêu đề nguồn phải là tên tài liệu (ví dụ “Tra cứu giá trị sử dụng thẻ BHYT”), không chỉ tên tổ chức.
- Thư viện bài học gắn `source_document_id` tới `source_documents` đã duyệt; phần “Nguồn” hiển thị **title** của tài liệu, không chỉ issuer.
- Góc động viên mang tính khích lệ — không thay tư vấn chuyên môn; câu hỏi chuyên môn dùng **Hỏi VivaAge**.

## Trust tier (`source_documents.trust_tier`)
| Tier | Nghĩa | Dùng làm bằng chứng chat? |
| --- | --- | --- |
| `official_vn` | Cơ quan nhà nước VN | Có |
| `intl_guideline` | WHO / hướng dẫn quốc tế | Có |
| `editorial` | Biên tập nội bộ | Không |

## Registry code
- `shared/content/official-sources.ts` — danh mục tài liệu chuẩn + URL sâu + `isGenericHomepageUrl`
- `shared/content/answer-bank.ts` — câu trả lời mẫu chỉ trích registry
- `shared/rules/sources.ts` — helper nhận diện issuer / citation

## Pipeline
1. Answer bank (đã gắn tài liệu cụ thể + URL)
2. AI Search / D1 chỉ lấy `official_vn` | `intl_guideline` (và issuer khớp)
3. Nếu model không gắn `[Sn]` → thay bằng tóm tắt extractive có citation + URL
4. KV cache chỉ lưu câu trả lời đã grounded official

## Admin
Khi tạo nguồn `official_vn` / `intl_guideline` bắt buộc có `originalUrl` tới **đúng tài liệu**, không dùng trang chủ cơ quan.
