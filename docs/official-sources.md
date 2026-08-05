# Nguồn chính thống trong Sống An 40+

## Nguyên tắc
- Câu trả lời chat **bắt buộc** kèm nguồn chính thống (cơ quan VN hoặc hướng dẫn quốc tế uy tín như WHO) với đường dẫn gốc.
- Thư viện bài học nên gắn `source_document_id` tới `source_documents` đã duyệt.
- Góc động viên mang tính khích lệ — không thay tư vấn chuyên môn; câu hỏi chuyên môn dùng **Hỏi Sống An**.

## Trust tier (`source_documents.trust_tier`)
| Tier | Nghĩa | Dùng làm bằng chứng chat? |
| --- | --- | --- |
| `official_vn` | Cơ quan nhà nước VN | Có |
| `intl_guideline` | WHO / hướng dẫn quốc tế | Có |
| `editorial` | Biên tập nội bộ | Không |

## Registry code
- `shared/content/official-sources.ts` — danh mục nguồn chuẩn + URL
- `shared/content/answer-bank.ts` — câu trả lời mẫu chỉ trích registry
- `shared/rules/sources.ts` — helper nhận diện issuer / citation

## Pipeline
1. Answer bank (đã gắn nguồn chính thống + URL)
2. AI Search / D1 chỉ lấy `official_vn` | `intl_guideline` (và issuer khớp)
3. Nếu model không gắn `[Sn]` → thay bằng tóm tắt extractive có citation + URL
4. KV cache chỉ lưu câu trả lời đã grounded official

## Admin
Khi tạo nguồn `official_vn` / `intl_guideline` bắt buộc có `originalUrl`.
