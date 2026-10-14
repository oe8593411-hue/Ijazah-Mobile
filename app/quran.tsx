import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, ScrollView } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SURAHS } from "../src/quran/surahs";

const C = {
  navy: "#071A33",
  navySoft: "#102B49",
  cyan: "#35C7DE",
  cyanPale: "#E5F8FC",
  surface: "#F4F8FC",
  ink: "#142A43",
  muted: "#788BA0",
  line: "#E0EAF2",
  white: "#FFFFFF",
};

function normalizeDigits(value: string) {
  return value.replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

export default function Quran() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = normalizeDigits(query.trim().toLowerCase());
    if (!q) return SURAHS;
    return SURAHS.filter(surah =>
      surah.nameAr.includes(query.trim()) ||
      String(surah.number) === q ||
      String(surah.number).padStart(3, "0") === q
    );
  }, [query]);

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="العودة" onPress={() => router.back()} style={s.backButton}>
          <Text style={s.back}>‹</Text>
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.eyebrow}>مَسَاحَتُكَ مَعَ الْقُرْآن</Text>
          <Text style={s.title}>فهرس السور</Text>
          <Text style={s.meta}>المصحف الشريف · رواية حفص عن عاصم</Text>
        </View>
        <View style={s.headerMark}><Text style={s.headerMarkText}>۞</Text></View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        <View style={s.intro}>
          <View style={s.introTop}>
            <View style={s.introIcon}><Text style={s.introIconText}>۞</Text></View>
            <View style={s.introCopy}>
              <Text style={s.introTitle}>بين يديك كتاب الله</Text>
              <Text style={s.introSub}>اختر سورة وابدأ رحلتك في التلاوة والمراجعة.</Text>
            </View>
          </View>
          <View style={s.stats}>
            <View style={s.stat}><Text style={s.statNumber}>١١٤</Text><Text style={s.statLabel}>سورة</Text></View>
            <View style={s.statDivider} />
            <View style={s.stat}><Text style={s.statNumber}>٦٬٢٣٦</Text><Text style={s.statLabel}>آية في المصدر المعتمد</Text></View>
            <View style={s.statDivider} />
            <View style={s.stat}><Text style={s.statNumber}>حفص</Text><Text style={s.statLabel}>الرواية الحالية</Text></View>
          </View>
        </View>

        <View style={s.searchHeading}>
          <Text style={s.sectionTitle}>جميع السور</Text>
          <Text style={s.resultCount}>{filtered.length} من ١١٤</Text>
        </View>
        <View style={s.searchBox}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="ابحث باسم السورة أو رقمها"
            placeholderTextColor={C.muted}
            style={s.input}
            textAlign="right"
            returnKeyType="search"
            accessibilityLabel="البحث في فهرس السور"
          />
          {query.length > 0 && <Pressable onPress={() => setQuery("")} style={s.clearButton}><Text style={s.clearText}>×</Text></Pressable>}
        </View>

        <View style={s.sourceNote}>
          <View style={s.sourceIcon}><Text style={s.sourceIconText}>✓</Text></View>
          <View style={s.sourceCopy}>
            <Text style={s.sourceTitle}>مرجع النص القرآني</Text>
            <Text style={s.sourceText}>Tanzil Uthmani 1.1 · النص ثابت ولا يُولَّد بالذكاء الاصطناعي.</Text>
          </View>
          <View style={s.sourcePill}><Text style={s.sourcePillText}>حفص</Text></View>
        </View>

        <View style={s.surahList}>
          {filtered.map((surah, index) => (
            <Pressable
              key={surah.number}
              accessibilityRole="button"
              accessibilityLabel={`سورة ${surah.nameAr}، ${surah.ayahCount} آية`}
              style={({ pressed }) => [s.item, pressed && s.itemPressed]}
              onPress={() => router.push({ pathname: "/surah", params: { number: String(surah.number) } })}
            >
              <View style={s.itemArrow}><Text style={s.arrow}>‹</Text></View>
              <View style={s.copy}>
                <Text style={s.name}>{surah.nameAr}</Text>
                <Text style={s.sub}>سورة رقم {surah.number}  ·  {surah.ayahCount} آية</Text>
              </View>
              <View style={s.numberFrame}>
                <View style={s.numberInner}><Text style={s.numText}>{String(surah.number).padStart(2, "0")}</Text></View>
              </View>
            </Pressable>
          ))}
        </View>

        {filtered.length === 0 && (
          <View style={s.empty}>
            <View style={s.emptyIcon}><Text style={s.emptyIconText}>⌕</Text></View>
            <Text style={s.emptyTitle}>لم نعثر على سورة بهذا الاسم</Text>
            <Text style={s.emptyText}>جرّب كتابة الاسم بشكل مختلف أو البحث برقم السورة.</Text>
            <Pressable onPress={() => setQuery("")} style={s.resetButton}><Text style={s.resetButtonText}>عرض جميع السور</Text></Pressable>
          </View>
        )}
        <Text style={s.footer}>إجازة · القرآن أولًا، والدقة دائمًا</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  header: { backgroundColor: C.navy, paddingTop: 54, paddingHorizontal: 18, paddingBottom: 27, flexDirection: "row", alignItems: "center", gap: 10 },
  backButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#173451", borderWidth: 1, borderColor: "#294760", alignItems: "center", justifyContent: "center" },
  back: { color: C.white, fontSize: 33, lineHeight: 36 },
  headerCenter: { flex: 1, alignItems: "center" },
  eyebrow: { color: C.cyan, fontSize: 8, fontWeight: "900", letterSpacing: 1.2, marginBottom: 5 },
  title: { color: C.white, fontSize: 23, fontWeight: "900" },
  meta: { color: "#A9C1D5", fontSize: 10, marginTop: 5 },
  headerMark: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#12304D", borderWidth: 1, borderColor: "#294760", alignItems: "center", justifyContent: "center" },
  headerMarkText: { color: C.cyan, fontSize: 25 },
  content: { paddingHorizontal: 17, paddingTop: 18, paddingBottom: 35 },
  intro: { backgroundColor: C.white, borderRadius: 24, padding: 17, borderWidth: 1, borderColor: C.line, marginBottom: 22, shadowColor: C.navy, shadowOpacity: 0.035, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  introTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  introIcon: { width: 48, height: 48, borderRadius: 17, backgroundColor: C.cyanPale, alignItems: "center", justifyContent: "center" },
  introIconText: { color: "#168DA5", fontSize: 27 },
  introCopy: { flex: 1, alignItems: "flex-end" },
  introTitle: { color: C.ink, fontSize: 16, fontWeight: "900", textAlign: "right" },
  introSub: { color: C.muted, fontSize: 10, marginTop: 5, textAlign: "right", lineHeight: 17 },
  stats: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", marginTop: 17, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#EDF2F7" },
  stat: { flex: 1, alignItems: "center", gap: 4 },
  statNumber: { color: C.navy, fontSize: 16, fontWeight: "900" },
  statLabel: { color: C.muted, fontSize: 9, textAlign: "center" },
  statDivider: { height: 30, width: 1, backgroundColor: C.line },
  searchHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingHorizontal: 2 },
  sectionTitle: { color: C.ink, fontSize: 17, fontWeight: "900" },
  resultCount: { color: C.muted, fontSize: 10, fontWeight: "700" },
  searchBox: { minHeight: 52, backgroundColor: C.white, borderRadius: 16, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: C.line, marginBottom: 12 },
  searchIcon: { fontSize: 25, color: "#1AA6BD", width: 30, textAlign: "center" },
  input: { flex: 1, minHeight: 50, color: C.ink, fontSize: 12, paddingHorizontal: 8 },
  clearButton: { width: 28, height: 28, borderRadius: 10, backgroundColor: "#EEF4F8", alignItems: "center", justifyContent: "center" },
  clearText: { color: C.muted, fontSize: 20, lineHeight: 23 },
  sourceNote: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#EAF7FC", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "#D5EDF5", marginBottom: 12 },
  sourceIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: "#D1F0F7", alignItems: "center", justifyContent: "center" },
  sourceIconText: { color: "#168DA5", fontSize: 15, fontWeight: "900" },
  sourceCopy: { flex: 1, alignItems: "flex-end" },
  sourceTitle: { color: "#17657B", fontSize: 10, fontWeight: "900", textAlign: "right" },
  sourceText: { color: "#527789", fontSize: 9, lineHeight: 15, marginTop: 3, textAlign: "right" },
  sourcePill: { backgroundColor: C.white, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9 },
  sourcePillText: { color: "#17657B", fontSize: 9, fontWeight: "900" },
  surahList: { gap: 8 },
  item: { backgroundColor: C.white, borderRadius: 17, paddingVertical: 11, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#E8EEF4" },
  itemPressed: { backgroundColor: "#F0FBFD", borderColor: "#9ADFEA" },
  itemArrow: { width: 25, height: 34, alignItems: "center", justifyContent: "center" },
  arrow: { color: "#6C9AAF", fontSize: 25 },
  copy: { flex: 1, alignItems: "flex-end", paddingRight: 2 },
  name: { color: C.ink, fontSize: 17, fontWeight: "900", textAlign: "right" },
  sub: { color: C.muted, fontSize: 9, marginTop: 5, textAlign: "right" },
  numberFrame: { width: 43, height: 43, borderRadius: 14, backgroundColor: "#E6F7FB", alignItems: "center", justifyContent: "center", transform: [{ rotate: "45deg" }] },
  numberInner: { width: 35, height: 35, borderRadius: 11, backgroundColor: "#D4F1F7", alignItems: "center", justifyContent: "center", transform: [{ rotate: "-45deg" }] },
  numText: { color: "#137E95", fontSize: 11, fontWeight: "900" },
  empty: { backgroundColor: C.white, borderRadius: 22, padding: 25, alignItems: "center", borderWidth: 1, borderColor: C.line, marginTop: 8 },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: C.cyanPale, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyIconText: { color: "#168DA5", fontSize: 27 },
  emptyTitle: { color: C.ink, fontSize: 14, fontWeight: "900", textAlign: "center" },
  emptyText: { color: C.muted, fontSize: 10, lineHeight: 18, marginTop: 6, textAlign: "center" },
  resetButton: { marginTop: 14, backgroundColor: C.navy, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  resetButtonText: { color: C.white, fontSize: 10, fontWeight: "900" },
  footer: { color: C.muted, fontSize: 9, textAlign: "center", marginTop: 22 },
});
