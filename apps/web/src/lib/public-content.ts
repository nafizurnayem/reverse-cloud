export type LocalizedText = { en: string; bn: string }

export type ServiceContent = {
  slug: string
  title: LocalizedText
  summary: LocalizedText
  detail: LocalizedText
}

export type PortfolioContent = {
  slug: string
  title: LocalizedText
  summary: LocalizedText
  consent: 'placeholder'
}

export type BlogContent = {
  slug: string
  title: LocalizedText
  summary: LocalizedText
  body: LocalizedText[]
}

export const services: ServiceContent[] = [
  { slug: 'web-development', title: { en: 'Web development', bn: 'ওয়েব ডেভেলপমেন্ট' }, summary: { en: 'Placeholder service description for a fast, accessible web experience.', bn: 'দ্রুত ও সহজপ্রাপ্য ওয়েব অভিজ্ঞতার জন্য প্লেসহোল্ডার সেবা বিবরণ।' }, detail: { en: 'Replace this placeholder with approved service scope, delivery approach, and supporting content.', bn: 'অনুমোদিত সেবার পরিধি, কাজের পদ্ধতি ও সহায়ক বিষয়বস্তু দিয়ে এই প্লেসহোল্ডারটি প্রতিস্থাপন করুন।' } },
  { slug: 'agentic-ai', title: { en: 'Agentic AI', bn: 'এজেন্টিক এআই' }, summary: { en: 'Placeholder service description for workflow-connected AI systems.', bn: 'ওয়ার্কফ্লোর সঙ্গে যুক্ত এআই সিস্টেমের জন্য প্লেসহোল্ডার সেবা বিবরণ।' }, detail: { en: 'Replace this placeholder with approved capabilities and responsible-use guidance.', bn: 'অনুমোদিত সক্ষমতা ও দায়িত্বশীল ব্যবহারের নির্দেশনা দিয়ে এই প্লেসহোল্ডারটি প্রতিস্থাপন করুন।' } },
  { slug: 'automation', title: { en: 'Automation', bn: 'অটোমেশন' }, summary: { en: 'Placeholder service description for reducing repetitive operational work.', bn: 'পুনরাবৃত্তিমূলক কাজ কমানোর জন্য প্লেসহোল্ডার সেবা বিবরণ।' }, detail: { en: 'Replace this placeholder with approved workflow examples and boundaries.', bn: 'অনুমোদিত ওয়ার্কফ্লো উদাহরণ ও সীমা দিয়ে এই প্লেসহোল্ডারটি প্রতিস্থাপন করুন।' } },
  { slug: 'python-engineering', title: { en: 'Python engineering', bn: 'পাইথন ইঞ্জিনিয়ারিং' }, summary: { en: 'Placeholder service description for services, pipelines, and internal tools.', bn: 'সেবা, পাইপলাইন ও অভ্যন্তরীণ টুলের জন্য প্লেসহোল্ডার সেবা বিবরণ।' }, detail: { en: 'Replace this placeholder with approved engineering scope and technology notes.', bn: 'অনুমোদিত ইঞ্জিনিয়ারিং পরিধি ও প্রযুক্তি নোট দিয়ে এই প্লেসহোল্ডারটি প্রতিস্থাপন করুন।' } },
  { slug: 'web-scraping', title: { en: 'Web scraping', bn: 'ওয়েব স্ক্র্যাপিং' }, summary: { en: 'Placeholder service description for reliable data collection.', bn: 'নির্ভরযোগ্য ডেটা সংগ্রহের জন্য প্লেসহোল্ডার সেবা বিবরণ।' }, detail: { en: 'Replace this placeholder with approved data-source and compliance details.', bn: 'অনুমোদিত ডেটা উৎস ও কমপ্লায়েন্স বিবরণ দিয়ে এই প্লেসহোল্ডারটি প্রতিস্থাপন করুন।' } },
  { slug: 'technical-strategy', title: { en: 'Technical strategy', bn: 'টেকনিক্যাল স্ট্র্যাটেজি' }, summary: { en: 'Placeholder service description for shaping a practical technical path.', bn: 'বাস্তবসম্মত প্রযুক্তিগত পথ তৈরির জন্য প্লেসহোল্ডার সেবা বিবরণ।' }, detail: { en: 'Replace this placeholder with approved discovery and planning deliverables.', bn: 'অনুমোদিত আবিষ্কার ও পরিকল্পনা ডেলিভারেবল দিয়ে এই প্লেসহোল্ডারটি প্রতিস্থাপন করুন।' } },
]

export const portfolio: PortfolioContent[] = [
  { slug: 'operations-platform', title: { en: 'Operations platform placeholder', bn: 'অপারেশনস প্ল্যাটফর্ম প্লেসহোল্ডার' }, summary: { en: 'Placeholder portfolio entry pending approved client and outcome details.', bn: 'অনুমোদিত ক্লায়েন্ট ও ফলাফলের বিবরণের অপেক্ষায় থাকা প্লেসহোল্ডার পোর্টফোলিও এন্ট্রি।' }, consent: 'placeholder' },
  { slug: 'knowledge-workspace', title: { en: 'Knowledge workspace placeholder', bn: 'নলেজ ওয়ার্কস্পেস প্লেসহোল্ডার' }, summary: { en: 'Placeholder portfolio entry pending approved project details.', bn: 'অনুমোদিত প্রকল্প বিবরণের অপেক্ষায় থাকা প্লেসহোল্ডার পোর্টফোলিও এন্ট্রি।' }, consent: 'placeholder' },
]

export const blogPosts: BlogContent[] = [
  { slug: 'reliable-ai-workflows', title: { en: 'Designing reliable AI workflows', bn: 'নির্ভরযোগ্য এআই ওয়ার্কফ্লো ডিজাইন' }, summary: { en: 'Placeholder editorial summary pending approved publication content.', bn: 'অনুমোদিত প্রকাশনা বিষয়বস্তুর অপেক্ষায় থাকা প্লেসহোল্ডার সম্পাদকীয় সারাংশ।' }, body: [{ en: 'This is placeholder editorial content. Replace it with an approved article before publishing.', bn: 'এটি প্লেসহোল্ডার সম্পাদকীয় বিষয়বস্তু। প্রকাশের আগে অনুমোদিত নিবন্ধ দিয়ে প্রতিস্থাপন করুন।' }] },
  { slug: 'practical-automation', title: { en: 'A practical guide to automation', bn: 'অটোমেশনের একটি বাস্তব নির্দেশিকা' }, summary: { en: 'Placeholder editorial summary pending approved publication content.', bn: 'অনুমোদিত প্রকাশনা বিষয়বস্তুর অপেক্ষায় থাকা প্লেসহোল্ডার সম্পাদকীয় সারাংশ।' }, body: [{ en: 'This is placeholder editorial content. Replace it with an approved article before publishing.', bn: 'এটি প্লেসহোল্ডার সম্পাদকীয় বিষয়বস্তু। প্রকাশের আগে অনুমোদিত নিবন্ধ দিয়ে প্রতিস্থাপন করুন।' }] },
]

export function localized(value: LocalizedText, locale: string) {
  return locale === 'bn' ? value.bn : value.en
}
