# On-page backlink strategy (Góc động viên)

Mục tiêu: mỗi bài blog **truyền PageRank nội bộ** tới các bề mặt chuyển đổi / giáo dục của VivaAge, đồng thời nhận liên kết ngược từ thư viện và điều hướng.

## Hub & spoke

```
/blog (hub)
  ├─ /blog/:slug  → sources + CTA
  ├─ /danh-gia
  ├─ /ke-hoach
  ├─ /thu-vien(?category=…)
  └─ /hoi
```

## Quy tắc trong bài (body)

1. ≥ **2** liên kết markdown nội bộ `/…` (không chỉ nêu tên sản phẩm).
2. Ưu tiên theo chủ đề:
   - `suc-khoe` → `/thu-vien?category=suc-khoe-trung-nien`, `/danh-gia`, `/hoi`
   - `tai-chinh` → `/thu-vien?category=chuan-bi-tai-chinh`, `/ke-hoach`, `/danh-gia`
   - `cham-soc` → `/thu-vien?category=cham-soc-cha-me`, `/ke-hoach`, `/hoi`
   - `tinh-than` / `thoi-quen` → `/ke-hoach`, `/danh-gia`, `/blog`
3. Nguồn ngoài chỉ dùng URL tài liệu cụ thể (registry official-sources).
4. Cuối bài: khối CTA UI (API `backlinks` theo theme) + aside “Trong VivaAge”.

## Liên kết chéo ngoài blog

| Nơi | Hành vi |
| --- | --- |
| Blog list | Trỏ `/hoi`, `/thu-vien` khi empty |
| Blog detail | Related posts cùng theme; CTA đánh giá / hỏi / kế hoạch / thư viện |
| Thư viện | Giữ issuer editorial; nguồn official riêng — có thể nhắc “đọc thêm Góc động viên” trong copy bài học (dần) |
| Nav / Hôm nay | Giữ entry `/blog` |

## AI generate

Prompt bắt buộc chèn link nội bộ + `sourceIds` từ allowlist theme (`blog-theme-sources.ts`). Validate word count ≥ 300 trước khi insert.

## Đo lường thủ công

- Mỗi bài publish: có khối “Nguồn chính thống” + ≥1 CTA sản phẩm
- Sitemap chứa slug mới trong 24h sau cron/seed
- Không orphan: mọi bài advisor batch liên kết được từ `/blog` list
