/** Short answers for people and answer engines. Product facts only. */

export const SHORT_ANSWERS = [
  {
    questionVi: "VivaAge là gì?",
    answerVi:
      "VivaAge là trang giúp người Việt từ khoảng 40 tuổi chuẩn bị sớm cho sức khỏe, tiền bạc và việc chăm sóc người thân. Bạn làm bài đánh giá, nhận kế hoạch 30 ngày, đọc thư viện và hỏi đáp có nguồn. Đây là thông tin để tham khảo, không thay bác sĩ hay tư vấn tiền bạc riêng cho bạn.",
    questionEn: "What is VivaAge?",
    answerEn:
      "VivaAge helps Vietnamese adults from about age 40 prepare for health, money, and caring for family. You can take a readiness check, follow a 30-day plan, read the library, and ask questions that show their sources. It is educational. It does not replace a doctor or advice about your own money.",
  },
  {
    questionVi: "VivaAge có phải ứng dụng của cơ quan nhà nước không?",
    answerVi:
      "Không. VivaAge là dự án cá nhân trên Orange Cloud, không phải cổng của cơ quan nhà nước. Nội dung dùng để tìm hiểu và lập kế hoạch.",
    questionEn: "Is VivaAge a government app?",
    answerEn:
      "No. VivaAge is a personal project on Orange Cloud, not a government portal. Use it to learn and to plan.",
  },
  {
    questionVi: "Ai duy trì VivaAge?",
    answerVi:
      "Cường Lê Sỹ duy trì VivaAge như một dự án cá nhân. Danh sách dự án nằm ở trang Orange Cloud.",
    questionEn: "Who maintains VivaAge?",
    answerEn:
      "Cường Lê Sỹ maintains VivaAge as a personal project. The project list is on the Orange Cloud site.",
  },
] as const;

export function shortAnswerEntities() {
  return SHORT_ANSWERS.flatMap((item) => [
    {
      "@type": "Question" as const,
      inLanguage: "vi",
      name: item.questionVi,
      acceptedAnswer: {
        "@type": "Answer" as const,
        inLanguage: "vi",
        text: item.answerVi,
      },
    },
    {
      "@type": "Question" as const,
      inLanguage: "en",
      name: item.questionEn,
      acceptedAnswer: {
        "@type": "Answer" as const,
        inLanguage: "en",
        text: item.answerEn,
      },
    },
  ]);
}
