export type TajweedRule = {
  id: string;
  name: string;
  description: string;
  requiresAcousticEvidence: boolean;
};

export type ExpectedTajweedCheck = {
  ruleId: string;
  ruleName: string;
  wordIndex: number;
  token: string;
  context: string;
  evidenceType: "textual_candidate_only";
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

const ruleById = new Map(TAJWEED_RULES.map(rule => [rule.id, rule]));
const NOON_IDGHAM = new Set(["ي", "ر", "م", "ل", "و", "ن"]);
const IKHFA_LETTERS = new Set(["ت", "ث", "ج", "د", "ذ", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ف", "ق", "ك"]);
const IZHAR_LETTERS = new Set(["ء", "ه", "ع", "ح", "غ", "خ"]);
const QALQALAH_LETTERS = new Set(["ق", "ط", "ب", "ج", "د"]);
const TANWEEN = /[ًٌٍ]/u;
const SUKUN = "ْ";

function firstArabicLetter(token: string) {
  return Array.from(token).find(ch => /[\u0621-\u064A]/u.test(ch)) || "";
}
function lastArabicLetter(token: string) {
  return Array.from(token).reverse().find(ch => /[\u0621-\u064A]/u.test(ch)) || "";
}

/**
 * Finds only places where a rule may need to be checked from the verified
 * Hafs reference. This is NOT an audio judgement and must never be rendered
 * as a detected recitation mistake.
 */
export function findExpectedTajweedChecks(referenceText: string): ExpectedTajweedCheck[] {
  const tokens = referenceText.split(/\s+/u).filter(Boolean);
  const checks: ExpectedTajweedCheck[] = [];
  const add = (ruleId: string, wordIndex: number, context: string) => {
    const rule = ruleById.get(ruleId);
    const token = tokens[wordIndex] || "";
    if (!rule || checks.some(x => x.ruleId === ruleId && x.wordIndex === wordIndex && x.context === context)) return;
    checks.push({ ruleId, ruleName: rule.name, wordIndex: wordIndex + 1, token, context, evidenceType: "textual_candidate_only" });
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const next = tokens[i + 1] || "";
    const nextFirst = firstArabicLetter(next);
    const last = lastArabicLetter(token);

    // Noon sakinah / tanween followed by the next word's initial letter.
    const hasNoonSakinah = /نْ/u.test(token);
    const hasTanween = TANWEEN.test(token);
    if ((hasNoonSakinah || hasTanween) && nextFirst) {
      if (nextFirst === "ب") add("iqlab", i, "نون ساكنة/تنوين قبل باء — موضع مرشح للمراجعة");
      else if (NOON_IDGHAM.has(nextFirst)) add("idgham", i, "نون ساكنة/تنوين قبل حرف من يرملون — موضع مرشح للمراجعة");
      else if (IZHAR_LETTERS.has(nextFirst)) add("izhar", i, "نون ساكنة/تنوين قبل حرف حلقي — موضع مرشح للمراجعة");
      else if (IKHFA_LETTERS.has(nextFirst)) add("ikhfa", i, "نون ساكنة/تنوين قبل حرف من حروف الإخفاء — موضع مرشح للمراجعة");
    }

    if (/مْ/u.test(token) && nextFirst) {
      if (nextFirst === "ب") add("ikhfa", i, "ميم ساكنة قبل باء — إخفاء شفوي مرشح للمراجعة");
      if (nextFirst === "م") add("idgham", i, "ميم ساكنة قبل ميم — إدغام شفوي مرشح للمراجعة");
    }

    // Require the qalqalah letter itself to carry sukun; an unrelated qalqalah
    // letter elsewhere in the same word must not trigger a false candidate.
    if (new RegExp("[قطبجد]" + SUKUN, "u").test(token)) {
      add("qalqalah", i, "حرف قلقلة عليه سكون ظاهر — موضع مرشح للمراجعة");
    }

    if (/[اويٰ]/u.test(token)) add("madd", i, "وجود حرف مد/علامة ألف خنجرية — مقدار المد لا يُعرف من النص وحده");
  }

  return checks.slice(0, 80);
}
