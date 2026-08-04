import type { QuestionClassification } from "../constants/product";

/** Curated educational answer with attached citation snippets. */
export type AnswerBankSource = {
  title: string;
  issuer: string;
  publicationDate: string;
  snippet: string;
};

export type AnswerBankEntry = {
  id: string;
  /** Canonical question shown in product examples */
  question: string;
  classification: QuestionClassification;
  /** Folded aliases / phrases for matching (no diacritics, lowercase) */
  aliases: string[];
  sources: AnswerBankSource[];
  /** Detailed Vietnamese answer; use [S1], [S2], … matching sources order */
  answer: string;
};

/**
 * Prepared detailed answers for common Sống An 40+ questions.
 * These are served first (and written into KV cache) so replies stay stable.
 */
export const ANSWER_BANK: AnswerBankEntry[] = [
  {
    id: "health-check-40",
    question: "Từ tuổi 40 tôi nên kiểm tra sức khỏe gì?",
    classification: "health_education",
    aliases: [
      "tu tuoi 40 toi nen kiem tra suc khoe gi",
      "tuoi 40 kiem tra suc khoe",
      "kham suc khoe dinh ky tuoi 40",
      "kham dinh ky tu tuoi 40",
      "nen kiem tra suc khoe gi o tuoi 40",
      "tuoi 40 nen kham gi",
    ],
    sources: [
      {
        title: "Khám sức khỏe định kỳ từ tuổi 40 (giáo dục)",
        issuer: "Sống An 40+ Biên tập giáo dục",
        publicationDate: "2026-04-01",
        snippet:
          "Từ tuổi 40, nên chủ động khám định kỳ và trao đổi với nhân viên y tế về huyết áp, đường huyết, cholesterol, cân nặng và lối sống.",
      },
      {
        title: "Theo dõi huyết áp tại nhà",
        issuer: "Sống An 40+ Biên tập giáo dục",
        publicationDate: "2026-01-15",
        snippet:
          "Đo khi đang nghỉ ngơi, ngồi thẳng; ghi ngày, chỉ số và cảm giác; mang sổ khi đi khám.",
      },
    ],
    answer: `Từ tuổi 40, bước hữu ích nhất là **chủ động khám định kỳ** và chuẩn bị sẵn câu hỏi để trao đổi với nhân viên y tế — không phải tự chẩn đoán ở nhà. [S1]

**Thường được nhắc đến khi đi khám**
- Huyết áp, cân nặng, vòng eo
- Đường huyết / rối loạn chuyển hóa (theo chỉ định chuyên môn)
- Cholesterol và các yếu tố nguy cơ tim mạch (theo chỉ định)
- Thị lực, thính lực, sức khỏe răng miệng nếu có thay đổi
- Thói quen ngủ, vận động, thuốc đang dùng, tiền sử gia đình

**Việc bạn có thể làm tuần này**
1. Đặt lịch khám định kỳ hoặc hỏi nhân viên y tế gần nhất về lịch phù hợp với bạn. [S1]
2. Chuẩn bị sổ nhỏ: thuốc đang uống, triệu chứng gần đây, câu hỏi muốn hỏi.
3. Nếu đã có máy đo huyết áp, tập đo đúng cách và ghi lại vài ngày trước khi đi khám. [S2]

**Khi nào nên đi khám sớm hơn**
Đau ngực dữ dội, khó thở nặng, yếu nửa người, nói khó, hoặc các dấu hiệu bất thường kéo dài — hãy tìm hỗ trợ y tế, không chờ đến lịch định kỳ.

Đây là hướng dẫn giáo dục để bạn chuẩn bị cuộc nói chuyện với chuyên gia, **không phải** danh sách xét nghiệm bắt buộc hay chẩn đoán.`,
  },
  {
    id: "emergency-fund",
    question: "Tôi nên chuẩn bị quỹ dự phòng thế nào?",
    classification: "financial_education",
    aliases: [
      "toi nen chuan bi quy du phong the nao",
      "quy du phong la gi",
      "quy du phong",
      "chuan bi quy du phong",
      "lam quy du phong the nao",
      "quy khan cap",
      "tien du phong",
    ],
    sources: [
      {
        title: "Giáo dục về quỹ dự phòng",
        issuer: "Sống An 40+ Biên tập giáo dục",
        publicationDate: "2026-02-10",
        snippet:
          "Quỹ dự phòng giúp chi trả các việc đột xuất. Ước lượng chi phí thiết yếu mỗi tháng, rồi đặt mục tiêu nhỏ và đều đặn. Đây không phải tư vấn đầu tư.",
      },
      {
        title: "Quỹ dự phòng cơ bản",
        issuer: "Sống An 40+ Biên tập giáo dục",
        publicationDate: "2026-01-15",
        snippet:
          "Ước lượng chi phí thiết yếu mỗi tháng. Đặt mục tiêu nhỏ và đều đặn. Tách khoản này khỏi chi tiêu hàng ngày nếu có thể.",
      },
    ],
    answer: `Quỹ dự phòng là khoản tiền để chi khi có việc đột xuất, giúp bạn **ít phải vay nóng**. Đây là thói quen chuẩn bị, không phải sản phẩm đầu tư. [S1]

**Cách bắt đầu vừa sức**
1. Ước lượng chi phí thiết yếu mỗi tháng (ăn ở, điện nước, đi lại, thuốc men cơ bản). [S1][S2]
2. Chọn mục tiêu nhỏ trước — ví dụ 1 tháng chi phí thiết yếu — rồi tăng dần khi ổn định.
3. Để riêng một chỗ (tài khoản/ví tách) và chuyển đều đặn số vừa với thu nhập. [S2]
4. Ghi lại mỗi lần dùng quỹ: việc gì, bao nhiêu, kế hoạch hoàn trả.

**Nguyên tắc giữ bình tĩnh**
- Đều đặn thắng số lớn một lần rồi bỏ dở.
- Không lấy quỹ dự phòng để “lướt” đầu tư hay chi tiêu không cần thiết.
- Khi thu nhập thay đổi, chỉ cần chỉnh mức đóng — không cần đổ hết kế hoạch.

**Giới hạn rõ**
Sống An 40+ **không** khuyến nghị bạn mua sản phẩm tài chính cụ thể, không tư vấn đầu tư hay bảo hiểm cá nhân hóa. Nếu cần chọn sản phẩm, hãy hỏi chuyên gia tài chính có giấy phép.

Bước tiếp theo hôm nay: viết ra chi phí thiết yếu 1 tháng và mức bạn có thể để dành mỗi tuần mà không làm căng ngân sách.`,
  },
  {
    id: "parent-fall",
    question: "Làm gì khi cha mẹ bị ngã?",
    classification: "caregiving",
    aliases: [
      "lam gi khi cha me bi nga",
      "cha me bi nga",
      "khi nguoi than bi nga",
      "xu ly khi bi nga",
      "phong nga tai nha",
      "nguoi cao tuoi bi nga",
    ],
    sources: [
      {
        title: "Hướng dẫn giáo dục về phòng ngã tại nhà",
        issuer: "Sống An 40+ Biên tập giáo dục",
        publicationDate: "2026-03-05",
        snippet:
          "Nếu có người bị ngã: kiểm tra tỉnh táo; không đỡ dậy mạnh nếu nghi chấn thương nặng; gọi hỗ trợ y tế khi không đứng dậy được hoặc đau nhiều.",
      },
      {
        title: "Phòng ngã tại nhà",
        issuer: "Sống An 40+ Biên tập giáo dục",
        publicationDate: "2026-03-05",
        snippet:
          "Khi người cao tuổi đi lại trong nhà, hãy giữ lối đi thông thoáng và đủ ánh sáng.",
      },
    ],
    answer: `Khi cha mẹ (hoặc người thân lớn tuổi) bị ngã, ưu tiên **an toàn và đánh giá nhanh**, không vội đỡ dậy bằng mọi giá. [S1]

**Ngay tại chỗ**
1. Giữ bình tĩnh, nói chuyện nhẹ để xem họ có tỉnh táo, trả lời được không. [S1]
2. Quan sát đau nhiều ở đâu, có biến dạng xương/khớp, chảy máu, khó thở không.
3. **Không kéo hoặc đỡ dậy mạnh** nếu nghi ngờ chấn thương nặng. [S1]
4. Gọi hỗ trợ y tế khi họ không đứng dậy được, đau nhiều, đầu va đập, lẫn lộn, hoặc bạn không chắc. [S1]

**Nếu họ ổn hơn và đứng dậy được với hỗ trợ an toàn**
- Cho ngồi nghỉ, theo dõi vài giờ.
- Ghi lại hoàn cảnh ngã (trơn, tối, chóng mặt, thuốc mới…).
- Hẹn nhân viên y tế để kiểm tra nếu người cao tuổi hoặc có bệnh nền.

**Phòng ngã về sau (việc nhỏ tuần này)**
- Lối đi thông thoáng, đủ ánh sáng; gọn dây điện, thảm trơn. [S2]
- Giày dép chống trượt; để đồ hay dùng trong tầm với.
- Thảo luận với gia đình về người gọi khi khẩn cấp.

Đây là hướng dẫn giáo dục, **không thay** cấp cứu hay chỉ định điều trị. Nếu tình huống nghiêm trọng, hãy gọi dịch vụ cấp cứu địa phương ngay.`,
  },
  {
    id: "aging-documents",
    question: "Cần chuẩn bị giấy tờ nào cho tuổi già?",
    classification: "financial_education",
    aliases: [
      "can chuan bi giay to nao cho tuoi gia",
      "giay to tuoi gia",
      "chuan bi giay to",
      "giay to quan trong",
      "sap xep giay to",
      "ho so tuoi gia",
    ],
    sources: [
      {
        title: "Chuẩn bị giấy tờ quan trọng cho tuổi già (giáo dục)",
        issuer: "Sống An 40+ Biên tập giáo dục",
        publicationDate: "2026-04-01",
        snippet:
          "Chuẩn bị giấy tờ cho tuổi già: giấy tùy thân, bảo hiểm, giấy tờ nhà đất và liên hệ khẩn cấp. Gom bản gốc và bản sao; cho người thân tin cậy biết vị trí lưu.",
      },
      {
        title: "Sắp xếp giấy tờ quan trọng",
        issuer: "Sống An 40+ Biên tập giáo dục",
        publicationDate: "2026-03-01",
        snippet:
          "Gom giấy tùy thân, bảo hiểm và giấy tờ nhà. Cho người thân tin cậy biết vị trí lưu.",
      },
    ],
    answer: `Chuẩn bị giấy tờ cho tuổi già là việc **gom – tách bản sao – cho người tin cậy biết chỗ lưu**, để khi cần không phải tìm cuống cuồng. [S1]

**Nhóm giấy thường cần rà soát**
- Giấy tùy thân (CCCD/CMND còn hạn, hộ chiếu nếu có)
- Bảo hiểm y tế / các giấy tờ bảo hiểm đang tham gia [S1][S2]
- Giấy tờ nhà ở, đất đai, hợp đồng thuê (nếu có) [S1]
- Sổ/ghi chú thuốc đang dùng, tiền sử bệnh, dị ứng
- Danh bạ liên hệ khẩn cấp (con cái, hàng xóm, phòng khám)

**Cách làm gọn trong 1–2 buổi**
1. Gom bản gốc vào một hộp/file; bản sao để riêng. [S1]
2. Dán nhãn ngoài: “Tùy thân”, “Bảo hiểm”, “Nhà cửa”, “Y tế”.
3. Viết một tờ hướng dẫn ngắn: hộp để đâu, ai được mở khi khẩn cấp. [S2]
4. Rà soát lại mỗi 6–12 tháng hoặc khi có thay đổi lớn.

**Giới hạn**
Sống An 40+ **không** soạn thảo di chúc, ủy quyền hay tư vấn pháp lý cá nhân hóa. Nếu cần giấy tờ có giá trị pháp lý, hãy gặp đơn vị có thẩm quyền hoặc luật sư.

Bước tiếp theo hôm nay: chọn một ngăn kéo/hộp và bỏ vào ít nhất giấy tùy thân + thẻ BHYT + một số liên hệ khẩn cấp.`,
  },
  {
    id: "blood-pressure-home",
    question: "Theo dõi huyết áp tại nhà thế nào?",
    classification: "health_education",
    aliases: [
      "theo doi huyet ap tai nha",
      "do huyet ap",
      "huyet ap tai nha",
      "cach do huyet ap",
      "theo doi huyet ap",
    ],
    sources: [
      {
        title: "Theo dõi huyết áp tại nhà",
        issuer: "Sống An 40+ Biên tập giáo dục",
        publicationDate: "2026-01-15",
        snippet:
          "Đo khi đang nghỉ ngơi, ngồi thẳng; ghi ngày, chỉ số và cảm giác; mang sổ khi đi khám. Không tự ý thay đổi thuốc.",
      },
    ],
    answer: `Theo dõi huyết áp tại nhà giúp bạn có **sổ số liệu thật** để mang đi khám — không phải để tự kê đơn. [S1]

**Cách đo gọn**
- Nghỉ 5 phút, ngồi thẳng, chân chạm sàn, tay đặt trên bàn.
- Đo cùng khung giờ vài ngày; ghi ngày, chỉ số, cảm giác lúc đo. [S1]
- Mang sổ này khi gặp nhân viên y tế.

**Không làm**
- Không tự ý tăng/giảm hoặc ngưng thuốc huyết áp dựa trên một lần đo. [S1]
- Không bỏ qua triệu chứng nặng (đau ngực dữ dội, khó thở nặng, yếu nửa người).

Nếu số đo thường xuyên cao hoặc bạn lo lắng, hãy hẹn trao đổi với nhân viên y tế thay vì tự kết luận.`,
  },
  {
    id: "sleep-habit",
    question: "Làm sao để ngủ ngon hơn ở tuổi trung niên?",
    classification: "health_education",
    aliases: [
      "lam sao de ngu ngon",
      "ngu ngon tuoi trung nien",
      "giu gio ngu",
      "mat ngu",
      "thieu ngu",
      "ngu la suc manh",
    ],
    sources: [
      {
        title: "Giữ giờ ngủ ổn định",
        issuer: "Sống An 40+ Biên tập giáo dục",
        publicationDate: "2026-03-01",
        snippet:
          "Chọn giờ đi ngủ và thức dậy tương đối cố định. Giảm ánh sáng mạnh trước khi ngủ nếu có thể.",
      },
    ],
    answer: `Ở tuổi trung niên, ngủ đều thường giúp tinh thần và sức bền ổn định hơn là “ngủ bù” thất thường. [S1]

**Việc nhỏ có thể thử 7 ngày**
1. Chọn giờ đi ngủ và giờ thức dậy gần cố định, kể cả cuối tuần. [S1]
2. Giảm ánh sáng mạnh / màn hình sáng 30–60 phút trước ngủ nếu hoàn cảnh cho phép. [S1]
3. Tránh biến giường thành chỗ làm việc hoặc xem nội dung kích thích.
4. Ghi lại 3 đêm: ngủ lúc mấy giờ, tỉnh mấy lần, tỉnh táo ban ngày ra sao — mang theo nếu đi khám.

Nếu mất ngủ kéo dài, ngủ ngày vẫn mệt, hoặc có ngáy nặng/nghỉ thở khi ngủ, hãy hỏi nhân viên y tế. Đây là gợi ý lối sống giáo dục, không phải điều trị rối loạn giấc ngủ.`,
  },
];
