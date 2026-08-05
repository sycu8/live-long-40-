# Typography — dễ đọc cho người 40+ / mắt yếu

## Font chính: Lexica Ultralegible

- Nguồn: [jacobxperez/lexica-ultralegible](https://github.com/jacobxperez/lexica-ultralegible) (dựa trên Atkinson Hyperlegible của Braille Institute)
- Lý do chọn: phân biệt rõ chữ dễ nhầm (`I`/`l`/`1`, `B`/`8`, `O`/`0`), khoảng chữ mở, **hỗ trợ tiếng Việt**, giấy phép SIL OFL 1.1
- File tự host: `public/fonts/lexica/*.woff2`
- Fallback: Be Vietnam Pro → Noto Sans → system UI

## Cỡ chữ

| Mức (Hồ sơ → Cỡ chữ) | Mobile | Desktop |
| --- | --- | --- |
| Vừa (`default`) | 17px | 18px |
| Rõ (`comfortable`, mặc định) | 18px | 19px |
| Lớn (`large`) | 20px | 21px |

Lưu trên thiết bị: `localStorage.sa_text_scale`.

## Nguyên tắc khác

- `line-height: 1.65`, `letter-spacing: 0.01em`
- Chỉ dùng weight thật **400 / 700** (tránh synthetic mid-weight mờ)
- Màu chữ phụ `#3a4a43` (tăng tương phản so với trước)
- Nút tối thiểu ~56px (`min-h-14`) ở chỗ chọn cỡ chữ
