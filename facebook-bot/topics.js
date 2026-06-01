export const CATEGORIES = [
  {
    id: 'emotional-appeal',
    name: 'جمال يلمس القلب',
    description: 'بوست عاطفي يخاطب السيدات — إنكِ تستاهلي ديكور يليق بيكِ',
  },
  {
    id: 'factory-direct',
    name: 'من المصنع لبيتك',
    description: 'جودة المصنع مباشرة، أسعار مناسبة، بدون وسطاء',
  },
  {
    id: 'room-transform',
    name: 'غيّر شكل المكان',
    description: 'سؤال عن ركن الزرع، الصالون، أو مدخل البيت — وM&U هو الحل',
  },
  {
    id: 'custom-order',
    name: 'تصميم على المقاس',
    description: 'اختيار اللون والمقاس حسب ذوق العميل — كل قطعة مخصصة',
  },
  {
    id: 'delivery',
    name: 'توصيل لحد الباب',
    description: 'توصيل لحد باب البيت + مراجعة الأوردر قبل الاستلام',
  },
  {
    id: 'modern-decor',
    name: 'ديكور مودرن',
    description: 'بوتات عصرية تناسب كل الأذواق والمساحات',
  },
  {
    id: 'plants-corner',
    name: 'ركن الزرع',
    description: 'تجميل ركن الزرع والبلكونة والحديقة الصغيرة',
  },
  {
    id: 'salon-decor',
    name: 'ديكور الصالون',
    description: 'لمسة أنثوية وأناقة للصالون واستقبال الضيوف',
  },
  {
    id: 'entrance-decor',
    name: 'مدخل البيت',
    description: 'أول انطباع ي counts — ديكور مدخل البيت وال reception',
  },
  {
    id: 'order-cta',
    name: 'اطلبي دلوقتي',
    description: 'بوست تركيز على التواصل والطلب — واتساب أو البيدج',
  },
];

export const FORMAT_ANGLES = [
  'سؤال يشد الانتباه (عايز/عايزة تغيّر...؟)',
  'خطاف عاطفي (أنتِ تستاهلي...)',
  'مميزات المنتج في نقاط قصيرة',
  'من المصنع مباشرة',
  'تصميم حسب الطلب (لون + مقاس)',
  'توصيل ومراجعة الأوردر',
  'سؤال عن مكان في البيت (ركن الزرع / الصالون / المدخل)',
  'نداء للعمل (تواصلي / ابعتلنا / اطلبي)',
  'لمسة أنثوية وديكور ستات',
  'عرض جودة وثقة',
];

/**
 * Pick today's category by day index, avoiding the same category two days in a row.
 */
export function selectTopic(lastCategoryId = null, date = new Date()) {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - startOfYear) / (1000 * 60 * 60 * 24));
  let index = dayOfYear % CATEGORIES.length;

  if (lastCategoryId && CATEGORIES[index].id === lastCategoryId) {
    index = (index + 1) % CATEGORIES.length;
  }

  const category = CATEGORIES[index];
  const formatAngle =
    FORMAT_ANGLES[Math.floor(Math.random() * FORMAT_ANGLES.length)];

  return { category, formatAngle };
}
