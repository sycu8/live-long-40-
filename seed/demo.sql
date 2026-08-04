-- Demo seed: educational lessons authored for Sống An 40+ (not government documents).
-- Safe demonstration content only.

INSERT OR IGNORE INTO library_lessons (
  id, slug, title, summary, category, pillar, issuer, publication_date, last_reviewed_at,
  status, estimated_reading_minutes, body_markdown, created_at, updated_at
) VALUES
(
  'lesson_bp_001',
  'theo-doi-huyet-ap',
  'Theo dõi huyết áp tại nhà',
  'Cách ghi nhận huyết áp đơn giản để mang theo khi gặp nhân viên y tế.',
  'kham-phong-benh',
  'health',
  'Sống An 40+ Biên tập giáo dục',
  '2026-01-15',
  '2026-07-01',
  'active',
  4,
  '# Theo dõi huyết áp tại nhà

Đây là bài học giáo dục, không phải chẩn đoán.

## Việc nên làm
- Đo khi đang nghỉ ngơi, ngồi thẳng.
- Ghi ngày, chỉ số và cảm giác lúc đo.
- Mang sổ ghi khi đi khám.

## Khi nào nên gặp chuyên gia
Nếu huyết áp cao kéo dài hoặc có triệu chứng nặng (đau ngực dữ dội, khó thở nặng), hãy tìm hỗ trợ y tế. Ứng dụng này không đánh giá cấp cứu.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_walk_001',
  'van-dong-trung-nien',
  'Vận động nhẹ ở tuổi trung niên',
  'Gợi ý đi bộ đều đặn với cường độ phù hợp.',
  'suc-khoe-trung-nien',
  'health',
  'Sống An 40+ Biên tập giáo dục',
  '2026-01-15',
  '2026-07-01',
  'active',
  3,
  '# Vận động nhẹ ở tuổi trung niên

Bắt đầu với mức bạn chịu được. Đi bộ 20 phút, 3 ngày mỗi tuần là một mục tiêu thực tế.

Nếu đang có bệnh nền, hãy hỏi ý kiến nhân viên y tế trước khi tăng cường độ.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_check_001',
  'kham-dinh-ky',
  'Vì sao nên khám định kỳ',
  'Khám định kỳ giúp theo dõi sức khỏe theo thời gian.',
  'kham-phong-benh',
  'health',
  'Sống An 40+ Biên tập giáo dục',
  '2026-02-01',
  '2026-07-01',
  'active',
  3,
  '# Vì sao nên khám định kỳ

Khám định kỳ không thay thế việc đến cơ sở y tế khi có triệu chứng bất thường. Mục tiêu là theo dõi các chỉ số cơ bản và trao đổi với nhân viên y tế.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_fund_001',
  'quy-du-phong',
  'Quỹ dự phòng cơ bản',
  'Cách nghĩ về quỹ dự phòng theo tháng chi phí thiết yếu.',
  'chuan-bi-tai-chinh',
  'finance',
  'Sống An 40+ Biên tập giáo dục',
  '2026-02-10',
  '2026-07-01',
  'active',
  4,
  '# Quỹ dự phòng cơ bản

Đây là thông tin giáo dục, không phải tư vấn đầu tư.

1. Ước lượng chi phí thiết yếu mỗi tháng.
2. Đặt mục tiêu nhỏ, đều đặn.
3. Tách khoản dự phòng nếu có thể.

Không dùng tiền cần thiết cho sinh hoạt hàng ngày để mạo hiểm.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_expense_001',
  'chi-phi-ve-huu',
  'Ước lượng chi phí khi về hưu',
  'Liệt kê các khoản thiết yếu để hình dung nhu cầu tương lai.',
  'chuan-bi-tai-chinh',
  'finance',
  'Sống An 40+ Biên tập giáo dục',
  '2026-02-10',
  '2026-07-01',
  'active',
  4,
  '# Ước lượng chi phí khi về hưu

Ghi các nhóm: ăn uống, nhà ở, thuốc men, đi lại, hỗ trợ gia đình. Con số mang tính định hướng, không phải dự báo chính xác.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_docs_001',
  'giay-to-tuoi-gia',
  'Sắp xếp giấy tờ quan trọng',
  'Gợi ý lưu trữ CCCD, bảo hiểm và giấy tờ nhà ở nơi dễ tìm.',
  'nha-o-giay-to',
  'finance',
  'Sống An 40+ Biên tập giáo dục',
  '2026-03-01',
  '2026-07-01',
  'active',
  3,
  '# Sắp xếp giấy tờ quan trọng

Tạo một bộ giấy tờ gồm giấy tùy thân, thông tin bảo hiểm và giấy tờ nhà. Cho một người thân tin cậy biết vị trí lưu. Đây không phải tư vấn pháp lý.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_fall_001',
  'phong-nga',
  'Phòng ngã tại nhà',
  'Các thay đổi nhỏ giúp giảm nguy cơ ngã.',
  'cham-soc-cha-me',
  'caregiving',
  'Sống An 40+ Biên tập giáo dục',
  '2026-03-05',
  '2026-07-01',
  'active',
  4,
  '# Phòng ngã tại nhà

- Giữ lối đi thông thoáng.
- Tăng ánh sáng ở cầu thang và phòng tắm.
- Dùng thảm chống trượt nếu sàn ướt.

Nếu người thân bị ngã và không đứng dậy được, hoặc có chấn thương nặng, hãy gọi hỗ trợ y tế.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_contact_001',
  'lien-he-khan-cap',
  'Danh sách liên hệ khẩn cấp',
  'Tạo và chia sẻ danh sách số điện thoại quan trọng.',
  'cham-soc-cha-me',
  'caregiving',
  'Sống An 40+ Biên tập giáo dục',
  '2026-03-05',
  '2026-07-01',
  'active',
  2,
  '# Danh sách liên hệ khẩn cấp

Ghi 3–5 số: người thân, hàng xóm tin cậy, cơ sở y tế gần nhà. Để ở nơi dễ thấy và lưu trong điện thoại.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_family_001',
  'trao-doi-gia-dinh',
  'Trao đổi mong muốn với gia đình',
  'Gợi ý cuộc nói chuyện ngắn về hỗ trợ khi cần.',
  'nha-o-giay-to',
  'caregiving',
  'Sống An 40+ Biên tập giáo dục',
  '2026-03-12',
  '2026-07-01',
  'active',
  3,
  '# Trao đổi mong muốn với gia đình

Chọn một người thân và nói về: ai sẽ được gọi trước, giấy tờ để ở đâu, và mong muốn được hỗ trợ như thế nào. Giữ cuộc trò chuyện ngắn, rõ ràng.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_meds_001',
  'danh-sach-thuoc',
  'Lập danh sách thuốc đang dùng',
  'Ghi tên thuốc và liều để mang theo khi khám.',
  'kham-phong-benh',
  'health',
  'Sống An 40+ Biên tập giáo dục',
  '2026-03-20',
  '2026-07-01',
  'active',
  2,
  '# Lập danh sách thuốc đang dùng

Ghi tên thuốc, liều, và bác sĩ kê đơn nếu có. Không tự ý thay đổi thuốc dựa trên thông tin trong ứng dụng.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_sleep_001',
  'giac-ngu',
  'Giữ giờ ngủ ổn định',
  'Thói quen nhỏ giúp giấc ngủ đều hơn.',
  'tri-nho-tinh-than',
  'health',
  'Sống An 40+ Biên tập giáo dục',
  '2026-04-01',
  '2026-07-01',
  'active',
  2,
  '# Giữ giờ ngủ ổn định

Chọn giờ đi ngủ và thức dậy tương đối cố định trong vài ngày. Giảm ánh sáng mạnh trước khi ngủ nếu có thể.',
  datetime('now'),
  datetime('now')
),
(
  'lesson_income_001',
  'nguon-thu',
  'Liệt kê nguồn thu nhập dự kiến',
  'Nhìn rõ các nguồn thu để chủ động hơn.',
  'chuan-bi-tai-chinh',
  'finance',
  'Sống An 40+ Biên tập giáo dục',
  '2026-04-01',
  '2026-07-01',
  'active',
  3,
  '# Liệt kê nguồn thu nhập dự kiến

Liệt kê những gì bạn biết: lương hưu, tiết kiệm, hỗ trợ gia đình. Đây là bài tập tự theo dõi, không phải khuyến nghị đầu tư.',
  datetime('now'),
  datetime('now')
);

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
