import { EXAMPLE_QUESTIONS, DISCLAIMER } from "../constants/product";
import { shortAnswerEntities } from "./aeo";
import { BRAND, PERSON_ID, absoluteUrl, type PageSeo } from "./identity";

/** FAQ answers kept short & educational for GEO / rich results */
const FAQ_ANSWERS: Record<(typeof EXAMPLE_QUESTIONS)[number], string> = {
  "Từ tuổi 40 tôi nên kiểm tra sức khỏe gì?":
    "Từ tuổi 40, nên trao đổi với bác sĩ về khám định kỳ phù hợp (huyết áp, đường huyết, lipid máu, và các xét nghiệm theo tuổi/giới). VivaAge cung cấp gợi ý giáo dục — không thay chẩn đoán hay kê đơn.",
  "Tôi nên chuẩn bị quỹ dự phòng thế nào?":
    "Quỹ dự phòng thường bắt đầu bằng ước lượng chi phí thiết yếu vài tháng và gửi vào kênh dễ rút, tách khỏi chi tiêu hàng ngày. Đây là kiến thức giáo dục tài chính chung — không phải tư vấn đầu tư cá nhân.",
  "Làm gì khi cha mẹ bị ngã?":
    "Ưu tiên an toàn: giữ bình tĩnh, kiểm tra ý thức và chấn thương rõ, gọi cấp cứu khi cần, không kéo nâng người nếu nghi gãy xương. VivaAge có bài học kỹ năng chăm sóc mang tính giáo dục.",
  "Cần chuẩn bị giấy tờ nào cho tuổi già?":
    "Thường hữu ích: giấy tờ tùy thân, bảo hiểm/y tế, thông tin tài khoản quan trọng và mong muốn chăm sóc đã trao đổi với gia đình. Nội dung mang tính định hướng giáo dục, không thay tư vấn pháp lý.",
};

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND.name,
    legalName: BRAND.legalName,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/logo-mark-512.png"),
    description: BRAND.description,
    areaServed: {
      "@type": "Country",
      name: BRAND.countryName,
    },
    inLanguage: BRAND.language,
    founder: { "@id": PERSON_ID },
    ...(BRAND.sameAs.length ? { sameAs: [...BRAND.sameAs] } : {}),
  };
}

/** Joins the person node published at https://orangecloud.vn/#person */
export function personJsonLd() {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: "Cường Lê Sỹ",
    alternateName: ["Cuong Le Sy", "Cuong Le", "Sycule"],
    url: "https://orangecloud.vn/about/",
    sameAs: ["https://github.com/sycu8"],
  };
}

export function webApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: BRAND.name,
    alternateName: BRAND.nameSpaced,
    url: absoluteUrl("/"),
    description: BRAND.description,
    applicationCategory: BRAND.category,
    operatingSystem: "Web",
    inLanguage: BRAND.language,
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "VND",
    },
    publisher: {
      "@type": "Organization",
      name: BRAND.name,
      url: absoluteUrl("/"),
    },
    author: { "@id": PERSON_ID },
    about: [
      "Healthy aging",
      "Sức khỏe trung niên",
      "Giáo dục tài chính",
      "Kỹ năng chăm sóc",
    ],
    audience: {
      "@type": "PeopleAudience",
      suggestedMinAge: 40,
      geographicArea: {
        "@type": "Country",
        name: BRAND.countryName,
      },
    },
    disclaimer: DISCLAIMER,
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND.name,
    url: absoluteUrl("/"),
    description: BRAND.descriptionShort,
    inLanguage: BRAND.language,
    publisher: {
      "@type": "Organization",
      name: BRAND.name,
    },
    author: { "@id": PERSON_ID },
  };
}

export function faqPageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      ...shortAnswerEntities(),
      ...EXAMPLE_QUESTIONS.map((q) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: {
          "@type": "Answer",
          text: FAQ_ANSWERS[q],
        },
      })),
    ],
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function webPageJsonLd(page: PageSeo) {
  return {
    "@context": "https://schema.org",
    "@type": page.type === "article" ? "Article" : "WebPage",
    name: page.title,
    description: page.description,
    url: absoluteUrl(page.path),
    inLanguage: BRAND.language,
    isPartOf: {
      "@type": "WebSite",
      name: BRAND.name,
      url: absoluteUrl("/"),
    },
    about: {
      "@type": "Thing",
      name: BRAND.taglineLockup,
    },
  };
}

export function homeJsonLdGraph() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      personJsonLd(),
      organizationJsonLd(),
      webApplicationJsonLd(),
      websiteJsonLd(),
      faqPageJsonLd(),
    ],
  };
}
