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
 * Prepared answers in plain, culturally natural Vietnamese.
 * Every citation maps to an official source with URL.
 */
export const ANSWER_BANK: AnswerBankEntry[] = [
  {
    id: "health-check-40",
    question: "Từ tuổi 40 tôi nên kiểm tra sức khỏe gì?",
    classification: "health_education",
    aliases: [
      "tu tuoi 40 toi nen kiem tra suc khoe gi",
      "tu tuoi 40 nen kiem tra suc khoe gi",
      "tuoi 40 kiem tra suc khoe",
      "kham suc khoe dinh ky tuoi 40",
      "kham dinh ky tu tuoi 40",
      "nen kiem tra suc khoe gi o tuoi 40",
      "tuoi 40 nen kham gi",
      "tu 40 tuoi nen kham nhung gi moi nam",
    ],
    sources: [
      cite(
        "who-ageing",
        "Tổ chức Y tế Thế giới khuyến khích chuẩn bị sớm từ tuổi ngoài 40: khám đều, vận động vừa sức và đi khám khi cần để giữ sức lâu hơn.",
      ),
      cite(
        "who-hypertension",
        "Tổ chức Y tế Thế giới khuyến cáo đo huyết áp đều vì huyết áp cao làm tăng nguy cơ bệnh tim mạch; đổi thuốc chỉ theo lời bác sĩ.",
      ),
      cite(
        "byt-elderly-checkup",
        "Bài trên cổng Bộ Y tế nhấn mạnh khám sức khỏe định kỳ, có sổ theo dõi bệnh và dùng thuốc đúng chỉ định — hỏi bác sĩ hoặc trạm y tế gần nhà về lịch khám phù hợp.",
      ),
    ],
    answer: `Từ tuổi 40, việc hữu ích nhất là **đi khám sức khỏe định kỳ** và chuẩn bị sẵn câu hỏi để hỏi bác sĩ — đừng tự đoán bệnh ở nhà. [S1][S3]

**Thường được nhắc khi đi khám**
- Huyết áp và các dấu hiệu liên quan bệnh tim mạch (theo lời bác sĩ) [S2]
- Đường huyết (lượng đường trong máu), mỡ máu nếu bác sĩ thấy cần
- Cân nặng, cách ăn uống – vận động, thuốc đang uống, bệnh trong gia đình
- Mắt, tai, răng miệng nếu gần đây thấy thay đổi

**Việc nhỏ tuần này**
1. Đặt lịch khám hoặc hỏi trạm y tế / phòng khám gần nhà. [S3]
2. Ghi sổ nhỏ: thuốc đang uống, triệu chứng gần đây, câu hỏi muốn hỏi.
3. Nếu đã có máy đo huyết áp, đo đúng cách và ghi vài ngày trước khi đi khám. [S2]

**Nên đi khám sớm hơn nếu**
Đau ngực dữ dội, khó thở nặng, yếu nửa người, nói khó — hãy đến cơ sở y tế ngay, đừng chờ đến lịch khám thường.

Thông tin này để bạn chuẩn bị cuộc nói chuyện với bác sĩ, **không phải** danh sách xét nghiệm bắt buộc hay kết luận bệnh.`,
  },
  {
    id: "emergency-fund",
    question: "Tôi nên chuẩn bị quỹ dự phòng thế nào?",
    classification: "financial_education",
    aliases: [
      "toi nen chuan bi quy du phong the nao",
      "toi can chuan bi bao nhieu thang chi phi du phong",
      "bao nhieu thang chi phi du phong",
      "quy du phong la gi",
      "quy du phong",
      "chuan bi quy du phong",
      "lam quy du phong the nao",
      "quy du phong y te nen tinh the nao",
      "quy khan cap",
      "tien du phong",
    ],
    sources: [
      cite(
        "sbv-financial-education",
        "Ngân hàng Nhà nước nhấn mạnh giáo dục tài chính giúp quản lý chi tiêu và tiết kiệm an toàn hơn — không phải lời khuyên đầu tư cho từng người.",
      ),
      cite(
        "bhxh-bhyt-card-lookup",
        "Trang tra cứu thẻ BHYT của Bảo hiểm xã hội Việt Nam giúp kiểm tra thời hạn thẻ; tiền dự phòng bổ sung phần chi phí bảo hiểm chưa chi trả.",
      ),
    ],
    answer: `**Quỹ dự phòng** là khoản tiền để dành khi có việc đột xuất (ốm đau, sửa nhà, mất việc tạm thời…), giúp gia đình **bớt phải vay nóng**. Đây là thói quen lo liệu tiền bạc, không phải cách “làm giàu”. [S1]

**Cách bắt đầu vừa sức**
1. Ước lượng chi tiêu cần thiết mỗi tháng: ăn ở, điện nước, đi lại, thuốc men cơ bản. [S1]
2. Đặt mục tiêu nhỏ trước — ví dụ bằng khoảng 1 tháng chi tiêu cần thiết — rồi tăng dần khi ổn.
3. Để riêng một chỗ (ví hoặc tài khoản tách) và chuyển đều đặn số tiền vừa với thu nhập.
4. Kiểm tra thời hạn thẻ bảo hiểm y tế trên trang **Tra cứu giá trị sử dụng thẻ BHYT** của Bảo hiểm xã hội Việt Nam để biết phần nào đã được hỗ trợ. [S2]

**Giữ vững**
- Để đều mỗi tuần/tháng còn hơn để một lần lớn rồi bỏ.
- Không lấy tiền dự phòng để chơi chứng khoán hay chi tiêu không cần thiết.

**Giới hạn rõ**
VivaAge **không** khuyên bạn mua sản phẩm tiết kiệm hay bảo hiểm cụ thể. Nếu cần tư vấn riêng, hãy hỏi người có chuyên môn; tham khảo bài giáo dục tài chính của Ngân hàng Nhà nước và trang tra cứu thẻ BHYT nêu trên. [S1][S2]`,
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
      "nha co nguoi lon tuoi thi can thay doi nhung gi",
      "nha co nguoi lon tuoi nen thay doi gi",
    ],
    sources: [
      cite(
        "who-falls",
        "Tổ chức Y tế Thế giới cho biết ngã dễ gây chấn thương ở người lớn tuổi; cần nhà cửa an toàn và đưa đi cấp cứu khi không đứng dậy được hoặc đau nhiều.",
      ),
      cite(
        "byt-elderly-checkup",
        "Bài Bộ Y tế về chăm sóc người cao tuổi nhắc duy trì khám định kỳ và sổ theo dõi bệnh; khi ngã nặng cần đưa đến cơ sở y tế kịp thời.",
      ),
    ],
    answer: `Khi cha mẹ hoặc người thân lớn tuổi bị ngã, hãy **giữ bình tĩnh và xem tình trạng trước**, đừng vội đỡ dậy bằng mọi giá. [S1]

**Ngay lúc đó**
1. Nói chuyện nhẹ: họ còn tỉnh, trả lời được không? [S1]
2. Xem chỗ nào đau nhiều, xương/khớp có lệch không, có chảy máu hay khó thở không.
3. **Đừng kéo hoặc đỡ mạnh** nếu nghi bị thương nặng. [S1]
4. Gọi 115 hoặc đưa đi bệnh viện nếu họ không đứng dậy được, đau nhiều, đập đầu, nói lắp/lẫn, hoặc bạn không chắc. [S1][S2]

**Để giảm ngã lần sau**
- Lối đi thông thoáng, đủ đèn; gọn dây điện, thảm trơn. [S1]
- Đi dép chống trượt; đồ hay dùng để trong tầm với.

Đây là hướng dẫn tham khảo theo tờ thông tin **Ngã ở người cao tuổi** của Tổ chức Y tế Thế giới và bài Bộ Y tế về chăm sóc người cao tuổi, **không thay** cấp cứu. Khi tình trạng nặng: gọi 115 ngay. [S2]`,
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
        "bhxh-pension-procedure",
        "Trang thủ tục của Bảo hiểm xã hội Việt Nam nêu thành phần hồ sơ và cách nộp để giải quyết hưởng lương hưu, trợ cấp hàng tháng.",
      ),
      cite(
        "bhxh-bhyt-card-lookup",
        "Trang tra cứu giá trị sử dụng thẻ BHYT giúp kiểm tra thời hạn thẻ trước khi đi khám.",
      ),
      cite(
        "byt-drug-registration-lookup",
        "Hướng dẫn Cục Quản lý Dược (Bộ Y tế) về tra cứu thuốc đã cấp phép — nên giữ sổ thuốc và mang theo khi đi khám.",
      ),
    ],
    answer: `Chuẩn bị giấy tờ cho tuổi già nghĩa là **gom lại – làm bản sao – cho người nhà tin cậy biết để ở đâu**, để lúc cần không phải tìm cuống cuồng. [S1]

**Nhóm giấy nên rà soát**
- Giấy tùy thân (căn cước còn hạn, hộ chiếu nếu có)
- Bảo hiểm y tế — kiểm tra thời hạn trên trang **Tra cứu giá trị sử dụng thẻ BHYT** [S2]
- Hồ sơ liên quan lương hưu / BHXH — xem **thủ tục giải quyết hưởng lương hưu** trên trang Bảo hiểm xã hội Việt Nam [S1]
- Giấy tờ nhà đất, hợp đồng thuê (nếu có)
- Sổ thuốc đang uống, bệnh đã mắc, dị ứng thuốc [S3]
- Số điện thoại người thân, hàng xóm, phòng khám khi khẩn cấp

**Làm gọn trong 1–2 buổi**
1. Gom bản gốc một hộp; bản sao để riêng.
2. Dán nhãn ngoài: “Tùy thân”, “Bảo hiểm”, “Nhà cửa”, “Sức khỏe”.
3. Viết một tờ giấy ngắn: hộp để đâu, ai được mở khi cần.
4. Xem lại mỗi 6–12 tháng hoặc khi có thay đổi lớn.

**Giới hạn**
VivaAge **không** soạn di chúc hay tư vấn luật cho từng người. Thủ tục và tra cứu bảo hiểm: dùng đúng các trang BHXH nêu trên. [S1][S2]`,
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
        "Tổ chức Y tế Thế giới khuyến cáo đo và theo dõi huyết áp; đổi thuốc chỉ theo lời bác sĩ.",
      ),
      cite(
        "byt-elderly-checkup",
        "Bài Bộ Y tế về chăm sóc người cao tuổi nhắc có sổ theo dõi bệnh và tuân thủ dùng thuốc theo bác sĩ — mang sổ huyết áp khi đi khám.",
      ),
    ],
    answer: `Đo huyết áp tại nhà giúp bạn có **sổ ghi chép mang đi khám** — không phải để tự kê đơn. [S1]

**Cách đo đơn giản**
- Nghỉ khoảng 5 phút, ngồi thẳng, chân chạm sàn, tay đặt trên bàn.
- Đo cùng khung giờ vài ngày; ghi ngày, chỉ số, cảm giác lúc đo. [S1]
- Mang sổ này khi gặp bác sĩ. [S2]

**Không nên**
- Tự tăng, giảm hoặc ngưng thuốc huyết áp chỉ vì một lần đo. [S1]
- Bỏ qua dấu hiệu nặng: đau ngực dữ dội, khó thở nặng, yếu nửa người.

Nếu số đo thường xuyên cao hoặc bạn lo lắng, hãy hẹn bác sĩ thay vì tự kết luận. Tham khảo tờ thông tin tăng huyết áp của Tổ chức Y tế Thế giới và bài Bộ Y tế về khám / theo dõi bệnh. [S1][S2]`,
  },
  {
    id: "sleep-habit",
    question: "Làm sao để ngủ ngon hơn ở tuổi ngoài 40?",
    classification: "health_education",
    aliases: [
      "lam sao de ngu ngon",
      "ngu ngon tuoi trung nien",
      "ngu ngon tuoi ngoai 40",
      "giu gio ngu",
      "mat ngu",
      "thieu ngu",
      "ngu la suc manh",
      "lam sao de ngu ngon hon o tuoi ngoai 40",
    ],
    sources: [
      cite(
        "who-mental-sleep",
        "Tổ chức Y tế Thế giới cho biết giấc ngủ ảnh hưởng tinh thần người lớn tuổi; mất ngủ kéo dài nên đi khám.",
      ),
      cite(
        "who-ageing",
        "Tổ chức Y tế Thế giới khuyến khích thói quen lành mạnh, trong đó có nghỉ ngơi đều đặn, để già hóa khỏe mạnh.",
      ),
    ],
    answer: `Ở tuổi ngoài 40, **ngủ đều** thường giúp tinh thần và sức khỏe ổn định hơn là “ngủ bù” lúc được lúc không. [S1][S2]

**Thử trong 7 ngày**
1. Giờ đi ngủ và giờ thức gần cố định, kể cả cuối tuần. [S2]
2. Trước khi ngủ 30–60 phút, bớt xem điện thoại / tivi sáng chói nếu hoàn cảnh cho phép.
3. Đừng biến giường thành chỗ làm việc hay xem nội dung làm kích thích.
4. Ghi 3 đêm: ngủ lúc mấy giờ, tỉnh mấy lần, ban ngày có tỉnh táo không — mang theo nếu đi khám. [S1]

Nếu mất ngủ lâu, ngủ ngày vẫn mệt, hoặc ngáy nặng / thỉnh thoảng ngừng thở khi ngủ, hãy hỏi bác sĩ. Đây là gợi ý thói quen theo Tổ chức Y tế Thế giới, không phải cách chữa bệnh mất ngủ. [S1]`,
  },
];
