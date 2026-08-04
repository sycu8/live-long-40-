# Nhận diện thương hiệu — Sống An 40+

## Tên gọi
- **Tên đầy đủ:** Sống An 40+
- **Tên ngắn (PWA):** Sống An
- **Không viết:** Song An, SốngAn, sống an 40

## Ý nghĩa
“Sống An” = sống bình an, tự chủ. “40+” = bắt đầu chuẩn bị từ tuổi trung niên, không chờ đến già.

## Màu sắc
| Token | Hex | Vai trò |
| --- | --- | --- |
| Green | `#1F5C45` | Thương hiệu, CTA, tin cậy |
| Green dark | `#163F30` | Hover / nhấn |
| Cream | `#F7F4EF` | Nền ấm |
| Ink | `#1C2A24` | Chữ chính |
| Ink muted | `#4A5C54` | Chữ phụ |
| Green soft | `#D8EBE2` | Nền nhẹ, trạng thái tích cực |
| Blue | `#3D5A73` | Liên kết / nhấn phụ |
| Sand | `#C4B8A5` | Viền / phân tách |

Nguồn token: `shared/brand/identity.ts` + `client/styles/index.css`.

Tránh: tím neon, glow công nghệ, nền tối làm chủ đạo.

## Chữ
- **Display / UI:** Be Vietnam Pro (hỗ trợ dấu tiếng Việt)
- Không dùng Inter / Roboto / Arial làm font chính

## Logo & asset
| File | Dùng cho |
| --- | --- |
| `/logo-mark.svg` | Mark vuông (nav, favicon vector) |
| `/logo-lockup.svg` | Mark + chữ |
| `/logo-mark-192.png` / `512.png` | PWA icons |
| `/logo-mark-maskable.svg` | Adaptive / maskable |
| `/apple-touch-icon.png` | iOS home screen |
| `/og-image.png` | Open Graph / Twitter (1200×630) |
| `/favicon.svg` | Tab icon |

- Clear space tối thiểu ≈ ¼ cạnh mark
- Không kéo méo, không đổi màu tùy tiện
- Nền xanh tối: dùng mark cream / lockup sáng

## Giọng văn
Ấm, rõ, thực tế, không hù dọa tuổi già. Luôn nhắc đây là **công cụ giáo dục**, không thay bác sĩ / tư vấn tài chính / pháp lý.

Tagline chuẩn: *Chuẩn bị tuổi già từ tuổi 40 — khỏe, tự chủ, bình tĩnh.*

## SEO / GEO
- Ngôn ngữ: `vi-VN`, quốc gia: Việt Nam (`geo.region=VN`)
- Canonical + `hreflang` vi-VN / x-default
- Schema: Organization + WebApplication + WebSite + FAQPage (`shared/brand/jsonld.ts`)
- Open Graph / Twitter: `/og-image.png`
- `robots.txt`, `sitemap.xml`, `llms.txt`
- Client `DocumentHead` cập nhật title/meta theo route SPA
- Không index: `/admin`, `/api/*`, `/ket-qua`

Khi gắn domain riêng: cập nhật `BRAND.siteUrl` trong `shared/brand/identity.ts` và regenerate sitemap/canonicals.
