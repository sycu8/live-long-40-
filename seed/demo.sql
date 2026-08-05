-- Demo seed: educational library articles for Sống An 40+ (not government documents).
-- Articles explain concepts; they are not task checklists. Safe demonstration content only.

INSERT OR IGNORE INTO library_lessons (
  id, slug, title, summary, category, pillar, issuer, publication_date, last_reviewed_at,
  status, estimated_reading_minutes, body_markdown, created_at, updated_at
) VALUES
(
  'lesson_bp_001',
  'theo-doi-huyet-ap',
  'Huyết áp tuổi ngoài 40: vì sao nên theo dõi đều',
  'Hiểu vai trò của huyết áp với sức khỏe dài hạn và cách theo dõi tại nhà một cách bình tĩnh.',
  'kham-phong-benh',
  'health',
  'Sống An 40+ Biên tập giáo dục',
  '2026-01-15',
  '2026-07-01',
  'active',
  6,
  '# Huyết áp tuổi ngoài 40: vì sao nên theo dõi đều

Đây là bài học giáo dục. Không chẩn đoán bệnh, không thay lời bác sĩ.

## Vì sao huyết áp quan trọng sau tuổi 40

Huyết áp phản ánh lực máu đẩy lên thành mạch. Theo thời gian, huyết áp cao kéo dài có thể liên quan đến nguy cơ về tim mạch và đột quỵ. Nhiều người không có triệu chứng rõ — vì vậy theo dõi định kỳ giúp bạn **nhìn thấy xu hướng** trước khi sự cố xảy ra.

## Theo dõi tại nhà nghĩa là gì

Theo dõi tại nhà không thay thế máy đo ở phòng khám. Nó giúp bạn và bác sĩ có thêm dữ liệu thật trong đời sống hàng ngày: lúc nghỉ, lúc mệt, lúc vừa thức dậy.

Cách đo thường được khuyến nghị trong giáo dục sức khỏe cộng đồng:

- Ngồi nghỉ vài phút, lưng tựa, chân chạm sàn
- Để máy đúng vị trí cánh tay theo hướng dẫn của máy
- Ghi ngày, chỉ số tâm thu / tâm trương, và cảm giác lúc đo

## Đọc số như thế nào cho bình tĩnh

Một lần đo cao chưa đủ để kết luận. Hãy nhìn **nhiều lần trong vài ngày**. Khi đi khám, mang sổ ghi — bác sĩ sẽ giải thích trong bối cảnh sức khỏe của bạn.

## Khi nào cần gặp bác sĩ sớm hơn

Nếu có đau ngực dữ dội, khó thở nặng, nói khó, yếu nửa người, hoặc huyết áp rất cao kèm khó chịu bất thường — hãy tìm hỗ trợ y tế. Ứng dụng này không đánh giá cấp cứu.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_walk_001',
  'van-dong-trung-nien',
  'Vận động vừa sức sau tuổi 40',
  'Vì sao chuyển động đều đặn quan trọng hơn “tập mạnh”, và mức nào thường vừa với đời sống đi làm, chăm nhà.',
  'suc-khoe-trung-nien',
  'health',
  'Sống An 40+ Biên tập giáo dục',
  '2026-01-15',
  '2026-07-01',
  'active',
  5,
  '# Vận động vừa sức sau tuổi 40

Đây là bài học giáo dục về thói quen vận động. Không phải giáo án tập luyện cá nhân hóa.

## Cơ thể sau 40 cần gì

Sau tuổi 40, duy trì cơ, khớp và tim mạch thường nhờ **chuyển động đều** hơn là những buổi tập kiệt sức rồi bỏ. Đi bộ, leo cầu thang chậm, xoay khớp nhẹ — nếu phù hợp với bạn — đều có giá trị.

## Nguyên tắc “vừa sức”

Một mức vận động giáo dục thường nhấn mạnh:

- Bạn vẫn nói chuyện được khi đang vận động
- Không đau ngực, chóng mặt, khó thở bất thường
- Có thể lặp lại vài ngày trong tuần thay vì “gồng” một lần

Ví dụ thực tế: đi bộ khoảng 20 phút, vài buổi mỗi tuần, rồi tăng dần nếu cơ thể chịu được.

## Khi cần hỏi bác sĩ trước

Nếu bạn có bệnh nền, vừa phẫu thuật, đau khớp kéo dài, hoặc từng được khuyên hạn chế vận động — hãy hỏi bác sĩ / trạm y tế trước khi tăng cường độ.

## Lời nhắc

Mục tiêu không phải thành tích. Mục tiêu là **giữ khả năng đi lại và sinh hoạt** cho những năm phía trước.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_check_001',
  'kham-dinh-ky',
  'Khám sức khỏe định kỳ: theo dõi trước khi có triệu chứng',
  'Khám định kỳ giúp nhìn xu hướng sức khỏe theo thời gian — khác với đi khám khi đã thấy bất thường.',
  'kham-phong-benh',
  'health',
  'Sống An 40+ Biên tập giáo dục',
  '2026-02-01',
  '2026-07-01',
  'active',
  5,
  '# Khám sức khỏe định kỳ: theo dõi trước khi có triệu chứng

Bài học giáo dục. Không liệt kê gói khám bắt buộc, không thay lời bác sĩ.

## Khám định kỳ khác khám khi ốm

Khi đã có triệu chứng, bạn đi khám để xử lý việc đang xảy ra. Khám định kỳ nhằm **theo dõi các chỉ số cơ bản theo thời gian** (ví dụ huyết áp, đường huyết, mỡ máu — tùy bác sĩ chỉ định) và trao đổi sớm về lối sống.

## Vì sao tuổi ngoài 40 thường được nhắc nhiều hơn

Một số nguy cơ sức khỏe tăng dần theo tuổi và có thể im lặng trong thời gian dài. Việc gặp bác sĩ định kỳ giúp phát hiện thay đổi sớm hơn là chờ đến lúc khó chịu rõ.

## Cách chuẩn bị buổi khám cho hữu ích

- Mang danh sách thuốc đang dùng
- Ghi vài câu hỏi bạn muốn hỏi
- Mang sổ theo dõi huyết áp / đường huyết nếu có

## Giới hạn quan trọng

Khám định kỳ **không thay** việc đến cơ sở y tế khi có dấu hiệu bất thường. Nếu đau ngực, khó thở nặng, yếu nửa người, nói khó — hãy tìm hỗ trợ ngay.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_fund_001',
  'quy-du-phong',
  'Quỹ dự phòng: tấm đệm khi việc đột xuất đến',
  'Hiểu quỹ dự phòng là gì, vì sao giúp bớt phụ thuộc vay nóng, và cách nghĩ về mục tiêu vừa sức.',
  'chuan-bi-tai-chinh',
  'finance',
  'Sống An 40+ Biên tập giáo dục',
  '2026-02-10',
  '2026-07-01',
  'active',
  6,
  '# Quỹ dự phòng: tấm đệm khi việc đột xuất đến

Thông tin giáo dục về tiền bạc. **Không phải tư vấn đầu tư**, không khuyến nghị sản phẩm tài chính.

## Quỹ dự phòng là gì

Quỹ dự phòng (tiền để dành khi có việc đột xuất) là khoản tách riêng để chi khi ốm, sửa nhà đột xuất, hoặc mất thu nhập tạm thời — nhằm giảm việc phải vay nóng với lãi cao.

## Vì sao quan trọng với người ngoài 40

Tuổi này thường có nhiều trách nhiệm: con cái, bố mẹ, công việc. Một khoản dự phòng khiêm tốn nhưng **có thật** giúp bạn quyết định bình tĩnh hơn khi chuyện khó đến.

## Cách nghĩ về mục tiêu (không phải công thức bắt buộc)

Nhiều tài liệu giáo dục tài chính cá nhân gợi ý nghĩ theo số tháng chi tiêu cần thiết. Bạn có thể bắt đầu nhỏ:

1. Ước lượng chi tiêu cần thiết mỗi tháng (ăn, ở, thuốc, đi lại)
2. Đặt mục tiêu nhỏ, đều đặn theo khả năng
3. Tách khoản dự phòng khỏi tiền tiêu hàng ngày nếu có thể

## Điều không nên làm

Không dùng tiền đang cần cho sinh hoạt thiết yếu để mạo hiểm. Không coi bài này là lời khuyên đầu tư hay bảo hiểm cụ thể.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_expense_001',
  'chi-phi-ve-huu',
  'Hình dung chi tiêu khi về hưu',
  'Vì sao ước lượng nhu cầu tương lai giúp bớt mơ hồ — và các nhóm chi tiêu thường gặp cần nghĩ tới.',
  'chuan-bi-tai-chinh',
  'finance',
  'Sống An 40+ Biên tập giáo dục',
  '2026-02-10',
  '2026-07-01',
  'active',
  5,
  '# Hình dung chi tiêu khi về hưu

Bài học giáo dục để tự theo dõi. Không dự báo chính xác, không tư vấn đầu tư.

## Vì sao cần hình dung

Nhiều người lo về hưu vì **không rõ mình sẽ cần bao nhiêu**. Việc liệt kê nhóm chi tiêu không phải để tạo nỗi sợ — mà để biến nỗi lo mơ hồ thành bức tranh cụ thể hơn.

## Các nhóm thường gặp

- Ăn uống và nhu yếu phẩm
- Nhà ở (thuê / sửa / điện nước)
- Thuốc men và chăm sóc sức khỏe
- Đi lại
- Hỗ trợ gia đình (nếu có)

Con số bạn viết mang tính định hướng. Nó sẽ đổi khi đời sống đổi.

## Cách dùng bức tranh này

So sánh sơ bộ với nguồn thu dự kiến (lương hưu, tiết kiệm, hỗ trợ…). Nếu thấy khoảng trống, bạn có thêm thời gian để điều chỉnh thói quen chi tiêu hoặc trao đổi với người thân — **không** phải lúc chạy theo sản phẩm đầu tư theo lời khuyên trên mạng.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_docs_001',
  'giay-to-tuoi-gia',
  'Giấy tờ quan trọng và sự chủ động dài hạn',
  'Vì sao biết chỗ cất căn cước, sổ bảo hiểm và giấy tờ nhà giúp cả nhà nhẹ hơn khi có việc đột xuất.',
  'nha-o-giay-to',
  'finance',
  'Sống An 40+ Biên tập giáo dục',
  '2026-03-01',
  '2026-07-01',
  'active',
  5,
  '# Giấy tờ quan trọng và sự chủ động dài hạn

Thông tin giáo dục về tổ chức giấy tờ. **Không phải tư vấn pháp lý.**

## Vì sao giấy tờ liên quan đến “sống an”

Khi ốm đột xuất hoặc cần làm thủ tục, tìm giấy tờ thường làm cả nhà loạn. Chuẩn bị sớm là cách **giảm tải cho ngày khó**, không phải “nghĩ chuyện xấu”.

## Những giấy tờ thường cần sẵn

- Căn cước / CCCD
- Sổ bảo hiểm xã hội / thẻ bảo hiểm y tế (nếu có)
- Giấy tờ nhà (nếu có)
- Danh sách thuốc và dị ứng
- Số liên hệ người thân tin cậy

## Cách lưu vừa sức

Một hộp hoặc một ngăn tủ có nhãn rõ đã đủ bắt đầu. Cho một người thân tin cậy biết vị trí. Có thể giữ bản chụp ở nơi an toàn — nhưng bản gốc vẫn cần chỗ cố định.

## Giới hạn

Bài này không hướng dẫn thủ tục pháp lý cụ thể. Khi cần làm giấy tờ chính thức, hãy hỏi cơ quan có thẩm quyền hoặc người tư vấn pháp lý.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_fall_001',
  'phong-nga',
  'Ngã ở người lớn tuổi: rủi ro và cách giảm tại nhà',
  'Hiểu vì sao ngã nguy hiểm với người cao tuổi và những thay đổi môi trường nhà cửa thường được nhắc trong giáo dục phòng ngừa.',
  'cham-soc-cha-me',
  'caregiving',
  'Sống An 40+ Biên tập giáo dục',
  '2026-03-05',
  '2026-07-01',
  'active',
  6,
  '# Ngã ở người lớn tuổi: rủi ro và cách giảm tại nhà

Bài học giáo dục về an toàn tại nhà. Không thay cấp cứu, không thay lời bác sĩ.

## Vì sao ngã là vấn đề lớn

Với người lớn tuổi, một lần ngã có thể dẫn đến gãy xương, nằm lâu, và giảm tự tin đi lại. Nhiều vụ ngã xảy ra **ngay trong nhà** — nơi tưởng như quen thuộc nhất.

## Yếu tố thường làm tăng nguy cơ

- Sàn ướt, thảm trơn, dây điện vướng
- Ánh sáng kém ở cầu thang và nhà vệ sinh ban đêm
- Vội vàng khi mệt hoặc chóng mặt
- Một số thuốc có thể gây buồn ngủ / choáng (hãy hỏi bác sĩ, không tự đổi thuốc)

## Hướng giảm rủi ro trong giáo dục cộng đồng

- Giữ lối đi thông thoáng
- Tăng ánh sáng ở khu vực hay đi lại ban đêm
- Dùng thảm chống trượt nếu sàn dễ ướt
- Cân nhắc tay vịn ở chỗ thường mất thăng bằng (nếu điều kiện cho phép)

## Nếu có người bị ngã

Kiểm tra tỉnh táo. Không đỡ dậy mạnh nếu nghi chấn thương nặng. Gọi hỗ trợ y tế khi không đứng dậy được, đau nhiều, hoặc có dấu hiệu bất thường.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_contact_001',
  'lien-he-khan-cap',
  'Mạng hỗ trợ khi khẩn cấp: ai gọi và gọi thế nào',
  'Vì sao cần biết trước người và số điện thoại sẽ gọi khi có việc đột xuất — cho bạn và người thân.',
  'cham-soc-cha-me',
  'caregiving',
  'Sống An 40+ Biên tập giáo dục',
  '2026-03-05',
  '2026-07-01',
  'active',
  4,
  '# Mạng hỗ trợ khi khẩn cấp: ai gọi và gọi thế nào

Bài học giáo dục về chuẩn bị hỗ trợ. Không thay số cấp cứu chính thức tại địa phương của bạn.

## Vì sao cần chuẩn bị trước

Khi sự cố xảy ra, người đang hoảng khó nhớ số và thứ tự gọi. Việc ghi sẵn vài liên hệ tin cậy giúp **giảm thời gian lúng túng**.

## Ai thường có trong mạng hỗ trợ

- Người thân gần (1–2 người)
- Hàng xóm hoặc bạn tin cậy sống gần
- Cơ sở y tế / phòng khám bạn thường đến
- Số cấp cứu phù hợp nơi bạn sống (xác nhận theo địa phương)

## Cách để danh sách thật sự hữu dụng

Để ở nơi dễ thấy (tủ lạnh, ví, màn hình khóa điện thoại nếu an toàn với bạn). Cho người thân biết họ nằm trong danh sách — để họ không bất ngờ khi được gọi.

## Lời nhắc

Mạng hỗ trợ là một phần của chăm sóc dài hạn, không kém thuốc hay giấy tờ.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_family_001',
  'trao-doi-gia-dinh',
  'Nói chuyện với gia đình về chăm sóc sau này',
  'Vì sao mở lời sớm giúp cả nhà nhẹ hơn, và khung trao đổi ngắn thường hữu ích hơn một cuộc “họp lớn”.',
  'nha-o-giay-to',
  'caregiving',
  'Sống An 40+ Biên tập giáo dục',
  '2026-03-12',
  '2026-07-01',
  'active',
  5,
  '# Nói chuyện với gia đình về chăm sóc sau này

Bài học về giao tiếp trong gia đình. Không phải tư vấn pháp lý hay tâm lý lâm sàng.

## Vì sao nhiều nhà tránh chủ đề này

Sợ làm người thân buồn. Sợ bị hiểu là đòi hỏi. Sợ phải nhìn vào điều chưa sẵn sàng. Nhưng im lặng lâu thường khiến **sự cố quyết định hộ** khi ngày khó đến.

## Cuộc nói chuyện ngắn thường đủ để bắt đầu

Bạn có thể chọn một người tin cậy và nói về:

- Ai được gọi trước khi có việc khẩn
- Giấy tờ quan trọng để ở đâu
- Bạn muốn được hỗ trợ theo cách nào (và vẫn muốn tự làm những việc nào)

Không cần giải quyết hết trong một lần.

## Nghe cũng là chuẩn bị

Để người thân nói lo của họ. Đôi khi họ sợ “không làm tròn” không kém bạn.

## Kết

Mở lời sớm biến tình yêu thành sự rõ ràng — và sự rõ ràng giúp yêu thương bền hơn khi áp lực tăng.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_meds_001',
  'danh-sach-thuoc',
  'Quản lý thuốc an toàn hơn ở tuổi ngoài 40',
  'Vì sao biết rõ thuốc đang dùng giúp giảm nhầm lẫn khi khám, nhập viện, hoặc nhờ người thân hỗ trợ.',
  'kham-phong-benh',
  'health',
  'Sống An 40+ Biên tập giáo dục',
  '2026-03-20',
  '2026-07-01',
  'active',
  5,
  '# Quản lý thuốc an toàn hơn ở tuổi ngoài 40

Bài học giáo dục về an toàn dùng thuốc. **Không kê đơn. Không hướng dẫn tự đổi thuốc.**

## Vì sao việc này quan trọng

Sau tuổi 40, nhiều người dùng hơn một loại thuốc (huyết áp, đường huyết, khớp…). Nhầm liều, quên thuốc, hoặc không nhớ tên thuốc khi đi khám có thể làm bác sĩ thiếu thông tin quan trọng.

## Thông tin nên có trong danh sách cá nhân

- Tên thuốc (theo bao bì)
- Liều và giờ uống (như đang dùng)
- Bác sĩ / cơ sở kê đơn nếu nhớ
- Dị ứng thuốc đã biết

Mang danh sách khi đi khám hoặc nhập viện. Không thay đổi thuốc dựa trên thông tin trong ứng dụng.

## An toàn lưu trữ

Để thuốc nơi khô, có nhãn rõ, tránh trẻ nhỏ với phải. Biết thuốc nào sắp hết trước khoảng một tuần để kịp tái khám / mua đúng chỉ định.

## Khi nào hỏi bác sĩ / dược sĩ

Buồn nôn kéo dài, chóng mặt bất thường sau đổi thuốc, hoặc nghi uống nhầm — hãy hỏi chuyên môn, đừng tự xử lý theo mạng.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_sleep_001',
  'giac-ngu',
  'Giấc ngủ và sức khỏe tinh thần tuổi ngoài 40',
  'Vì sao ngủ kém làm lo âu nặng hơn, và những thói quen nền tảng thường được nhắc trong giáo dục sức khỏe.',
  'tri-nho-tinh-than',
  'health',
  'Sống An 40+ Biên tập giáo dục',
  '2026-04-01',
  '2026-07-01',
  'active',
  5,
  '# Giấc ngủ và sức khỏe tinh thần tuổi ngoài 40

Bài học giáo dục. Không chẩn đoán rối loạn giấc ngủ, không kê thuốc ngủ.

## Giấc ngủ ảnh hưởng gì

Khi thiếu ngủ, não dễ phóng đại mối lo và thu nhỏ hy vọng. Bạn không “yếu tinh thần” — bạn có thể đang **thiếu nhiên liệu**. Ngủ ổn định cũng liên quan đến huyết áp, đường huyết và khả năng tập trung trong ngày.

## Thói quen nền tảng thường được khuyến khích

- Giờ đi ngủ và thức dậy lệch nhau không quá nhiều giữa các ngày
- Giảm ánh sáng mạnh và kích thích (tin xấu, tranh luận căng) trước khi ngủ nếu có thể
- Phòng ngủ tối và mát vừa phải tùy điều kiện

## Không hoàn hảo cũng được

Có đêm bạn vẫn thức. Đừng cộng thêm tội lỗi. Sáng hôm sau, quay lại nhịp cũ. **Sự trở lại quan trọng hơn một đêm hoàn hảo.**

## Khi nên gặp bác sĩ

Ngáy to kèm ngừng thở, buồn ngủ ban ngày mức ảnh hưởng công việc, hoặc mất ngủ kéo dài — hãy trao đổi với bác sĩ thay vì tự dùng thuốc.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_income_001',
  'nguon-thu',
  'Các nguồn thu khi về hưu: nhìn rõ để bớt lo',
  'Hiểu các nhóm nguồn thu thường gặp và vì sao viết chúng ra giúp bạn chủ động hơn — không phải để so với hàng xóm.',
  'chuan-bi-tai-chinh',
  'finance',
  'Sống An 40+ Biên tập giáo dục',
  '2026-04-01',
  '2026-07-01',
  'active',
  5,
  '# Các nguồn thu khi về hưu: nhìn rõ để bớt lo

Bài tập giáo dục tự theo dõi. **Không phải khuyến nghị đầu tư** hay dự báo thu nhập.

## Vì sao “nhìn rõ” quan trọng

Lo về tiền thường lớn hơn khi mọi thứ còn mơ hồ. Viết ra những nguồn bạn **đã biết** giúp tách “chắc chắn”, “có thể”, và “chưa rõ”.

## Các nhóm thường gặp ở Việt Nam

- Lương hưu / bảo hiểm xã hội (nếu tham gia)
- Tiết kiệm và lãi (nếu có)
- Thu nhập từ công việc nhẹ sau về hưu (nếu dự định)
- Hỗ trợ gia đình (nếu có thỏa thuận)
- Nguồn khác bạn đang nắm

## Cách dùng danh sách này

Không so với hàng xóm. Dùng để:

1. Thấy chỗ nào còn trống thông tin (ví dụ chưa rõ mức lương hưu dự kiến)
2. Biết cần hỏi cơ quan bảo hiểm xã hội / nơi làm việc những gì
3. Kết hợp với bức tranh chi tiêu để bớt hoảng

## Giới hạn

Sống An không tư vấn đầu tư, bảo hiểm hay pháp lý. Khi cần số liệu chính thức về BHXH, hãy hỏi cơ quan Bảo hiểm xã hội Việt Nam hoặc nơi bạn đang tham gia.',
  datetime('now'),
  datetime('now')
);



-- Refresh educational copy on re-seed (slug ổn định; INSERT OR IGNORE không ghi đè).

UPDATE library_lessons SET
  title = 'Huyết áp tuổi ngoài 40: vì sao nên theo dõi đều',
  summary = 'Hiểu vai trò của huyết áp với sức khỏe dài hạn và cách theo dõi tại nhà một cách bình tĩnh.',
  estimated_reading_minutes = 6,
  body_markdown = '# Huyết áp tuổi ngoài 40: vì sao nên theo dõi đều

Đây là bài học giáo dục. Không chẩn đoán bệnh, không thay lời bác sĩ.

## Vì sao huyết áp quan trọng sau tuổi 40

Huyết áp phản ánh lực máu đẩy lên thành mạch. Theo thời gian, huyết áp cao kéo dài có thể liên quan đến nguy cơ về tim mạch và đột quỵ. Nhiều người không có triệu chứng rõ — vì vậy theo dõi định kỳ giúp bạn **nhìn thấy xu hướng** trước khi sự cố xảy ra.

## Theo dõi tại nhà nghĩa là gì

Theo dõi tại nhà không thay thế máy đo ở phòng khám. Nó giúp bạn và bác sĩ có thêm dữ liệu thật trong đời sống hàng ngày: lúc nghỉ, lúc mệt, lúc vừa thức dậy.

Cách đo thường được khuyến nghị trong giáo dục sức khỏe cộng đồng:

- Ngồi nghỉ vài phút, lưng tựa, chân chạm sàn
- Để máy đúng vị trí cánh tay theo hướng dẫn của máy
- Ghi ngày, chỉ số tâm thu / tâm trương, và cảm giác lúc đo

## Đọc số như thế nào cho bình tĩnh

Một lần đo cao chưa đủ để kết luận. Hãy nhìn **nhiều lần trong vài ngày**. Khi đi khám, mang sổ ghi — bác sĩ sẽ giải thích trong bối cảnh sức khỏe của bạn.

## Khi nào cần gặp bác sĩ sớm hơn

Nếu có đau ngực dữ dội, khó thở nặng, nói khó, yếu nửa người, hoặc huyết áp rất cao kèm khó chịu bất thường — hãy tìm hỗ trợ y tế. Ứng dụng này không đánh giá cấp cứu.',
  updated_at = datetime('now')
WHERE slug = 'theo-doi-huyet-ap';

UPDATE library_lessons SET
  title = 'Vận động vừa sức sau tuổi 40',
  summary = 'Vì sao chuyển động đều đặn quan trọng hơn “tập mạnh”, và mức nào thường vừa với đời sống đi làm, chăm nhà.',
  estimated_reading_minutes = 5,
  body_markdown = '# Vận động vừa sức sau tuổi 40

Đây là bài học giáo dục về thói quen vận động. Không phải giáo án tập luyện cá nhân hóa.

## Cơ thể sau 40 cần gì

Sau tuổi 40, duy trì cơ, khớp và tim mạch thường nhờ **chuyển động đều** hơn là những buổi tập kiệt sức rồi bỏ. Đi bộ, leo cầu thang chậm, xoay khớp nhẹ — nếu phù hợp với bạn — đều có giá trị.

## Nguyên tắc “vừa sức”

Một mức vận động giáo dục thường nhấn mạnh:

- Bạn vẫn nói chuyện được khi đang vận động
- Không đau ngực, chóng mặt, khó thở bất thường
- Có thể lặp lại vài ngày trong tuần thay vì “gồng” một lần

Ví dụ thực tế: đi bộ khoảng 20 phút, vài buổi mỗi tuần, rồi tăng dần nếu cơ thể chịu được.

## Khi cần hỏi bác sĩ trước

Nếu bạn có bệnh nền, vừa phẫu thuật, đau khớp kéo dài, hoặc từng được khuyên hạn chế vận động — hãy hỏi bác sĩ / trạm y tế trước khi tăng cường độ.

## Lời nhắc

Mục tiêu không phải thành tích. Mục tiêu là **giữ khả năng đi lại và sinh hoạt** cho những năm phía trước.',
  updated_at = datetime('now')
WHERE slug = 'van-dong-trung-nien';

UPDATE library_lessons SET
  title = 'Khám sức khỏe định kỳ: theo dõi trước khi có triệu chứng',
  summary = 'Khám định kỳ giúp nhìn xu hướng sức khỏe theo thời gian — khác với đi khám khi đã thấy bất thường.',
  estimated_reading_minutes = 5,
  body_markdown = '# Khám sức khỏe định kỳ: theo dõi trước khi có triệu chứng

Bài học giáo dục. Không liệt kê gói khám bắt buộc, không thay lời bác sĩ.

## Khám định kỳ khác khám khi ốm

Khi đã có triệu chứng, bạn đi khám để xử lý việc đang xảy ra. Khám định kỳ nhằm **theo dõi các chỉ số cơ bản theo thời gian** (ví dụ huyết áp, đường huyết, mỡ máu — tùy bác sĩ chỉ định) và trao đổi sớm về lối sống.

## Vì sao tuổi ngoài 40 thường được nhắc nhiều hơn

Một số nguy cơ sức khỏe tăng dần theo tuổi và có thể im lặng trong thời gian dài. Việc gặp bác sĩ định kỳ giúp phát hiện thay đổi sớm hơn là chờ đến lúc khó chịu rõ.

## Cách chuẩn bị buổi khám cho hữu ích

- Mang danh sách thuốc đang dùng
- Ghi vài câu hỏi bạn muốn hỏi
- Mang sổ theo dõi huyết áp / đường huyết nếu có

## Giới hạn quan trọng

Khám định kỳ **không thay** việc đến cơ sở y tế khi có dấu hiệu bất thường. Nếu đau ngực, khó thở nặng, yếu nửa người, nói khó — hãy tìm hỗ trợ ngay.',
  updated_at = datetime('now')
WHERE slug = 'kham-dinh-ky';

UPDATE library_lessons SET
  title = 'Quỹ dự phòng: tấm đệm khi việc đột xuất đến',
  summary = 'Hiểu quỹ dự phòng là gì, vì sao giúp bớt phụ thuộc vay nóng, và cách nghĩ về mục tiêu vừa sức.',
  estimated_reading_minutes = 6,
  body_markdown = '# Quỹ dự phòng: tấm đệm khi việc đột xuất đến

Thông tin giáo dục về tiền bạc. **Không phải tư vấn đầu tư**, không khuyến nghị sản phẩm tài chính.

## Quỹ dự phòng là gì

Quỹ dự phòng (tiền để dành khi có việc đột xuất) là khoản tách riêng để chi khi ốm, sửa nhà đột xuất, hoặc mất thu nhập tạm thời — nhằm giảm việc phải vay nóng với lãi cao.

## Vì sao quan trọng với người ngoài 40

Tuổi này thường có nhiều trách nhiệm: con cái, bố mẹ, công việc. Một khoản dự phòng khiêm tốn nhưng **có thật** giúp bạn quyết định bình tĩnh hơn khi chuyện khó đến.

## Cách nghĩ về mục tiêu (không phải công thức bắt buộc)

Nhiều tài liệu giáo dục tài chính cá nhân gợi ý nghĩ theo số tháng chi tiêu cần thiết. Bạn có thể bắt đầu nhỏ:

1. Ước lượng chi tiêu cần thiết mỗi tháng (ăn, ở, thuốc, đi lại)
2. Đặt mục tiêu nhỏ, đều đặn theo khả năng
3. Tách khoản dự phòng khỏi tiền tiêu hàng ngày nếu có thể

## Điều không nên làm

Không dùng tiền đang cần cho sinh hoạt thiết yếu để mạo hiểm. Không coi bài này là lời khuyên đầu tư hay bảo hiểm cụ thể.',
  updated_at = datetime('now')
WHERE slug = 'quy-du-phong';

UPDATE library_lessons SET
  title = 'Hình dung chi tiêu khi về hưu',
  summary = 'Vì sao ước lượng nhu cầu tương lai giúp bớt mơ hồ — và các nhóm chi tiêu thường gặp cần nghĩ tới.',
  estimated_reading_minutes = 5,
  body_markdown = '# Hình dung chi tiêu khi về hưu

Bài học giáo dục để tự theo dõi. Không dự báo chính xác, không tư vấn đầu tư.

## Vì sao cần hình dung

Nhiều người lo về hưu vì **không rõ mình sẽ cần bao nhiêu**. Việc liệt kê nhóm chi tiêu không phải để tạo nỗi sợ — mà để biến nỗi lo mơ hồ thành bức tranh cụ thể hơn.

## Các nhóm thường gặp

- Ăn uống và nhu yếu phẩm
- Nhà ở (thuê / sửa / điện nước)
- Thuốc men và chăm sóc sức khỏe
- Đi lại
- Hỗ trợ gia đình (nếu có)

Con số bạn viết mang tính định hướng. Nó sẽ đổi khi đời sống đổi.

## Cách dùng bức tranh này

So sánh sơ bộ với nguồn thu dự kiến (lương hưu, tiết kiệm, hỗ trợ…). Nếu thấy khoảng trống, bạn có thêm thời gian để điều chỉnh thói quen chi tiêu hoặc trao đổi với người thân — **không** phải lúc chạy theo sản phẩm đầu tư theo lời khuyên trên mạng.',
  updated_at = datetime('now')
WHERE slug = 'chi-phi-ve-huu';

UPDATE library_lessons SET
  title = 'Giấy tờ quan trọng và sự chủ động dài hạn',
  summary = 'Vì sao biết chỗ cất căn cước, sổ bảo hiểm và giấy tờ nhà giúp cả nhà nhẹ hơn khi có việc đột xuất.',
  estimated_reading_minutes = 5,
  body_markdown = '# Giấy tờ quan trọng và sự chủ động dài hạn

Thông tin giáo dục về tổ chức giấy tờ. **Không phải tư vấn pháp lý.**

## Vì sao giấy tờ liên quan đến “sống an”

Khi ốm đột xuất hoặc cần làm thủ tục, tìm giấy tờ thường làm cả nhà loạn. Chuẩn bị sớm là cách **giảm tải cho ngày khó**, không phải “nghĩ chuyện xấu”.

## Những giấy tờ thường cần sẵn

- Căn cước / CCCD
- Sổ bảo hiểm xã hội / thẻ bảo hiểm y tế (nếu có)
- Giấy tờ nhà (nếu có)
- Danh sách thuốc và dị ứng
- Số liên hệ người thân tin cậy

## Cách lưu vừa sức

Một hộp hoặc một ngăn tủ có nhãn rõ đã đủ bắt đầu. Cho một người thân tin cậy biết vị trí. Có thể giữ bản chụp ở nơi an toàn — nhưng bản gốc vẫn cần chỗ cố định.

## Giới hạn

Bài này không hướng dẫn thủ tục pháp lý cụ thể. Khi cần làm giấy tờ chính thức, hãy hỏi cơ quan có thẩm quyền hoặc người tư vấn pháp lý.',
  updated_at = datetime('now')
WHERE slug = 'giay-to-tuoi-gia';

UPDATE library_lessons SET
  title = 'Ngã ở người lớn tuổi: rủi ro và cách giảm tại nhà',
  summary = 'Hiểu vì sao ngã nguy hiểm với người cao tuổi và những thay đổi môi trường nhà cửa thường được nhắc trong giáo dục phòng ngừa.',
  estimated_reading_minutes = 6,
  body_markdown = '# Ngã ở người lớn tuổi: rủi ro và cách giảm tại nhà

Bài học giáo dục về an toàn tại nhà. Không thay cấp cứu, không thay lời bác sĩ.

## Vì sao ngã là vấn đề lớn

Với người lớn tuổi, một lần ngã có thể dẫn đến gãy xương, nằm lâu, và giảm tự tin đi lại. Nhiều vụ ngã xảy ra **ngay trong nhà** — nơi tưởng như quen thuộc nhất.

## Yếu tố thường làm tăng nguy cơ

- Sàn ướt, thảm trơn, dây điện vướng
- Ánh sáng kém ở cầu thang và nhà vệ sinh ban đêm
- Vội vàng khi mệt hoặc chóng mặt
- Một số thuốc có thể gây buồn ngủ / choáng (hãy hỏi bác sĩ, không tự đổi thuốc)

## Hướng giảm rủi ro trong giáo dục cộng đồng

- Giữ lối đi thông thoáng
- Tăng ánh sáng ở khu vực hay đi lại ban đêm
- Dùng thảm chống trượt nếu sàn dễ ướt
- Cân nhắc tay vịn ở chỗ thường mất thăng bằng (nếu điều kiện cho phép)

## Nếu có người bị ngã

Kiểm tra tỉnh táo. Không đỡ dậy mạnh nếu nghi chấn thương nặng. Gọi hỗ trợ y tế khi không đứng dậy được, đau nhiều, hoặc có dấu hiệu bất thường.',
  updated_at = datetime('now')
WHERE slug = 'phong-nga';

UPDATE library_lessons SET
  title = 'Mạng hỗ trợ khi khẩn cấp: ai gọi và gọi thế nào',
  summary = 'Vì sao cần biết trước người và số điện thoại sẽ gọi khi có việc đột xuất — cho bạn và người thân.',
  estimated_reading_minutes = 4,
  body_markdown = '# Mạng hỗ trợ khi khẩn cấp: ai gọi và gọi thế nào

Bài học giáo dục về chuẩn bị hỗ trợ. Không thay số cấp cứu chính thức tại địa phương của bạn.

## Vì sao cần chuẩn bị trước

Khi sự cố xảy ra, người đang hoảng khó nhớ số và thứ tự gọi. Việc ghi sẵn vài liên hệ tin cậy giúp **giảm thời gian lúng túng**.

## Ai thường có trong mạng hỗ trợ

- Người thân gần (1–2 người)
- Hàng xóm hoặc bạn tin cậy sống gần
- Cơ sở y tế / phòng khám bạn thường đến
- Số cấp cứu phù hợp nơi bạn sống (xác nhận theo địa phương)

## Cách để danh sách thật sự hữu dụng

Để ở nơi dễ thấy (tủ lạnh, ví, màn hình khóa điện thoại nếu an toàn với bạn). Cho người thân biết họ nằm trong danh sách — để họ không bất ngờ khi được gọi.

## Lời nhắc

Mạng hỗ trợ là một phần của chăm sóc dài hạn, không kém thuốc hay giấy tờ.',
  updated_at = datetime('now')
WHERE slug = 'lien-he-khan-cap';

UPDATE library_lessons SET
  title = 'Nói chuyện với gia đình về chăm sóc sau này',
  summary = 'Vì sao mở lời sớm giúp cả nhà nhẹ hơn, và khung trao đổi ngắn thường hữu ích hơn một cuộc “họp lớn”.',
  estimated_reading_minutes = 5,
  body_markdown = '# Nói chuyện với gia đình về chăm sóc sau này

Bài học về giao tiếp trong gia đình. Không phải tư vấn pháp lý hay tâm lý lâm sàng.

## Vì sao nhiều nhà tránh chủ đề này

Sợ làm người thân buồn. Sợ bị hiểu là đòi hỏi. Sợ phải nhìn vào điều chưa sẵn sàng. Nhưng im lặng lâu thường khiến **sự cố quyết định hộ** khi ngày khó đến.

## Cuộc nói chuyện ngắn thường đủ để bắt đầu

Bạn có thể chọn một người tin cậy và nói về:

- Ai được gọi trước khi có việc khẩn
- Giấy tờ quan trọng để ở đâu
- Bạn muốn được hỗ trợ theo cách nào (và vẫn muốn tự làm những việc nào)

Không cần giải quyết hết trong một lần.

## Nghe cũng là chuẩn bị

Để người thân nói lo của họ. Đôi khi họ sợ “không làm tròn” không kém bạn.

## Kết

Mở lời sớm biến tình yêu thành sự rõ ràng — và sự rõ ràng giúp yêu thương bền hơn khi áp lực tăng.',
  updated_at = datetime('now')
WHERE slug = 'trao-doi-gia-dinh';

UPDATE library_lessons SET
  title = 'Quản lý thuốc an toàn hơn ở tuổi ngoài 40',
  summary = 'Vì sao biết rõ thuốc đang dùng giúp giảm nhầm lẫn khi khám, nhập viện, hoặc nhờ người thân hỗ trợ.',
  estimated_reading_minutes = 5,
  body_markdown = '# Quản lý thuốc an toàn hơn ở tuổi ngoài 40

Bài học giáo dục về an toàn dùng thuốc. **Không kê đơn. Không hướng dẫn tự đổi thuốc.**

## Vì sao việc này quan trọng

Sau tuổi 40, nhiều người dùng hơn một loại thuốc (huyết áp, đường huyết, khớp…). Nhầm liều, quên thuốc, hoặc không nhớ tên thuốc khi đi khám có thể làm bác sĩ thiếu thông tin quan trọng.

## Thông tin nên có trong danh sách cá nhân

- Tên thuốc (theo bao bì)
- Liều và giờ uống (như đang dùng)
- Bác sĩ / cơ sở kê đơn nếu nhớ
- Dị ứng thuốc đã biết

Mang danh sách khi đi khám hoặc nhập viện. Không thay đổi thuốc dựa trên thông tin trong ứng dụng.

## An toàn lưu trữ

Để thuốc nơi khô, có nhãn rõ, tránh trẻ nhỏ với phải. Biết thuốc nào sắp hết trước khoảng một tuần để kịp tái khám / mua đúng chỉ định.

## Khi nào hỏi bác sĩ / dược sĩ

Buồn nôn kéo dài, chóng mặt bất thường sau đổi thuốc, hoặc nghi uống nhầm — hãy hỏi chuyên môn, đừng tự xử lý theo mạng.',
  updated_at = datetime('now')
WHERE slug = 'danh-sach-thuoc';

UPDATE library_lessons SET
  title = 'Giấc ngủ và sức khỏe tinh thần tuổi ngoài 40',
  summary = 'Vì sao ngủ kém làm lo âu nặng hơn, và những thói quen nền tảng thường được nhắc trong giáo dục sức khỏe.',
  estimated_reading_minutes = 5,
  body_markdown = '# Giấc ngủ và sức khỏe tinh thần tuổi ngoài 40

Bài học giáo dục. Không chẩn đoán rối loạn giấc ngủ, không kê thuốc ngủ.

## Giấc ngủ ảnh hưởng gì

Khi thiếu ngủ, não dễ phóng đại mối lo và thu nhỏ hy vọng. Bạn không “yếu tinh thần” — bạn có thể đang **thiếu nhiên liệu**. Ngủ ổn định cũng liên quan đến huyết áp, đường huyết và khả năng tập trung trong ngày.

## Thói quen nền tảng thường được khuyến khích

- Giờ đi ngủ và thức dậy lệch nhau không quá nhiều giữa các ngày
- Giảm ánh sáng mạnh và kích thích (tin xấu, tranh luận căng) trước khi ngủ nếu có thể
- Phòng ngủ tối và mát vừa phải tùy điều kiện

## Không hoàn hảo cũng được

Có đêm bạn vẫn thức. Đừng cộng thêm tội lỗi. Sáng hôm sau, quay lại nhịp cũ. **Sự trở lại quan trọng hơn một đêm hoàn hảo.**

## Khi nên gặp bác sĩ

Ngáy to kèm ngừng thở, buồn ngủ ban ngày mức ảnh hưởng công việc, hoặc mất ngủ kéo dài — hãy trao đổi với bác sĩ thay vì tự dùng thuốc.',
  updated_at = datetime('now')
WHERE slug = 'giac-ngu';

UPDATE library_lessons SET
  title = 'Các nguồn thu khi về hưu: nhìn rõ để bớt lo',
  summary = 'Hiểu các nhóm nguồn thu thường gặp và vì sao viết chúng ra giúp bạn chủ động hơn — không phải để so với hàng xóm.',
  estimated_reading_minutes = 5,
  body_markdown = '# Các nguồn thu khi về hưu: nhìn rõ để bớt lo

Bài tập giáo dục tự theo dõi. **Không phải khuyến nghị đầu tư** hay dự báo thu nhập.

## Vì sao “nhìn rõ” quan trọng

Lo về tiền thường lớn hơn khi mọi thứ còn mơ hồ. Viết ra những nguồn bạn **đã biết** giúp tách “chắc chắn”, “có thể”, và “chưa rõ”.

## Các nhóm thường gặp ở Việt Nam

- Lương hưu / bảo hiểm xã hội (nếu tham gia)
- Tiết kiệm và lãi (nếu có)
- Thu nhập từ công việc nhẹ sau về hưu (nếu dự định)
- Hỗ trợ gia đình (nếu có thỏa thuận)
- Nguồn khác bạn đang nắm

## Cách dùng danh sách này

Không so với hàng xóm. Dùng để:

1. Thấy chỗ nào còn trống thông tin (ví dụ chưa rõ mức lương hưu dự kiến)
2. Biết cần hỏi cơ quan bảo hiểm xã hội / nơi làm việc những gì
3. Kết hợp với bức tranh chi tiêu để bớt hoảng

## Giới hạn

Sống An không tư vấn đầu tư, bảo hiểm hay pháp lý. Khi cần số liệu chính thức về BHXH, hãy hỏi cơ quan Bảo hiểm xã hội Việt Nam hoặc nơi bạn đang tham gia.',
  updated_at = datetime('now')
WHERE slug = 'nguon-thu';

-- Approved demo source for local retrieval fallback
INSERT OR IGNORE INTO source_documents (
  id, public_id, slug, title, summary, issuer, jurisdiction, document_type, language, category, pillar,
  estimated_reading_minutes, status, review_status, publication_date, effective_from, last_reviewed_at, reviewer,
  created_at, updated_at
) VALUES (
  'src_demo_fall',
  'psrc_demo_fall',
  'huong-dan-phong-nga-giao-duc',
  'Hướng dẫn giáo dục về phòng ngã tại nhà',
  'Nội dung giáo dục minh họa cho truy vấn RAG cục bộ.',
  'Sống An 40+ Biên tập giáo dục',
  'VN',
  'education',
  'vi',
  'cham-soc-cha-me',
  'caregiving',
  4,
  'active',
  'approved',
  '2026-03-05',
  '2026-03-05',
  '2026-07-01',
  'seed',
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO source_versions (
  id, source_id, version_number, content_hash, reviewed_text, created_at, created_by
) VALUES (
  'sver_demo_fall',
  'src_demo_fall',
  1,
  'seedhash1',
  '# Phòng ngã tại nhà

Khi người cao tuổi đi lại trong nhà, hãy giữ lối đi thông thoáng và đủ ánh sáng.

## Nếu có người bị ngã
- Kiểm tra xem họ có tỉnh táo không.
- Không đỡ dậy mạnh nếu nghi ngờ chấn thương nặng.
- Gọi hỗ trợ y tế khi không đứng dậy được, đau nhiều, hoặc có dấu hiệu bất thường.

Đây là thông tin giáo dục, không thay thế cấp cứu.',
  datetime('now'),
  'seed'
);

INSERT OR IGNORE INTO source_chunks (
  id, source_id, version_id, chunk_index, heading, location_ref, content, content_hash, metadata_json, indexing_status, created_at
) VALUES
(
  'chk_demo_1',
  'src_demo_fall',
  'sver_demo_fall',
  0,
  'Phòng ngã tại nhà',
  'chunk-0',
  'Phòng ngã tại nhà. Khi người cao tuổi đi lại trong nhà, hãy giữ lối đi thông thoáng và đủ ánh sáng.',
  'seedchunk1',
  '{"source_id":"src_demo_fall","title":"Hướng dẫn giáo dục về phòng ngã tại nhà","issuer":"Sống An 40+ Biên tập giáo dục","status":"active","review_status":"approved","publication_date":"2026-03-05","category":"cham-soc-cha-me"}',
  'indexed',
  datetime('now')
),
(
  'chk_demo_2',
  'src_demo_fall',
  'sver_demo_fall',
  1,
  'Nếu có người bị ngã',
  'chunk-1',
  'Nếu có người bị ngã: kiểm tra tỉnh táo; không đỡ dậy mạnh nếu nghi chấn thương nặng; gọi hỗ trợ y tế khi không đứng dậy được hoặc đau nhiều. Đây là thông tin giáo dục, không thay thế cấp cứu.',
  'seedchunk2',
  '{"source_id":"src_demo_fall","title":"Hướng dẫn giáo dục về phòng ngã tại nhà","issuer":"Sống An 40+ Biên tập giáo dục","status":"active","review_status":"approved","publication_date":"2026-03-05","category":"cham-soc-cha-me"}',
  'indexed',
  datetime('now')
);

INSERT OR IGNORE INTO source_documents (
  id, public_id, slug, title, summary, issuer, jurisdiction, document_type, language, category, pillar,
  status, review_status, publication_date, effective_from, last_reviewed_at, reviewer, created_at, updated_at
) VALUES (
  'src_demo_fund',
  'psrc_demo_fund',
  'quy-du-phong-giao-duc',
  'Giáo dục về quỹ dự phòng',
  'Bài minh họa về quỹ dự phòng cho truy vấn cục bộ.',
  'Sống An 40+ Biên tập giáo dục',
  'VN',
  'education',
  'vi',
  'chuan-bi-tai-chinh',
  'finance',
  'active',
  'approved',
  '2026-02-10',
  '2026-02-10',
  '2026-07-01',
  'seed',
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO source_versions (
  id, source_id, version_number, content_hash, reviewed_text, created_at, created_by
) VALUES (
  'sver_demo_fund',
  'src_demo_fund',
  1,
  'seedhash2',
  '# Quỹ dự phòng

Quỹ dự phòng giúp chi trả các việc đột xuất mà không phải vay nóng.

## Cách bắt đầu
Ước lượng chi phí thiết yếu mỗi tháng, rồi đặt mục tiêu nhỏ và đều đặn. Đây không phải tư vấn đầu tư hay sản phẩm tài chính.',
  datetime('now'),
  'seed'
);

INSERT OR IGNORE INTO source_chunks (
  id, source_id, version_id, chunk_index, heading, location_ref, content, content_hash, metadata_json, indexing_status, created_at
) VALUES (
  'chk_demo_fund_1',
  'src_demo_fund',
  'sver_demo_fund',
  0,
  'Quỹ dự phòng',
  'chunk-0',
  'Quỹ dự phòng giúp chi trả các việc đột xuất. Ước lượng chi phí thiết yếu mỗi tháng, rồi đặt mục tiêu nhỏ và đều đặn. Đây không phải tư vấn đầu tư.',
  'seedchunk3',
  '{"source_id":"src_demo_fund","title":"Giáo dục về quỹ dự phòng","issuer":"Sống An 40+ Biên tập giáo dục","status":"active","review_status":"approved","publication_date":"2026-02-10","category":"chuan-bi-tai-chinh"}',
  'indexed',
  datetime('now')
);

-- Superseded source should be excluded from retrieval filters
INSERT OR IGNORE INTO source_documents (
  id, public_id, slug, title, summary, issuer, jurisdiction, document_type, language, category,
  status, review_status, publication_date, created_at, updated_at
) VALUES (
  'src_demo_old',
  'psrc_demo_old',
  'bai-cu-da-thay-the',
  'Bài cũ đã bị thay thế',
  'Nguồn superseded để kiểm thử bộ lọc.',
  'Sống An 40+ Biên tập giáo dục',
  'VN',
  'education',
  'vi',
  'suc-khoe-trung-nien',
  'superseded',
  'approved',
  '2020-01-01',
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO source_chunks (
  id, source_id, version_id, chunk_index, heading, location_ref, content, content_hash, metadata_json, indexing_status, created_at
) VALUES (
  'chk_demo_old',
  'src_demo_old',
  'sver_demo_fall',
  0,
  null,
  'chunk-0',
  'Nội dung cũ về sức khỏe không còn dùng.',
  'seedchunkold',
  '{"source_id":"src_demo_old","title":"Bài cũ đã bị thay thế","issuer":"Sống An 40+ Biên tập giáo dục","status":"superseded","review_status":"approved"}',
  'indexed',
  datetime('now')
);

-- Extra approved sources covering example chat questions (health check + documents)
INSERT OR IGNORE INTO source_documents (
  id, public_id, slug, title, summary, issuer, jurisdiction, document_type, language, category, pillar,
  estimated_reading_minutes, status, review_status, publication_date, effective_from, last_reviewed_at, reviewer,
  created_at, updated_at
) VALUES (
  'src_demo_checkup',
  'psrc_demo_checkup',
  'kham-suc-khoe-tuoi-40-giao-duc',
  'Khám sức khỏe định kỳ từ tuổi 40 (giáo dục)',
  'Gợi ý giáo dục về việc trao đổi với nhân viên y tế các hạng mục theo dõi thường gặp.',
  'Sống An 40+ Biên tập giáo dục',
  'VN',
  'education',
  'vi',
  'kham-phong-benh',
  'health',
  5,
  'active',
  'approved',
  '2026-04-01',
  '2026-04-01',
  '2026-07-01',
  'seed',
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO source_versions (
  id, source_id, version_number, content_hash, reviewed_text, created_at, created_by
) VALUES (
  'sver_demo_checkup',
  'src_demo_checkup',
  1,
  'seedhash_checkup',
  '# Khám sức khỏe từ tuổi 40

Từ tuổi 40, nhiều người được khuyên chủ động khám định kỳ và trao đổi với nhân viên y tế về huyết áp, đường huyết, cholesterol, cân nặng và lối sống.

## Việc có thể chuẩn bị
- Mang theo danh sách thuốc đang dùng.
- Ghi triệu chứng hoặc thay đổi gần đây.
- Hỏi rõ lịch tái khám và dấu hiệu cần đi khám sớm.

Ứng dụng này không chỉ định xét nghiệm và không chẩn đoán.',
  datetime('now'),
  'seed'
);

INSERT OR IGNORE INTO source_chunks (
  id, source_id, version_id, chunk_index, heading, location_ref, content, content_hash, metadata_json, indexing_status, created_at
) VALUES (
  'chk_demo_checkup_1',
  'src_demo_checkup',
  'sver_demo_checkup',
  0,
  'Khám sức khỏe từ tuổi 40',
  'chunk-0',
  'Từ tuổi 40, nên chủ động khám định kỳ và trao đổi với nhân viên y tế về huyết áp, đường huyết, cholesterol, cân nặng và lối sống. Mang theo danh sách thuốc; ghi triệu chứng; hỏi lịch tái khám. Đây là thông tin giáo dục, không chỉ định xét nghiệm.',
  'seedchunk_checkup',
  '{"source_id":"src_demo_checkup","title":"Khám sức khỏe định kỳ từ tuổi 40 (giáo dục)","issuer":"Sống An 40+ Biên tập giáo dục","status":"active","review_status":"approved","publication_date":"2026-04-01","category":"kham-phong-benh"}',
  'indexed',
  datetime('now')
);

INSERT OR IGNORE INTO source_documents (
  id, public_id, slug, title, summary, issuer, jurisdiction, document_type, language, category, pillar,
  estimated_reading_minutes, status, review_status, publication_date, effective_from, last_reviewed_at, reviewer,
  created_at, updated_at
) VALUES (
  'src_demo_docs',
  'psrc_demo_docs',
  'giay-to-tuoi-gia-giao-duc',
  'Chuẩn bị giấy tờ quan trọng cho tuổi già (giáo dục)',
  'Gợi ý giáo dục về việc sắp xếp giấy tờ cá nhân và cho người thân tin cậy biết vị trí lưu.',
  'Sống An 40+ Biên tập giáo dục',
  'VN',
  'education',
  'vi',
  'nha-o-giay-to',
  'finance',
  4,
  'active',
  'approved',
  '2026-04-01',
  '2026-04-01',
  '2026-07-01',
  'seed',
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO source_versions (
  id, source_id, version_number, content_hash, reviewed_text, created_at, created_by
) VALUES (
  'sver_demo_docs',
  'src_demo_docs',
  1,
  'seedhash_docs',
  '# Giấy tờ quan trọng

Chuẩn bị giấy tờ cho tuổi già thường gồm giấy tùy thân, bảo hiểm y tế/xã hội, giấy tờ nhà đất và thông tin liên hệ khẩn cấp.

## Gợi ý thực tế
- Gom bản gốc và bản sao vào một chỗ dễ tìm.
- Cho một người thân tin cậy biết vị trí lưu.
- Rà soát định kỳ khi có thay đổi.

Không phải tư vấn pháp lý.',
  datetime('now'),
  'seed'
);

INSERT OR IGNORE INTO source_chunks (
  id, source_id, version_id, chunk_index, heading, location_ref, content, content_hash, metadata_json, indexing_status, created_at
) VALUES (
  'chk_demo_docs_1',
  'src_demo_docs',
  'sver_demo_docs',
  0,
  'Giấy tờ quan trọng',
  'chunk-0',
  'Chuẩn bị giấy tờ cho tuổi già: giấy tùy thân, bảo hiểm, giấy tờ nhà đất và liên hệ khẩn cấp. Gom bản gốc và bản sao; cho người thân tin cậy biết vị trí lưu; rà soát khi có thay đổi. Không phải tư vấn pháp lý.',
  'seedchunk_docs',
  '{"source_id":"src_demo_docs","title":"Chuẩn bị giấy tờ quan trọng cho tuổi già (giáo dục)","issuer":"Sống An 40+ Biên tập giáo dục","status":"active","review_status":"approved","publication_date":"2026-04-01","category":"nha-o-giay-to"}',
  'indexed',
  datetime('now')
);
