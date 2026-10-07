export type TajweedRule = {
  id: string;
  name: string;
  description: string;
  requiresAcousticEvidence: boolean;
};

export const TAJWEED_RULES: TajweedRule[] = [
  { id: "madd", name: "المد", description: "تحليل مقدار المد من الدليل الصوتي.", requiresAcousticEvidence: true },
  { id: "ghunnah", name: "الغنة", description: "تحليل الغنة من الإشارة الصوتية.", requiresAcousticEvidence: true },
  { id: "qalqalah", name: "القلقلة", description: "تحليل القلقلة عند مواضعها من المرجع.", requiresAcousticEvidence: true },
  { id: "ikhfa", name: "الإخفاء", description: "التحقق من الإخفاء وفق السياق المرجعي والدليل الصوتي.", requiresAcousticEvidence: true },
  { id: "idgham", name: "الإدغام", description: "التحقق من الإدغام وفق الموضع المرجعي والدليل الصوتي.", requiresAcousticEvidence: true },
  { id: "iqlab", name: "الإقلاب", description: "التحقق من الإقلاب وفق الموضع المرجعي والدليل الصوتي.", requiresAcousticEvidence: true },
  { id: "izhar", name: "الإظهار", description: "التحقق من الإظهار وفق الموضع المرجعي والدليل الصوتي.", requiresAcousticEvidence: true },
  { id: "tafkhim", name: "التفخيم", description: "تحليل صفات التفخيم من الأدلة الصوتية المناسبة.", requiresAcousticEvidence: true },
  { id: "tarqiq", name: "الترقيق", description: "تحليل صفات الترقيق من الأدلة الصوتية المناسبة.", requiresAcousticEvidence: true },
];
