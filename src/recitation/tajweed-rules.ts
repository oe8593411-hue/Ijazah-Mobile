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

// Reference data for the Hafs rules, from the tajweed notes the user attached on 2026-11-27. Durations are in
// harakat (movement units), not seconds: they depend on the reader's pace, and the muttasil, munfasil and silah
// kubra values follow the Shatibiyyah reading of Hafs, as the notes say. Data only: the matcher never reads it and
// no mistake is reported from it. The letter sets in findExpectedTajweedChecks must agree with these lists.
export const TAJWEED_REFERENCE = {
  madd: {
    natural: [2],             // المد الطبيعي
    muttasil: [4, 5],         // المد المتصل
    munfasil: [4, 5],         // المد المنفصل
    lazim: [6],               // المد اللازم
    aridSukun: [2, 4, 6],     // المد العارض للسكون
    badal: [2],               // مد البدل
    silahSughra: [2],         // مد الصلة الصغرى
    silahKubra: [4, 5],       // مد الصلة الكبرى
    liinAridSukun: [2, 4, 6], // مد اللين العارض للسكون
  },
  ghunnahHarakat: 2,          // النون والميم المشددتان، والإخفاء، والإدغام بغنة، والإقلاب، وإخفاء الميم وإدغامها
  idghamLetters: ["ي", "ر", "م", "ل", "و", "ن"],  // يرملون
  idghamBiGhunnah: ["ي", "ن", "م", "و"],           // ينمو
  idghamBilaGhunnah: ["ل", "ر"],
  idghamShafawi: ["م"],       // ميم ساكنة قبل ميم
  ikhfaLetters: ["ص", "ذ", "ث", "ك", "ج", "ش", "ق", "س", "د", "ط", "ز", "ف", "ت", "ض", "ظ"], // 15 letters
  ikhfaShafawi: ["ب"],        // ميم ساكنة قبل باء
  iqlab: ["ب"],               // نون ساكنة أو تنوين قبل باء
  izharHalqi: ["ء", "ه", "ع", "ح", "غ", "خ"],
  izharShafawiExcept: ["م", "ب"], // ميم ساكنة قبل كل حرف ما عدا هذين
  qalqalahLetters: ["ق", "ط", "ب", "ج", "د"],     // قطب جد
};

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
    const currentLetters = Array.from(token).filter(ch => /[\u0621-\u064A]/u.test(ch));
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

    if (currentLetters.some(ch => QALQALAH_LETTERS.has(ch)) && new RegExp("[قطبجد]" + SUKUN, "u").test(token)) {
      add("qalqalah", i, "حرف قلقلة عليه سكون ظاهر — موضع مرشح للمراجعة");
    }

    if (/[اويٰ]/u.test(token)) add("madd", i, "وجود حرف مد/علامة ألف خنجرية — مقدار المد لا يُعرف من النص وحده");
  }

  return checks.slice(0, 80);
}
