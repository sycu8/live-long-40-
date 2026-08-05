/** Homepage copy for VivaAge — structured marketing sections. */

export const LANDING_HERO = {
  headline: "Chủ động từ tuổi 40, sống khỏe và tự chủ về sau",
  body: "VivaAge giúp bạn hiểu rõ những gì cần chuẩn bị cho tương lai, từ sức khỏe, tài chính đến kỹ năng chăm sóc bản thân và gia đình.",
  bodySecondary:
    "Nhận câu trả lời rõ ràng từ AI, kiểm tra mức độ sẵn sàng và bắt đầu bằng những hành động nhỏ, phù hợp với cuộc sống của bạn.",
  primaryCta: "Kiểm tra mức độ sẵn sàng",
  secondaryCta: "Hỏi VivaAge",
  note: "Không cần đăng ký để bắt đầu.",
} as const;

export const LANDING_NAME_STORY = {
  title: "Vì sao tên VivaAge?",
  viva: "“Viva” gợi sức sống, tích cực, không nhấn mạnh sự già yếu.",
  age: "“Age” thể hiện đúng lĩnh vực tuổi tác và healthy aging.",
  tagline: "VivaAge - Chuẩn bị hôm nay, tự chủ về sau",
} as const;

export const LANDING_AGE40 = {
  title: "Tuổi 40 không phải là lúc bắt đầu già",
  lead: "Đây là thời điểm phù hợp để chuẩn bị sớm hơn cho một cuộc sống khỏe mạnh, độc lập và ít phụ thuộc hơn trong tương lai.",
  intro: "Nhưng phần lớn chúng ta vẫn chưa biết:",
  questions: [
    "Nên kiểm tra sức khỏe gì từ tuổi 40?",
    "Cần chuẩn bị tài chính như thế nào?",
    "Làm sao chăm sóc cha mẹ đúng cách?",
    "Nhà ở và giấy tờ cần chuẩn bị những gì?",
    "Thông tin nào thực sự đáng tin?",
  ],
  close:
    "VivaAge giúp bạn tìm câu trả lời và chuyển kiến thức thành kế hoạch có thể thực hiện.",
} as const;

export const LANDING_PILLARS = [
  {
    id: "health",
    title: "Sức khỏe chủ động",
    body: "Hiểu những thói quen, kiểm tra sức khỏe và hoạt động phòng ngừa phù hợp với từng giai đoạn tuổi.",
    pointsIntro: "VivaAge hỗ trợ bạn:",
    points: [
      "Xem lại mức độ sẵn sàng về sức khỏe.",
      "Theo dõi những việc quan trọng cần thực hiện.",
      "Tìm hiểu thông tin sức khỏe bằng ngôn ngữ dễ hiểu.",
      "Chuẩn bị câu hỏi trước khi gặp nhân viên y tế.",
    ],
    cta: "Khám phá sức khỏe tuổi 40+",
    to: "/thu-vien?category=suc-khoe-trung-nien",
  },
  {
    id: "finance",
    title: "Tài chính vững vàng",
    body: "Chuẩn bị tài chính không chỉ là tiết kiệm cho nghỉ hưu. Đó còn là khả năng ứng phó với chi phí y tế, chăm sóc dài hạn và những thay đổi trong thu nhập.",
    pointsIntro: "VivaAge giúp bạn:",
    points: [
      "Ước tính nhu cầu chi tiêu trong tương lai.",
      "Kiểm tra mức độ sẵn sàng của quỹ dự phòng.",
      "Xây dựng danh sách việc cần chuẩn bị.",
      "Hiểu các khái niệm tài chính bằng cách trình bày đơn giản.",
    ],
    note: "VivaAge cung cấp kiến thức và công cụ lập kế hoạch, không đưa ra khuyến nghị đầu tư cá nhân.",
    cta: "Kiểm tra mức độ sẵn sàng tài chính",
    to: "/danh-gia",
  },
  {
    id: "caregiving",
    title: "Kỹ năng chăm sóc",
    body: "Khi cha mẹ lớn tuổi, gia đình thường phải đưa ra nhiều quyết định trong thời gian ngắn.",
    pointsIntro: "VivaAge cung cấp các hướng dẫn dễ thực hiện về:",
    points: [
      "Phòng ngừa té ngã trong nhà.",
      "Chuẩn bị danh sách thuốc và thông tin sức khỏe.",
      "Hỗ trợ người lớn tuổi trong sinh hoạt.",
      "Tổ chức lịch khám và trách nhiệm gia đình.",
      "Nhận biết khi nào cần tìm hỗ trợ chuyên môn.",
    ],
    cta: "Tìm hiểu kỹ năng chăm sóc",
    to: "/thu-vien?category=cham-soc-cha-me",
  },
] as const;

export const LANDING_ASK = {
  title: "Hỏi VivaAge",
  subtitle: "Câu trả lời rõ ràng, có nguồn và có hành động tiếp theo",
  lead: "Bạn không cần đọc hàng chục tài liệu dài để tìm một câu trả lời đơn giản.",
  prompt: "Hãy đặt câu hỏi bằng cách bạn vẫn thường nói:",
  examples: [
    "Từ tuổi 40 nên kiểm tra sức khỏe gì?",
    "Tôi cần chuẩn bị bao nhiêu tháng chi phí dự phòng?",
    "Nhà có người lớn tuổi thì cần thay đổi những gì?",
    "Cha mẹ hay quên thì gia đình nên bắt đầu từ đâu?",
    "Làm sao phân chia việc chăm sóc giữa các anh chị em?",
  ],
  structureIntro:
    "VivaAge tìm kiếm trong kho kiến thức đã được chọn lọc và trình bày câu trả lời theo cấu trúc:",
  structure: [
    "Câu trả lời trực tiếp.",
    "Việc bạn có thể làm tiếp theo.",
    "Trường hợp nên tìm hỗ trợ chuyên môn.",
    "Nguồn thông tin tham khảo.",
  ],
  cta: "Đặt câu hỏi cho VivaAge",
  disclaimer:
    "VivaAge không chẩn đoán bệnh, không kê đơn và không thay thế nhân viên y tế hoặc chuyên gia tài chính.",
} as const;

export const LANDING_READINESS = {
  title: "Biết mình đang ở đâu",
  subtitle: "Kiểm tra mức độ sẵn sàng trong khoảng 7 phút",
  lead: "Trả lời một số câu hỏi về sức khỏe, tài chính và kỹ năng chăm sóc.",
  after: "Sau khi hoàn thành, bạn sẽ nhận được:",
  outcomes: [
    "Hồ sơ chuẩn bị cá nhân.",
    "Ba điểm đánh giá theo từng nhóm.",
    "Những điểm bạn đang làm tốt.",
    "Những nội dung cần ưu tiên.",
    "Kế hoạch hành động trong 30 ngày.",
  ],
  note: "Đây là điểm đánh giá mức độ chuẩn bị, không phải chẩn đoán sức khỏe hoặc dự đoán tuổi thọ.",
  cta: "Bắt đầu kiểm tra",
} as const;

export const LANDING_PLAN = {
  title: "Một kế hoạch đơn giản, không tạo thêm áp lực",
  lead: "VivaAge không yêu cầu bạn thay đổi mọi thứ cùng lúc.",
  intro:
    "Mỗi tuần, bạn chỉ cần tập trung vào hai hoặc ba hành động phù hợp, chẳng hạn:",
  examples: [
    "Ghi lại lần gần nhất kiểm tra huyết áp.",
    "Hoàn thành một bài học phòng ngừa té ngã.",
    "Ước tính chi phí thiết yếu mỗi tháng.",
    "Tạo danh sách liên hệ khẩn cấp.",
    "Trao đổi với gia đình về việc chăm sóc cha mẹ.",
    "Kiểm tra mức độ an toàn của nhà ở.",
  ],
  close:
    "Bạn có thể theo dõi tiến độ và điều chỉnh kế hoạch theo nhu cầu thực tế.",
  cta: "Xem kế hoạch mẫu",
} as const;

export const LANDING_TRUST = {
  title: "Kiến thức dễ hiểu, nguồn thông tin minh bạch",
  lead: "Mỗi nội dung trong VivaAge được tổ chức để bạn dễ kiểm tra:",
  points: [
    "Tổ chức hoặc đơn vị ban hành.",
    "Ngày công bố.",
    "Thời điểm cập nhật gần nhất.",
    "Tình trạng văn bản hoặc tài liệu.",
    "Nguồn được sử dụng trong câu trả lời.",
  ],
  close:
    "Khi chưa có đủ thông tin đáng tin cậy, VivaAge sẽ nói rõ thay vì tự tạo câu trả lời.",
} as const;

export const LANDING_PATHS = {
  title: "Bắt đầu từ điều quan trọng nhất với bạn",
  items: [
    {
      title: "Tôi muốn chuẩn bị cho bản thân",
      body: "Kiểm tra mức độ sẵn sàng và nhận kế hoạch phù hợp với giai đoạn hiện tại.",
      cta: "Kiểm tra ngay",
      to: "/danh-gia",
    },
    {
      title: "Tôi đang chăm sóc cha mẹ",
      body: "Tìm hướng dẫn thực tế về sức khỏe, an toàn trong nhà và phối hợp giữa các thành viên.",
      cta: "Tìm hướng dẫn chăm sóc",
      to: "/thu-vien?category=cham-soc-cha-me",
    },
    {
      title: "Tôi có một câu hỏi cụ thể",
      body: "Đặt câu hỏi và nhận câu trả lời ngắn gọn, có nguồn.",
      cta: "Hỏi VivaAge",
      to: "/hoi",
    },
  ],
} as const;

export const LANDING_FAQ = [
  {
    q: "VivaAge dành cho ai?",
    a: "VivaAge phù hợp với người từ khoảng 40 tuổi muốn chuẩn bị sớm cho sức khỏe, tài chính và cuộc sống về sau. Nền tảng cũng hữu ích cho người đang hỗ trợ hoặc chăm sóc cha mẹ lớn tuổi.",
  },
  {
    q: "Tôi có cần tạo tài khoản không?",
    a: "Bạn có thể đặt câu hỏi và thực hiện bài kiểm tra cơ bản mà không cần tạo tài khoản. Tài khoản chỉ cần thiết khi bạn muốn lưu kế hoạch và theo dõi tiến độ lâu dài.",
  },
  {
    q: "Câu trả lời của AI có đáng tin không?",
    a: "VivaAge ưu tiên trả lời dựa trên kho tài liệu đã được lựa chọn và hiển thị nguồn hỗ trợ. Khi không tìm thấy đủ nguồn phù hợp, hệ thống sẽ thông báo rõ.",
  },
  {
    q: "VivaAge có thay thế bác sĩ không?",
    a: "Không. VivaAge cung cấp thông tin giáo dục và công cụ chuẩn bị. Nền tảng không chẩn đoán bệnh, kê đơn hoặc thay thế việc khám và tư vấn chuyên môn.",
  },
  {
    q: "VivaAge có tư vấn đầu tư không?",
    a: "Không. Các công cụ tài chính của VivaAge giúp người dùng hiểu nhu cầu, lập kế hoạch và nhận diện khoảng trống chuẩn bị. Nền tảng không đề xuất sản phẩm đầu tư hoặc cam kết kết quả tài chính.",
  },
  {
    q: "Thông tin của tôi được sử dụng như thế nào?",
    a: "VivaAge chỉ thu thập những dữ liệu cần thiết để cung cấp chức năng người dùng lựa chọn. Các thông tin riêng tư không được công khai hoặc sử dụng để tạo câu trả lời cho người khác.",
  },
] as const;

export const LANDING_CLOSING = {
  title: "Tương lai tự chủ bắt đầu từ một bước nhỏ hôm nay",
  body: "Hiểu rõ mức độ sẵn sàng của bạn và nhận những hành động đầu tiên phù hợp với cuộc sống hiện tại.",
  primaryCta: "Kiểm tra mức độ sẵn sàng",
  secondaryCta: "Hỏi VivaAge một câu hỏi",
  disclaimer:
    "VivaAge cung cấp nội dung giáo dục và hỗ trợ lập kế hoạch. Thông tin trên nền tảng không thay thế chẩn đoán, điều trị, tư vấn tài chính hoặc tư vấn pháp lý từ người có chuyên môn.",
} as const;
