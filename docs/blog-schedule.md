# Blog daily schedule & crawl

## Mục tiêu

- **≥ 2 bài / ngày** trên Góc động viên (UTC)
- Giọng **tư vấn giáo dục cho người lớn tuổi**: chính xác, không đoán mò, có **nguồn chính thống** (document-level URL)
- Mỗi bài **≥ 300 từ**; khuyến nghị 450–700 từ
- Workers AI: sinh nội dung (khi bank hết) + ảnh bìa (R2 `blog-covers/`)
- Máy tìm kiếm crawl được danh sách + nội dung bài mới
- On-page backlink: liên kết nội bộ tới `/danh-gia`, `/ke-hoach`, `/thu-vien`, `/hoi`, `/blog`

## Chuẩn nội dung

| Tiêu chí | Yêu cầu |
| --- | --- |
| Góc viết | Tư vấn viên / coach giáo dục 40+ — ấm, rõ, không hù dọa |
| Độ dài | ≥ 300 từ (`BLOG_MIN_WORDS`) |
| Nguồn | 1–3 id từ `shared/content/official-sources.ts` (không trang chủ cơ quan) |
| Link nội bộ | ≥ 2 trong body markdown |
| Giới hạn | Disclaimer: không thay bác sĩ / tư vấn đầu tư / pháp lý |
| Ảnh | Workers AI → R2; phục vụ `/api/v1/blog/covers/:slug` |

Xem thêm chiến lược backlink: [`blog-backlinks.md`](./blog-backlinks.md).

## Cron (Workers)

`triggers.crons`: `0 2 * * *` (02:00 UTC mỗi ngày)

Job `runBlogDailyJob`:

1. `publishDueBlogPosts` — `scheduled` → `published` khi `scheduled_for <= hôm nay`
2. `ensureDailyBlogSchedule` — mỗi ngày trong horizon (21 ngày) đủ **`BLOG_POSTS_PER_DAY` (2)** bài:
   - ưu tiên bài chưa dùng trong `blog-editorial-bank.json` (+ `blog-advisor-batch.json`)
   - nếu hết bank → Workers AI (text + cover)

Hằng số: `shared/constants/blog.ts` (`BLOG_POSTS_PER_DAY`, `BLOG_MIN_WORDS`).

## Listing: featured + pagination

- **Page size:** 6–9 bài (`BLOG_PAGE_SIZE_DEFAULT` = 8) — `GET /api/v1/blog?page=&pageSize=&theme=`
- **Featured / bài hot:** `is_featured` + `featured_rank` (thấp hơn = ưu tiên hơn); trang 1 trả `featured` (tối đa `BLOG_FEATURED_LIMIT` = 3) rồi `items` còn lại
- Thứ tự: `is_featured DESC, featured_rank ASC, published_at DESC`
- Seed gắn nổi bật: intro `gioi-thieu-vivaage`, `on-dinh-tinh-than-tuoi-trung-nien-co-nguon`, `thoi-quen-20-phut-cho-nguoi-40`

## Crawl surfaces

| Path | Mục đích |
| --- | --- |
| `/robots.txt` | Allow nội dung công khai; Sitemap URL |
| `/sitemap.xml` | Route tĩnh + thư viện + mọi `/blog/:slug` đã publish |
| `/feed.xml` | Atom feed (full text) |

## Seed

```bash
pnpm seed:blog          # ghi blog.sql + blog-editorial-bank.json
pnpm db:seed:blog       # local D1
pnpm db:seed:blog:remote
```

- Intro `gioi-thieu-vivaage` và **advisor batch** (6 bài): `INSERT OR REPLACE`, publish ngay
- Bài khác: `INSERT OR IGNORE` (không ghi đè bài cron đã publish)

## Admin

- `GET /api/v1/admin/blog/schedule`
- `POST /api/v1/admin/blog/run-schedule`
