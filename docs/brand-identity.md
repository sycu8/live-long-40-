# Nhận diện thương hiệu — VivaAge

## Tên gọi
- **Tên đầy đủ / UI:** VivaAge
- **Dạng cách điệu:** Viva Age (khi giải thích nguồn gốc tên)
- **Tagline:** Chuẩn bị hôm nay, tự chủ về sau

## Ý nghĩa
- **Viva** gợi sức sống, tích cực, không nhấn mạnh sự già yếu.
- **Age** thể hiện lĩnh vực tuổi tác và healthy aging.

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
- **Display / UI:** Lexica Ultralegible (+ Be Vietnam Pro fallback)
- Không dùng Inter / Roboto / Arial làm font chính

## Logo & asset
| File | Dùng cho |
| --- | --- |
| `/logo-mark.svg` | Mark vuông (nav, favicon vector) |
| `/logo-lockup.svg` | Mark + chữ |
| `/logo-mark-192.png` / `512.png` | PWA icons |
| `/logo-mark-maskable.svg` / `.png` | Adaptive / maskable |
| `/apple-touch-icon.png` | iOS home screen |
| `/og-image.jpg` | Open Graph / Twitter (1200×630) |
| `/favicon.svg` | Tab icon |
| `/llms.txt` | Tóm tắt sản phẩm cho AI crawler |

## SEO / GEO
- Meta `og:*` / `twitter:*` trong `index.html` (first paint cho crawler)
- `DocumentHead` cập nhật title / OG / JSON-LD theo route SPA
- `/sitemap.xml`, `/robots.txt`, `/feed.xml` do Worker phục vụ động
- JSON-LD: Organization, WebApplication, WebSite, FAQPage

## Giọng điệu
Xem `docs/vietnamese-voice.md`. Giáo dục, rõ ràng, không hù dọa, không thay bác sĩ.
