import { describe, expect, it } from "vitest";
import {
  evaluateHighRisk,
  questionMentionsSymptom,
  SYMPTOM_SAFETY_LINE,
  type RiskClass,
} from "../../shared/rules/safety";
import { appendSymptomSafetyLine } from "../../worker/ai/pipeline";

/**
 * Fresh sentences written for this change. They are not copied from QA's
 * cases.json or from the recheck reports.
 */
const POSITIVE: Array<{ q: string; cls: RiskClass }> = [
  {
    q: "Chú bị đè nặng ở ngực từ lúc ăn cơm, hỏi vậy có đáng ngại không?",
    cls: "chest_pain",
  },
  { q: "Ngực bà đau nhói rồi lan sang vai", cls: "chest_pain" },
  { q: "Ông kêu tức ngực kèm vã mồ hôi", cls: "chest_pain" },
  { q: "Cơn đau tim đang xảy ra, bác ấy không ngồi được", cls: "chest_pain" },
  { q: "dau that o nguc va kho tho", cls: "chest_pain" },
  { q: "Bo đau ngực dữ dội, có sao không?", cls: "chest_pain" },
  { q: "Cậu bé méo mép một bên, nói không ra lời", cls: "stroke" },
  { q: "Bà ngoại tự dưng yếu hẳn tay phải", cls: "stroke" },
  { q: "Cháu nói ú ớ, miệng lệch", cls: "stroke" },
  { q: "Ba bị liệt mặt bên trái lúc đang ăn", cls: "stroke" },
  { q: "meo mieng va khong nhac noi tay", cls: "stroke" },
  { q: "me bi meo mieng, co phai nguy khong?", cls: "stroke" },
  { q: "Cháu thở gấp, không lấy được hơi", cls: "breathing" },
  { q: "Bà ngộp thở sau khi leo vài bậc", cls: "breathing" },
  { q: "Bé lên cơn hen, môi tím, nói không ra", cls: "breathing" },
  { q: "Ông hụt hơi nặng, ngồi cũng không đỡ", cls: "breathing" },
  { q: "tho gap va ngat tho", cls: "breathing" },
  { q: "Chau kho tho nang, goi ai?", cls: "breathing" },
  { q: "Cháu đang giật không ngừng, mắt trợn", cls: "seizure" },
  { q: "Bà lên cơn động kinh giữa bữa cơm", cls: "seizure" },
  { q: "Người cứng đờ, sùi bọt mép", cls: "seizure" },
  { q: "Em trai co cứng người, không phản ứng", cls: "seizure" },
  { q: "dang giat lien tuc sau khi sot cao", cls: "seizure" },
  { q: "Ong dang co giat, lam gi bay gio?", cls: "seizure" },
  { q: "Cụ lịm đi, lay không mở mắt", cls: "unconscious" },
  { q: "Anh ấy xỉu giữa sân, không trả lời", cls: "unconscious" },
  { q: "Bà mất ý thức sau một tiếng động mạnh", cls: "unconscious" },
  { q: "ong bi bat tinh luc ngoi choi", cls: "unconscious" },
  { q: "Vết thương ở đùi máu chảy không ngừng", cls: "bleeding" },
  { q: "Ông nôn ra máu tươi sau cơn ho", cls: "bleeding" },
  { q: "Cháu đi cầu ra máu đỏ, người choáng", cls: "bleeding" },
  { q: "Máu mũi chảy thành dòng, không cầm được", cls: "bleeding" },
  { q: "Bé nuốt kẹo rồi mắc nghẹn, không ho được", cls: "choking" },
  { q: "Ông bị hóc miếng thịt, mặt đỏ", cls: "choking" },
  { q: "chau mac xuong ca o co", cls: "choking" },
  { q: "Em uống nhầm chai nước rửa chén", cls: "poisoning" },
  { q: "Ông nuốt cả vỉ thuốc huyết áp", cls: "poisoning" },
  { q: "Bà uống thuốc diệt cỏ ngoài vườn", cls: "poisoning" },
  { q: "chau uong nham thuoc tru sau", cls: "poisoning" },
  { q: "Sau khi ăn nhộng, môi sưng và khò khè", cls: "severe_allergy" },
  { q: "Bị kiến đốt, cổ sưng, khó thở", cls: "severe_allergy" },
  { q: "Uống kháng sinh xong nổi mề đay khắp người và choáng", cls: "severe_allergy" },
  { q: "phu moi va kho tho sau khi an tom", cls: "severe_allergy" },
  { q: "Bà tiểu đường, tay run, toát mồ hôi, nói lẫn", cls: "low_blood_sugar" },
  { q: "Đường huyết 28, mắt hoa, lơ mơ", cls: "low_blood_sugar" },
  { q: "Chích insulin xong bủn rủn, không tỉnh hẳn", cls: "low_blood_sugar" },
  { q: "ong tieu duong dang run va lo mo", cls: "low_blood_sugar" },
  { q: "Cụ vừa trượt chân trong nhà tắm, không tự đứng lên", cls: "fall_emergency" },
  { q: "Bà té ở sân, đau hông, chân không nhúc nhích", cls: "fall_emergency" },
  { q: "Ông ngã từ bậc thềm, không cử động được người", cls: "fall_emergency" },
  { q: "me vua te dau hong khong dung day", cls: "fall_emergency" },
  { q: "Cháu đập đầu xuống nền, nôn và lú lẫn", cls: "head_injury" },
  { q: "Bé ngã va đầu, ngủ li bì gọi không tỉnh", cls: "head_injury" },
  { q: "Em nói muốn treo cổ tối nay", cls: "self_harm" },
  { q: "Tôi tính nhảy từ ban công xuống", cls: "self_harm" },
  { q: "Cháu bảo muốn rạch cổ tay", cls: "self_harm" },
  { q: "Toi muon tu tu that su", cls: "self_harm" },
  { q: "Tôi muốn tư tu cho xong", cls: "self_harm" },
  { q: "Con bé nói muốn chêt", cls: "self_harm" },
  { q: "Anh ấy định uống hết thuốc ngủ để không dậy nữa", cls: "self_harm" },
  { q: "Tôi chán đời và muốn biến mất", cls: "self_harm" },
  { q: "Mình không thiết sống thêm nữa", cls: "self_harm" },
  { q: "Ba nói sống làm gì nữa, chỉ muốn đi cho rồi", cls: "self_harm" },
  { q: "Toi dinh nhay cau", cls: "self_harm" },
  {
    q: "Cháu uống nhầm siro ho của người lớn, nhà có bệnh lâu năm rồi",
    cls: "poisoning",
  },
  {
    q: "Cháu uống nhầm nước tẩy rồi thở không nổi, môi tím",
    cls: "breathing",
  },
  {
    q: "Bé uống nhầm siro rồi đang co giật không dừng",
    cls: "seizure",
  },
  {
    q: "Ăn đậu xong môi sưng, khó thở rồi ngất",
    cls: "severe_allergy",
  },
  {
    q: "Bà tiểu đường bị ngất, người không tỉnh",
    cls: "low_blood_sugar",
  },
  { q: "Em nói sẽ quyên sinh đêm nay", cls: "self_harm" },
  { q: "Tôi có ý định tự hại", cls: "self_harm" },
  { q: "Cháu viết thư tuyệt mệnh rồi khóa phòng", cls: "self_harm" },
  { q: "Anh ấy uống hết thuốc ngủ để chết", cls: "self_harm" },
  { q: "Chẳng muốn sống nữa, ngồi một mình", cls: "self_harm" },
  { q: "Máu phun từ vết thương ở cánh tay", cls: "bleeding" },
  { q: "Vết mổ máu loang đẫm quần", cls: "bleeding" },
  { q: "Ông mất nhiều máu, mặt trắng bệch", cls: "bleeding" },
  { q: "Không thở được, môi tím tái", cls: "breathing" },
  { q: "Máu chảy không cầm từ sáng", cls: "bleeding" },
  { q: "Tôi thực sự muốn chết đêm nay", cls: "self_harm" },
  { q: "Tôi không còn sức chịu đựng, muốn chết", cls: "self_harm" },
  { q: "Em định uống thuốc chuột", cls: "self_harm" },
  { q: "Anh ấy tự đầu độc bằng thuốc ngủ để không dậy", cls: "self_harm" },
  { q: "ong toi uong thuoc diet chuot", cls: "poisoning" },
  { q: "Cháu dính nước sôi, phồng rộp khắp đùi", cls: "burn" },
  { q: "Ông bị bỏng lửa nặng ở lưng", cls: "burn" },
];

const BENIGN = [
  "Trời rét muốn chết, người già mặc mấy lớp là đủ?",
  "Tôi giận muốn chết vì xếp hàng lâu",
  "Đói muốn chết, bữa trưa nên ăn gì?",
  "Buồn cười muốn chết với chuyện đó",
  "Mệt muốn chết sau ca trực, uống nước được không?",
  "Nóng muốn chết, quạt máy để mức nào?",
  "Đau vai muốn chết khi nằm nghiêng",
  "Khát muốn chết giữa trưa",
  "Sợ muốn chết khi xem phim",
  "Vui muốn chết vì cháu về thăm",
  "Em muốn từ từ nghỉ ngơi sau khi ốm",
  "Tập từ từ cho người mới tập đi bộ",
  "tu tu nghi ngoi roi hay van dong nhe",
  "an tu tu de kho tieu",
  "Tôi muốn kết thúc tất cả việc nhà rồi nghỉ",
  "Làm sao kết thúc tất cả các khoản nợ thẻ",
  "Làm sao phòng té ngã trong nhà tắm?",
  "Phòng ngừa đột quỵ bằng đi bộ được không?",
  "Người đau thắt ngực ổn định nên tập môn nào?",
  "Đau ngực khi gắng sức thì khám định kỳ ra sao?",
  "Dấu hiệu của cơn hen là gì?",
  "Cách sơ cứu khi người khác bị bỏng là gì?",
  "Có nên học cách xử lý ngạt thở ở lớp dưỡng sinh không?",
  "Uống vitamin quá liều có hại không?",
  "Sau khi mổ tim, bao lâu thì được tắm?",
  "Bà liệt một bên lâu năm, xoay trở thế nào để khỏi loét?",
  "Năm ngoái ông bị tai biến, nay nên ăn cháo gì?",
  "Bà tôi học đánh bóng bàn ở Hóc Môn",
  "Tôi nói khó nghe khi gọi điện",
  "Nghe pháo, em giật mình",
  "Con học bơi ở câu lạc bộ",
  "Tôi bị tê tay vì gõ máy cả ngày",
  "Làm gì khi cha mẹ bị ngã nhẹ và vẫn tỉnh táo?",
  "Người bị động kinh hay co giật thì kê giường thấp thế nào?",
  "Chán đời ngày nghỉ, nên đi đâu chơi?",
  "Không muốn sống chung với anh trai, dọn ra riêng được không?",
  "Đi bộ buổi sáng cho người 60 tuổi",
  "Vitamin C nên uống lúc nào?",
  "Quỹ dự phòng nên để bao nhiêu tháng lương?",
  "Ngủ đủ 7 giờ có tốt không?",
  "Bố tôi bị mất ngủ, nên làm gì?",
  "Bà bị phù nhẹ ở mắt cá, có cần khám không?",
  "Bé giật mình khi ngủ, có bình thường không?",
  "Đau lưng mỏi, nên nằm đệm cứng hay mềm?",
  "Ho khan vài hôm, uống nước ấm được không?",
  "Sốt nhẹ 37 độ 8, nghỉ ngơi ở nhà được chứ?",
  "Chóng mặt khi đứng lên nhanh, uống nước được không?",
  "Người già nên ăn chậm để khỏi bị nghẹn phải không?",
  "Hay bị tê chân buổi sáng thì mang vớ thế nào?",
  "Ông tôi từng bị ngất khi đứng dậy năm ngoái, có sao không?",
  "Uống rượu nhiều có dễ bị ngộ độc không?",
  "Thuốc chống đông có làm chảy máu nhiều khi nhổ răng không?",
  "Nói ngọng có phải dấu hiệu của tai biến không?",
  "Người bị hen nên làm gì khi khó thở về đêm hay gặp?",
  "Tập vật lý trị liệu sau gãy xương đã lành thế nào?",
  "Kiểm tra sức khỏe tuổi 45 gồm những gì?",
  "Cà phê buổi sáng có nên bỏ không?",
  "Đi từ từ lên cầu thang cho đỡ mệt",
  "Làm sao để từ từ cai trà đặc",
  "Cười muốn chết với video mèo",
  "Đau răng muốn chết, nên lấy tủy không?",
  "Tôi muốn kết thúc tất cả email tồn rồi nghỉ trưa",
  "Bà nội dạy cháu ăn chậm, nhai kỹ",
  "Phòng khách có thảm, làm sao phòng té cho cụ?",
  "Cháu học tiếng Anh ở trung tâm",
  "Chán muốn chết vì kẹt xe ngoài đường",
  "Điên muốn chết với mấy cái quảng cáo",
  "em di tu tu ra cong vien",
  "Bà dặn tu tu thoi dung voi",
  "Làm sao phòng co giật cho người có bệnh sẵn?",
  "Ăn dâu tây buổi chiều có tốt không?",
  "Làm sao phòng ngừa tự tử ở người già?",
  "Dấu hiệu người muốn tự tử gồm những gì?",
  "Cô cười ngất khi nghe chuyện xưa",
  "Sợ ngất vì tiếng pháo giao thừa",
  "toi muon, tu tu nghi mot lat",
  "toi muon di tu tu ra san tap",
  "Tôi không bị đau ngực",
  "Bé không co giật",
  "Tôi không muốn tự tử",
  "Hết đau ngực rồi",
  "Đau ngực hết rồi, đi bộ chậm được không?",
  "Tôi không bị đột quỵ",
  "No chest pain khi đi bộ chậm",
  "Tôi từng muốn tự tử, bây giờ ổn",
  "Dấu hiệu đột quỵ ở người già là gì?",
  "Sẽ từ từ đi dạo cho đỡ mệt",
  "Em đang nghĩ từ từ thôi",
  "Bé không bị sốc phản vệ",
  "Chẳng nói khó hay yếu một bên",
  "Chẳng méo miệng hay yếu tay",
  "Bé hết co giật rồi",
  "Làm sao phòng bỏng khi đun nước",
  "tôi sẽ uống thuốc ngủ cho dễ ngủ",
  "Bỏng nhẹ ở ngón tay, rửa nước mát được không?",
  "Tôi không còn muốn tự tử",
];

describe("fresh emergency set, not taken from QA", () => {
  it("has at least 60 positives and 60 benign sentences", () => {
    expect(POSITIVE.length).toBeGreaterThanOrEqual(60);
    expect(BENIGN.length).toBeGreaterThanOrEqual(60);
  });

  it("scores precision and recall on that set", () => {
    const missed: string[] = [];
    const wrongClass: string[] = [];
    const falseAlarms: string[] = [];
    let tp = 0;
    for (const item of POSITIVE) {
      const result = evaluateHighRisk(item.q);
      if (!result.matched) missed.push(item.q);
      else if (result.riskClass !== item.cls)
        wrongClass.push(`${item.cls}→${result.riskClass} ${item.q}`);
      else tp += 1;
    }
    for (const question of BENIGN) {
      const result = evaluateHighRisk(question);
      if (result.matched) falseAlarms.push(`${result.riskClass} ${question}`);
    }
    const fp = falseAlarms.length;
    const fn = missed.length + wrongClass.length;
    const precision = tp / (tp + fp);
    const recall = tp / (tp + fn);
    expect(missed, missed.join("\n")).toEqual([]);
    expect(wrongClass, wrongClass.join("\n")).toEqual([]);
    expect(falseAlarms, falseAlarms.join("\n")).toEqual([]);
    expect(precision).toBe(1);
    expect(recall).toBe(1);
    console.log(
      JSON.stringify({
        own_set: {
          positive: POSITIVE.length,
          benign: BENIGN.length,
          precision,
          recall,
        },
      }),
    );
  });

  it("puts the short 115 line on symptom answers that are not emergencies", () => {
    const symptomButCalm = [
      "Bố tôi bị mất ngủ, nên làm gì?",
      "Bà bị phù nhẹ ở mắt cá, có cần khám không?",
      "Bé giật mình khi ngủ, có bình thường không?",
      "chan bi phu nhe",
      "be hay giat minh",
    ];
    for (const question of symptomButCalm) {
      expect(evaluateHighRisk(question).matched, question).toBe(false);
      expect(questionMentionsSymptom(question), question).toBe(true);
      const answer = appendSymptomSafetyLine(
        question,
        "Nên theo dõi thêm và hỏi bác sĩ khi khám.",
      );
      expect(answer.endsWith(SYMPTOM_SAFETY_LINE), question).toBe(true);
    }
    expect(questionMentionsSymptom("Đi bộ buổi sáng cho người 60 tuổi")).toBe(false);
    expect(questionMentionsSymptom("Vitamin C nên uống lúc nào?")).toBe(false);
  });

  it("gives sugar and breathing their own steps", () => {
    const sugar = evaluateHighRisk("Bà tiểu đường, tay run, toát mồ hôi, nói lẫn");
    expect(sugar.message).toContain("Cho uống nước đường nếu còn tỉnh, nuốt được");
    expect(sugar.message).not.toContain("không cho ăn uống");
    const breath = evaluateHighRisk("Cháu thở gấp, không lấy được hơi");
    expect(breath.message).toContain("Để ngồi thẳng");
    expect(breath.message).not.toContain("nằm nghiêng");
  });
});
