export const CATEGORIES = [
  {
    id: 'emotional-appeal',
    name: 'جمال يلمس القلب',
    promptTopic: 'Emotional appeal for women — you deserve beautiful decor',
    promptDesc: 'Speak to how the customer deserves more than basic decor',
  },
  {
    id: 'factory-direct',
    name: 'من المصنع لبيتك',
    promptTopic: 'Factory direct to your home',
    promptDesc: 'Quality from factory, fair prices, no middlemen',
  },
  {
    id: 'room-transform',
    name: 'غيّر شكل المكان',
    promptTopic: 'Transform your space',
    promptDesc: 'Ask about plants corner, living room, or entrance — M&U is the solution',
  },
  {
    id: 'custom-order',
    name: 'تصميم على المقاس',
    promptTopic: 'Custom made to order',
    promptDesc: 'Choose color and size — every piece is customized',
  },
  {
    id: 'delivery',
    name: 'توصيل لحد الباب',
    promptTopic: 'Doorstep delivery',
    promptDesc: 'Delivery to your door plus order review before receiving',
  },
  {
    id: 'modern-decor',
    name: 'ديكور مودرن',
    promptTopic: 'Modern decor',
    promptDesc: 'Trendy pots that fit all tastes and spaces',
  },
  {
    id: 'plants-corner',
    name: 'ركن الزرع',
    promptTopic: 'Plants corner makeover',
    promptDesc: 'Beautify balcony, plants corner, or small garden',
  },
  {
    id: 'salon-decor',
    name: 'ديكور الصالون',
    promptTopic: 'Living room decor',
    promptDesc: 'Feminine elegant touch for salon and guests',
  },
  {
    id: 'entrance-decor',
    name: 'مدخل البيت',
    promptTopic: 'Home entrance decor',
    promptDesc: 'First impression matters — entrance and reception area',
  },
  {
    id: 'order-cta',
    name: 'اطلبي دلوقتي',
    promptTopic: 'Order now CTA',
    promptDesc: 'Focus on contact and ordering via WhatsApp or page message',
  },
];

export const FORMAT_ANGLES = [
  { name: 'سؤال يشد الانتباه', prompt: 'Question hook (want to change your space?)' },
  { name: 'خطاف عاطفي', prompt: 'Emotional hook (you deserve...)' },
  { name: 'مميزات المنتج', prompt: 'Product benefits in short bullet points' },
  { name: 'من المصنع مباشرة', prompt: 'Factory direct angle' },
  { name: 'تصميم حسب الطلب', prompt: 'Custom order (color + size)' },
  { name: 'توصيل ومراجعة', prompt: 'Delivery and order review before receiving' },
  { name: 'سؤال عن مكان', prompt: 'Question about home area (plants corner / salon / entrance)' },
  { name: 'نداء للعمل', prompt: 'Call to action (contact us / message us / order now)' },
  { name: 'لمسة أنثوية', prompt: 'Feminine decor touch' },
  { name: 'جودة وثقة', prompt: 'Quality and trust angle' },
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
  const angle = FORMAT_ANGLES[Math.floor(Math.random() * FORMAT_ANGLES.length)];

  return {
    category,
    formatAngle: angle.name,
    formatAnglePrompt: angle.prompt,
  };
}
