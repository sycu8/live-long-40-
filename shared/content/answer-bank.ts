import type { QuestionClassification } from "../constants/product";
import { officialSourceById } from "./official-sources";

/** Curated educational answer with attached official citation snippets. */
export type AnswerBankSource = {
  title: string;
  issuer: string;
  publicationDate: string;
  url: string;
  trustTier: "official_vn" | "intl_guideline";
  snippet: string;
  /** Registry id when mapped from OFFICIAL_SOURCES */
  officialSourceId?: string;
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

function cite(
  officialId: string,
  snippetOverride?: string,
): AnswerBankSource {
  const ref = officialSourceById(officialId);
  if (!ref) {
    throw new Error(`Missing official source registry id: ${officialId}`);
  }
  return {
    title: ref.title,
    issuer: ref.issuer,
    publicationDate: ref.publicationDate,
    url: ref.url,
    trustTier: ref.trustTier,
    snippet: snippetOverride ?? ref.snippet,
    officialSourceId: ref.id,
  };
}

/**
 * Prepared detailed answers for common Sống An 40+ questions.
 * Every citation must map to an official / WHO (or equivalent) source with URL.
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
      cite(
        "who-ageing",
        "WHO nhấn mạnh già hóa khỏe mạnh gắn với dự phòng bệnh mạn tính và tiếp cận dịch vụ y tế; chuẩn bị sớm từ trung niên giúp duy trì chức năng lâu hơn.",
      ),
      cite(
        "who-hypertension",
        "WHO khuyến cáo đo và theo dõi huyết áp; tăng huyết áp là yếu tố nguy cơ tim mạch quan trọng cần quản lý theo hướng dẫn chuyên môn.",
      ),
      cite(
        "byt-portal",
        "Bộ Y tế công bố thông tin y tế công cộng chính thống; người dân nên dùng kênh chính thức và hỏi cơ sở y tế về lịch khám phù hợp.",
      ),
    ],
    answer: `Từ tuổi 40, bước hữu ích nhất là **chủ động khám định kỳ** và chuẩn bị câu hỏi để trao đổi với nhân viên y tế — không tự chẩn đoán ở nhà. [S1][S3]

**Thường được nhắc khi đi khám / theo dõi**
- Huyết áp và các yếu tố nguy cơ tim mạch (theo chỉ định chuyên môn) [S2]
- Đường huyết / rối loạn chuyển hóa (theo chỉ định)
- Cân nặng, lối sống, thuốc đang dùng, tiền sử gia đình
- Thị lực, thính lực, răng miệng nếu có thay đổi

**Việc bạn có thể làm tuần này**
1. Đặt lịch khám hoặc hỏi cơ sở y tế gần nhất về lịch phù hợp. [S3]
2. Chuẩn bị sổ: thuốc, triệu chứng, câu hỏi muốn hỏi.
3. Nếu đã có máy đo huyết áp, đo đúng cách và ghi vài ngày trước khám. [S2]

**Khi nào nên đi khám sớm hơn**
Đau ngực dữ dội, khó thở nặng, yếu nửa người, nói khó — tìm hỗ trợ y tế, không chờ lịch định kỳ.

Đây là hướng dẫn giáo dục dựa trên nguồn chính thống, **không phải** danh sách xét nghiệm bắt buộc hay chẩn đoán.`,
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
      cite(
        "sbv-portal",
        "NHNN là nguồn chính sách/ngân hàng chính thống; thói quen tiết kiệm và dự phòng thuộc giáo dục tài chính cá nhân, không phải khuyến nghị sản phẩm đầu tư cụ thể.",
      ),
      cite(
        "bhxh-portal",
        "BHXH Việt Nam công bố thông tin chính thức về quyền lợi bảo hiểm; quỹ dự phòng gia đình bổ sung cho các chi đột xuất ngoài quyền lợi bảo hiểm.",
      ),
    ],
    answer: `Quỹ dự phòng là khoản để chi khi có việc đột xuất, giúp bạn **ít phải vay nóng**. Đây là thói quen chuẩn bị, không phải sản phẩm đầu tư. [S1]

**Cách bắt đầu vừa sức**
1. Ước lượng chi phí thiết yếu mỗi tháng (ăn ở, điện nước, đi lại, thuốc men cơ bản). [S1]
2. Chọn mục tiêu nhỏ trước — ví dụ khoảng 1 tháng chi phí thiết yếu — rồi tăng dần.
3. Để riêng một chỗ và chuyển đều đặn số vừa với thu nhập.
4. Rà soát thêm quyền lợi bảo hiểm (BHYT/BHXH) trên kênh chính thống để biết phần nào đã được bảo vệ. [S2]

**Nguyên tắc**
- Đều đặn thắng số lớn một lần rồi bỏ dở.
- Không lấy quỹ dự phòng để đầu cơ hay chi tiêu không cần thiết.

**Giới hạn**
Sống An 40+ **không** khuyến nghị sản phẩm tài chính cụ thể. Nếu cần tư vấn cá nhân hóa, hãy hỏi chuyên gia có giấy phép hoặc tra cứu trên cổng NHNN/BHXH. [S1][S2]`,
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
      cite(
        "who-falls",
        "WHO: ngã là nguyên nhân chấn thương hàng đầu ở người cao tuổi; cần môi trường an toàn và hỗ trợ y tế khi không đứng dậy được hoặc có chấn thương.",
      ),
      cite(
        "byt-portal",
        "Bộ Y tế khuyến cáo dùng thông tin y tế chính thống; tình huống cấp cứu cần liên hệ cơ sở y tế / cấp cứu địa phương.",
      ),
    ],
    answer: `Khi cha mẹ (hoặc người thân lớn tuổi) bị ngã, ưu tiên **an toàn và đánh giá nhanh**, không vội đỡ dậy bằng mọi giá. [S1]

**Ngay tại chỗ**
1. Giữ bình tĩnh, kiểm tra tỉnh táo và khả năng trả lời. [S1]
2. Quan sát đau nhiều, biến dạng xương/khớp, chảy máu, khó thở.
3. **Không kéo hoặc đỡ dậy mạnh** nếu nghi chấn thương nặng. [S1]
4. Gọi hỗ trợ y tế khi họ không đứng dậy được, đau nhiều, đầu va đập, lẫn lộn, hoặc bạn không chắc. [S1][S2]

**Phòng ngã về sau**
- Lối đi thông thoáng, đủ ánh sáng; gọn dây điện, thảm trơn. [S1]
- Giày dép chống trượt; đồ hay dùng trong tầm với.

Đây là hướng dẫn giáo dục theo nguồn quốc tế/chính thống, **không thay** cấp cứu. Tình huống nghiêm trọng: gọi dịch vụ cấp cứu địa phương ngay. [S2]`,
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
      cite(
        "bhxh-portal",
        "BHXH Việt Nam là kênh chính thống để kiểm tra thông tin BHYT/BHXH và thủ tục liên quan hồ sơ bảo hiểm.",
      ),
      cite(
        "byt-portal",
        "Thông tin y tế và hướng dẫn liên quan khám chữa bệnh công bố trên cổng Bộ Y tế; nên lưu kèm giấy tờ y tế cá nhân khi đi khám.",
      ),
    ],
    answer: `Chuẩn bị giấy tờ cho tuổi già là việc **gom – tách bản sao – cho người tin cậy biết chỗ lưu**. [S1]

**Nhóm giấy thường cần rà soát**
- Giấy tùy thân (CCCD còn hạn, hộ chiếu nếu có)
- Bảo hiểm y tế / hồ sơ BHXH — kiểm tra trên kênh chính thống BHXH Việt Nam [S1]
- Giấy tờ nhà ở, đất đai, hợp đồng thuê (nếu có)
- Sổ thuốc đang dùng, tiền sử bệnh, dị ứng [S2]
- Danh bạ liên hệ khẩn cấp

**Cách làm gọn**
1. Gom bản gốc; bản sao để riêng.
2. Dán nhãn: “Tùy thân”, “Bảo hiểm”, “Nhà cửa”, “Y tế”.
3. Viết tờ hướng dẫn: hộp để đâu, ai được mở khi khẩn cấp.
4. Rà soát 6–12 tháng/lần hoặc khi có thay đổi lớn.

**Giới hạn**
Sống An 40+ **không** soạn di chúc hay tư vấn pháp lý cá nhân hóa. Thủ tục bảo hiểm: dùng cổng BHXH chính thức. [S1]`,
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
      cite(
        "who-hypertension",
        "WHO: đo và theo dõi huyết áp giúp phát hiện/ quản lý tăng huyết áp; điều trị và thay đổi thuốc chỉ theo chỉ định chuyên môn.",
      ),
      cite(
        "byt-portal",
        "Thông tin y tế công cộng chính thống của Bộ Y tế; mang sổ huyết áp khi khám tại cơ sở y tế.",
      ),
    ],
    answer: `Theo dõi huyết áp tại nhà giúp bạn có **sổ số liệu** mang đi khám — không phải để tự kê đơn. [S1]

**Cách đo gọn**
- Nghỉ khoảng 5 phút, ngồi thẳng, chân chạm sàn, tay trên bàn.
- Đo cùng khung giờ vài ngày; ghi ngày, chỉ số, cảm giác. [S1]
- Mang sổ khi gặp nhân viên y tế. [S2]

**Không làm**
- Không tự ý tăng/giảm hoặc ngưng thuốc huyết áp dựa trên một lần đo. [S1]
- Không bỏ qua triệu chứng nặng (đau ngực dữ dội, khó thở nặng, yếu nửa người).

Nếu số đo thường xuyên cao hoặc bạn lo lắng, hãy hẹn nhân viên y tế thay vì tự kết luận. [S1][S2]`,
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
      cite(
        "who-mental-sleep",
        "WHO nêu sức khỏe tinh thần người lớn tuổi gắn với giấc ngủ và bệnh mạn tính; rối loạn kéo dài cần đánh giá chuyên môn.",
      ),
      cite(
        "who-ageing",
        "WHO khuyến khích duy trì thói quen lành mạnh (gồm nghỉ ngơi phù hợp) như một phần của già hóa khỏe mạnh.",
      ),
    ],
    answer: `Ở tuổi trung niên, ngủ đều thường giúp tinh thần và sức bền ổn định hơn là “ngủ bù” thất thường. [S1][S2]

**Việc nhỏ có thể thử 7 ngày**
1. Giờ đi ngủ và thức dậy gần cố định, kể cả cuối tuần. [S2]
2. Giảm ánh sáng mạnh / màn hình sáng 30–60 phút trước ngủ nếu hoàn cảnh cho phép.
3. Tránh biến giường thành chỗ làm việc hoặc xem nội dung kích thích.
4. Ghi 3 đêm: giờ ngủ, tỉnh mấy lần, tỉnh táo ban ngày — mang theo nếu đi khám. [S1]

Nếu mất ngủ kéo dài, ngủ ngày vẫn mệt, hoặc ngáy nặng/nghỉ thở khi ngủ, hãy hỏi nhân viên y tế. Đây là gợi ý lối sống giáo dục theo nguồn WHO, không phải điều trị rối loạn giấc ngủ. [S1]`,
  },
];
