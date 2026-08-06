# Blog daily schedule & crawl

## Mục tiêu

- **1 bài / ngày** trên Góc động viên
- Máy tìm kiếm / GEO agent **crawl** được danh sách + nội dung bài mới
- Cron tự publish bài đến hạn và **lấp lịch** trước 21 ngày

## Cron (Workers)

`triggers.crons`: `0 2 * * *` (02:00 UTC mỗi ngày)

Job `runBlogDailyJob`:

1. `publishDueBlogPosts` — `scheduled` → `published` khi `scheduled_for <= hôm nay`
2. `ensureDailyBlogSchedule` — với mỗi ngày trống trong horizon (21 ngày):
   - ưu tiên bài chưa dùng trong `shared/content/blog-editorial-bank.json`
   - nếu hết bank → draft bằng Workers AI (giọng động viên, có disclaimer)

## Crawl surfaces (Worker, `run_worker_first`)

| Path | Mục đích |
| --- | --- |
| `/robots.txt` | Allow nội dung công khai; Sitemap URL |
| `/sitemap.xml` | Route tĩnh + `/thu-vien/:slug` (active) + mọi `/blog/:slug` đã publish |
| `/feed.xml` | Atom feed (full text) cho crawler không chạy SPA JS |

`PUBLIC_SITE_URL` trong `wrangler.jsonc` đặt canonical origin.

## Seed

```bash
pnpm seed:blog          # ghi blog.sql + blog-editorial-bank.json
pnpm db:seed:blog       # local D1
pnpm db:seed:blog:remote
```

Bài giới thiệu dự án (`gioi-thieu-vivaage`) luôn `INSERT OR REPLACE` và publish ngay.

Cadence seed: **1 ngày / bài**. `INSERT OR IGNORE` không ghi đè bài cron đã publish (trừ intro).

## Admin

- `GET /api/v1/admin/blog/schedule` — xem lịch gần đây
- `POST /api/v1/admin/blog/run-schedule` — chạy cùng job với cron (thủ công)

## Kiểm thử local

```bash
pnpm test
# với wrangler dev --test-scheduled:
curl "http://localhost:8787/cdn-cgi/handler/scheduled?format=json"
curl -s http://localhost:8787/sitemap.xml | head
curl -s http://localhost:8787/feed.xml | head
```
