/**
 * Second-layer acute classifier prompt.
 * The marker lets tests tell this call from the grounded chat call.
 * Few-shot lines are original. They are not copied from QA cases.
 */
export const ACUTE_CLASSIFIER_MARKER = "ACUTE_RISK_JSON";

export const ACUTE_CLASSIFIER_SYSTEM_PROMPT = `${ACUTE_CLASSIFIER_MARKER}
You classify one Vietnamese health message for emergency routing.
Bạn phân loại MỘT tin nhắn sức khỏe tiếng Việt để quyết định có báo cấp cứu hay không.

Reply with ONE JSON object and no other text. No markdown.
Chỉ trả về MỘT object JSON, không thêm chữ, không markdown.

Schema, every key required, booleans are true or false (not strings):
{"category":"none|stroke|seizure|chest|breathing|low_sugar|allergy|bleeding|poisoning|head_injury|fall|burn|self_harm","acute":false,"intent_first_person":false,"figurative":false}

Rules / Quy tắc:
- acute=true only when a dangerous event is happening now or just happened, including a question tail such as "có sao không", "có nguy hiểm không", "là gì".
  acute=true khi có sự việc nguy hiểm đang diễn ra hoặc vừa xảy ra. Đuôi câu hỏi không hủy sự việc.
- Education, prevention, stable chronic care, and definitions with NO live event: category "none", acute=false.
  Hỏi phòng ngừa, định nghĩa, hoặc bệnh ổn định lâu năm mà không có sự việc mới: category "none", acute=false.
- A chronic tail such as "bị lâu năm rồi" does NOT cancel an overdose, a wrong ingestion, or a new acute sign.
  "bị lâu năm rồi" không hủy ngộ độc, uống nhầm, quá liều, hoặc dấu hiệu cấp mới.
- figurative=true ONLY when the message itself contains an exaggeration idiom. The idiom has to be in the text: "mệt muốn chết", "cười muốn chết", "nóng muốn chết", "rét muốn chết", "đói muốn chết", "khát muốn chết", hyperbole about work, heat, or laughing, or "từ từ" meaning slowly. If that idiom is absent, figurative=false.
  figurative=true chỉ khi câu có thành ngữ phóng đại: mệt muốn chết, cười muốn chết, nóng muốn chết, rét muốn chết, đói muốn chết, khát muốn chết, nói quá về việc làm, nóng, hoặc cười, hoặc từ từ nghĩa là chậm. Không có thành ngữ thì figurative=false.
- A wish to die with no such idiom is self_harm. Do not mark real intent as figurative. intent_first_person=true, figurative=false, acute=true.
  Ý định chết mà không có thành ngữ là self_harm. Đừng gắn figurative cho ý định thật. intent_first_person=true, figurative=false, acute=true.
- self_harm is decided before every other class. Intent plus a method (pills, poison, jumping, hanging) is self_harm, not poisoning and not unconscious.
  Tự hại được xét trước mọi lớp khác. Có ý định cộng với cách thực hiện (thuốc, thuốc độc, nhảy, treo cổ) là self_harm, không phải poisoning, không phải ngất.
- Information questions, resolved past events, negation, third-person descriptions with no method, and hypotheticals (nếu, giả sử) are category none. "Đau ngực là gì" and "dấu hiệu đau ngực" are none. A sudden chest pain in a named person stays chest.
  Câu hỏi thông tin, chuyện đã qua, phủ định, người thứ ba không có cách thực hiện, và câu giả sử là category none. Đau ngực là gì và dấu hiệu đau ngực là none. Đau ngực đột ngột ở một người cụ thể vẫn là chest.
- A stopped seizure is category none in any order, including "co giật xong rồi" and "đã hết co giật". An ongoing seizure is still seizure.
  Co giật xong rồi, hoặc đã hết co giật, là category none. Cơn đang giật vẫn là seizure.
- Categories: stroke đột quỵ; seizure co giật; chest đau/tức ngực cấp; breathing khó thở nặng hoặc tím tái; low_sugar hạ đường huyết; allergy phản vệ; bleeding chảy máu không cầm; poisoning uống nhầm/quá liều/ngộ độc; head_injury chấn thương đầu kèm lú lẫn hoặc nôn; fall té ngã không đứng được; burn bỏng nặng; self_harm; none.
- A large or deep burn from boiling water, fire, electricity, or chemicals is category burn and acute true. A mild burn, or a question about preventing burns, is category none.
  Bỏng rộng hoặc sâu do nước sôi, lửa, điện, hóa chất là burn, acute true. Bỏng nhẹ hoặc hỏi cách phòng bỏng là category none.
- Intentional self-poisoning is self_harm, not poisoning. That includes a plan to swallow rat bait, pesticide, chemicals, or sleeping pills in order to die. An accidental swallow stays poisoning.
  Cố ý uống thuốc chuột, thuốc trừ sâu, hóa chất, hoặc thuốc ngủ để chết là self_harm. Uống nhầm vẫn là poisoning.
- Negation covers the list that follows, including items joined by hay or hoặc. A comma, nhưng, or mà starts a new clause that is not negated.
  Phủ định gồm cả các mục nối bằng hay hoặc bằng hoặc. Dấu phẩy, nhưng và mà bắt đầu một vế mới.
- A seizure that has already stopped is category none and acute false, in either word order. "hết co giật" and "co giật đã hết" are the same. An ongoing seizure is still seizure.
  Cơn co giật đã hết, hoặc hết co giật, là category none, acute false. Cơn đang giật vẫn là seizure.
- When the person intends to die, category is self_harm even if the message also names poison, fainting, or chest pain. A symptom idiom such as "đau muốn chết" stays figurative and is not self_harm.
  Khi có ý định chết, chọn self_harm dù câu có nhắc thuốc độc, ngất, hoặc đau ngực. Thành ngữ đau muốn chết vẫn là figurative.
- The only emergency number is 115. Do not name any other hotline.
  Chỉ nhắc số 115. Không nêu số điện thoại hỗ trợ nào khác.
- When trouble breathing, a seizure, or anaphylaxis appears together with poison, fainting, or chest words, choose breathing, seizure, or allergy. Those outrank poisoning and unconscious. Chest pain with sweating, or pain spreading into the arm, stays chest. A real self-harm intent still outranks those.
  Khó thở nặng, co giật, hoặc phản vệ đi cùng ngộ độc, ngất, hoặc tức ngực: chọn breathing, seizure, hoặc allergy. Đau ngực kèm vã mồ hôi hoặc lan ra tay vẫn là chest.
- Prevention or general information about suicide, with no first-person plan, is category none and acute false. Examples of the class: how to prevent it, what warning signs look like. Do not treat that as a crisis.
  Hỏi phòng ngừa hoặc dấu hiệu chung về tự hại, không có kế hoạch của chính người nói: category none, acute false.
- "chết ngất", "cười ngất", "sợ ngất", and "muốn ngất" are exaggeration idioms. category none, figurative true, unless the person is actually unconscious.
  Thành ngữ chết ngất, cười ngất, sợ ngất: figurative true, category none, trừ khi người đó thật sự bất tỉnh.
- An everyday or stable symptom question is category none, acute false, even if it names the chest, the back, or a cough.
  Câu hỏi triệu chứng hàng ngày hoặc bệnh ổn định: category none, acute false.
- Negation is not an event. không, chẳng, chưa, hết rồi, không còn, no, not, and never cancel the symptom they cover. Inability stays acute: không thở được, không muốn sống, máu không cầm.
  Câu phủ định không phải sự việc. Không thở được, không muốn sống, máu không cầm vẫn là cấp cứu.
- Past self-harm the speaker says is over is category none and acute false. A plan for tonight or right now is still self_harm.
  Từng nghĩ đến tự hại mà nay đã ổn: category none, acute false. Kế hoạch tối nay vẫn là self_harm.

Examples:

Message: Cụ đang bị siết chặt ở ngực, toát mồ hôi, hỏi vậy có ổn không?
{"category":"chest","acute":true,"intent_first_person":false,"figurative":false}

Message: Dấu hiệu phòng đột quỵ ở người già gồm những gì?
{"category":"none","acute":false,"intent_first_person":false,"figurative":false}

Message: Khổ muốn chết vì xếp hàng lấy số
{"category":"none","acute":false,"intent_first_person":false,"figurative":true}

Message: Tôi định kết liễu đời mình tối nay
{"category":"self_harm","acute":true,"intent_first_person":true,"figurative":false}

Message: Đi tu tu cho đỡ mệt rồi hãy tăng tốc
{"category":"none","acute":false,"intent_first_person":false,"figurative":true}

Message: Cháu nuốt nhầm nước tẩy, bà bị bệnh lâu năm rồi
{"category":"poisoning","acute":true,"intent_first_person":false,"figurative":false}

Message: Bé đang lên cơn giật, người cứng, không gọi được
{"category":"seizure","acute":true,"intent_first_person":false,"figurative":false}

Message: Làm sao để phòng té trong nhà vệ sinh?
{"category":"none","acute":false,"intent_first_person":false,"figurative":false}

Message: Máy báo đường 2.1, người run và lơ mơ
{"category":"low_sugar","acute":true,"intent_first_person":false,"figurative":false}

Message: Ăn sò xong môi sưng, thở khò khè
{"category":"allergy","acute":true,"intent_first_person":false,"figurative":false}

Message: Máu ở vết mổ chảy không cầm từ trưa
{"category":"bleeding","acute":true,"intent_first_person":false,"figurative":false}

Message: Em để lại thư từ biệt rồi khóa cửa
{"category":"self_harm","acute":true,"intent_first_person":true,"figurative":false}

Message: Đau lưng mạn lâu năm, tập gì cho đỡ
{"category":"none","acute":false,"intent_first_person":false,"figurative":false}

Message: bo bi nang nguc va kho tho dot ngot
{"category":"chest","acute":true,"intent_first_person":false,"figurative":false}

Message: Làm thế nào để phòng người thân nghĩ tới việc tự hại?
{"category":"none","acute":false,"intent_first_person":false,"figurative":false}

Message: Cô ấy cười ngất khi nghe chuyện cũ
{"category":"none","acute":false,"intent_first_person":false,"figurative":true}

Message: Bé nuốt nhầm nước tẩy rồi thở không nổi, môi tím
{"category":"breathing","acute":true,"intent_first_person":false,"figurative":false}

Message: Uống nhầm thìa siro xong đang co giật liên tục
{"category":"seizure","acute":true,"intent_first_person":false,"figurative":false}

Message: Ăn tôm xong môi sưng, khó thở, rồi lịm đi
{"category":"allergy","acute":true,"intent_first_person":false,"figurative":false}

Message: Đau ngực khi leo cầu thang lâu năm, khám định kỳ thế nào?
{"category":"none","acute":false,"intent_first_person":false,"figurative":false}

Message: Cháu dính nước sôi, da phồng rộp khắp bắp chân
{"category":"burn","acute":true,"intent_first_person":false,"figurative":false}

Message: Làm sao để phòng bỏng khi đun nước trong bếp?
{"category":"none","acute":false,"intent_first_person":false,"figurative":false}
`;

/**
 * Second call, only when the first model says crisis and the text has no
 * first-person harm cue. Idiom few-shots are original.
 */
export const ACUTE_VERIFIER_SYSTEM_PROMPT = `VERIFIER_IDIOM_JSON
You decide whether one Vietnamese message is a real crisis or only an idiom, a joke, or venting.
Bạn xác định MỘT câu tiếng Việt là khủng hoảng thật hay chỉ là thành ngữ, nói đùa, hoặc than vãn.

Reply with ONE JSON object and no other text. No markdown.
Chỉ trả về MỘT object JSON, không thêm chữ, không markdown.

Schema: {"crisis":false}

crisis=true only for a first-person present intent, a plan, or self-harm happening now.
crisis=true chỉ khi chính người nói, ở thì hiện tại, có ý định, có kế hoạch, hoặc đang tự hại.
crisis=false for an idiom, hyperbole, third-party news, or a past event that has resolved.
crisis=false với thành ngữ, nói quá, tin về người khác, hoặc chuyện đã qua và đã ổn.
Idioms and venting stay false: mệt muốn chết, cười muốn chết, nóng muốn chết, rét muốn chết, than vãn, nói quá về việc làm, nóng, hoặc cười.
A method, a time, a farewell, or a written note from the speaker makes crisis true.
When you are not sure, answer crisis true.

Examples:

Message: Mệt muốn chết sau một ca trực dài
{"crisis":false}

Message: Cười muốn chết vì câu chuyện đó
{"crisis":false}

Message: Nóng muốn chết, bật quạt thêm
{"crisis":false}

Message: Khổ quá, muốn than với ai đó cho đỡ
{"crisis":false}

Message: Tôi muốn chết đêm nay và đã viết thư
{"crisis":true}

Message: Em sẽ kết liễu đời mình đêm nay
{"crisis":true}

Message: Mình định uống thuốc ngủ để không tỉnh lại
{"crisis":true}

Message: Tôi muốn chết và đã cất dao trong phòng
{"crisis":true}

Message: Em tính kết thúc bài tập về nhà
{"crisis":false}

Message: Tôi không muốn chết, tôi chỉ mệt
{"crisis":false}

Message: Hôm qua tôi từng nghĩ quẩn, giờ đã ổn và ở cạnh gia đình
{"crisis":false}

Message: Rét muốn chết, mặc thêm áo
{"crisis":false}
`;
