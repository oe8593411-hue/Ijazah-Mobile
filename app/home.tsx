import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { usePreferences } from "../src/preferences";
import { SURAHS } from "../src/quran/surahs";

const C = {
  navy: "#071A33",
  navy2: "#102B49",
  blue: "#397BB5",
  cyan: "#35C7DE",
  paper: "#F5F8FC",
  white: "#FFFFFF",
  ink: "#142A43",
  muted: "#71849A",
  line: "#DFE8F1",
};

export default function Home() {
  const { language, dark } = usePreferences();
  const { width } = useWindowDimensions();
  const en = language !== "ar";
  const t = (ar: string, english: string) => en ? english : ar;
  const wide = width >= 760;
  const bg = dark ? "#061525" : C.paper;
  const card = dark ? "#102B43" : C.white;
  const ink = dark ? "#F4FAFD" : C.ink;
  const muted = dark ? "#A8C8D9" : C.muted;
  const featured = SURAHS[0];

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <StatusBar style={dark ? "light" : "dark"} />
      <ScrollView contentContainerStyle={[s.page, wide && s.pageWide]}>
        <View style={s.topbar}>
          <View style={s.brand}>
            <Image source={require("../Ijazah profile picture.jpeg")} style={s.logo} resizeMode="contain" accessibilityLabel="شعار إجازة" />
            <View>
              <Text style={[s.brandName, { color: ink }]}>{t("إجازة", "IJAAZAH")}</Text>
              <Text style={[s.brandSub, { color: muted }]}>{t("رحلتك مع القرآن", "YOUR QURAN COMPANION")}</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push("/quran")} style={s.indexButton}>
            <Text style={s.indexIcon}>☷</Text>
            <Text style={s.indexText}>{t("فهرس السور", "Surah index")}</Text>
          </Pressable>
        </View>

        <View style={[s.welcome, wide && s.welcomeWide]}>
          <View style={s.welcomeCopy}>
            <Text style={s.eyebrow}>{t("مساحة التلاوة والتسميع", "QURAN READING & RECITATION")}</Text>
            <Text style={s.title}>{t("عِش مع القرآن، آيةً آية", "Connect with the Quran, ayah by ayah")}</Text>
            <Text style={s.subtitle}>{t("اقرأ من المصحف الموثّق، أو سمّع محفوظك وراجع المقارنة النصية المتاحة.", "Read from a verified Quran text, or recite from memory and review the available text comparison.")}</Text>
            <View style={s.actions}>
              <Pressable accessibilityRole="button" onPress={() => router.push("/recite")} style={({ pressed }) => [s.primaryButton, pressed && s.pressed]}>
                <Text style={s.primaryButtonText}>{t("ابدأ التسميع", "Start reciting")}</Text>
                <Text style={s.buttonArrow}>{en ? "→" : "←"}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.push("/quran")} style={({ pressed }) => [s.secondaryButton, pressed && s.pressed, { borderColor: dark ? "#35536B" : C.line }]}>
                <Text style={[s.secondaryButtonText, { color: ink }]}>{t("افتح المصحف", "Read Quran")}</Text>
              </Pressable>
            </View>
          </View>
          <View style={s.verseCard}>
            <Text style={s.verseOrnament}>۞</Text>
            <Text style={s.verse}>{t("وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا", "وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا")}</Text>
            <View style={s.verseDivider} />
            <Text style={s.verseReference}>{t("سورة المزمل · ٤", "Al-Muzzammil · 4")}</Text>
          </View>
        </View>

        <View style={s.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[s.sectionTitle, { color: ink }]}>{t("تابع رحلتك", "Continue your journey")}</Text>
            <Text style={[s.sectionSub, { color: muted }]}>{t("اختر طريقة البدء المناسبة لك", "Choose how you would like to begin")}</Text>
          </View>
          <View style={s.liveDot} />
        </View>

        <View style={[s.featureGrid, wide && s.featureGridWide]}>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/surah", params: { number: String(featured.number) } })} style={({ pressed }) => [s.surahCard, { backgroundColor: card, borderColor: dark ? "#21445E" : C.line }, pressed && s.pressed]}>
            <View style={s.cardTop}>
              <View style={s.numberBadge}><Text style={s.numberBadgeText}>{String(featured.number).padStart(2, "0")}</Text></View>
              <Text style={s.cardSymbol}>۞</Text>
            </View>
            <Text style={[s.cardLabel, { color: muted }]}>{t("ابدأ القراءة", "START READING")}</Text>
            <Text style={[s.cardTitle, { color: ink }]}>{featured.nameAr}</Text>
            <Text style={[s.cardMeta, { color: muted }]}>{t("٧ آيات · رواية حفص", "7 ayahs · Hafs narration")}</Text>
            <View style={s.cardFooter}><Text style={s.cardAction}>{t("متابعة السورة", "Open surah")}</Text><Text style={s.cardArrow}>{en ? "→" : "←"}</Text></View>
          </Pressable>

          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/recite", params: { surah: "1", ayah: "1", scope: "surah" } })} style={({ pressed }) => [s.reciteCard, pressed && s.pressed]}>
            <View style={s.cardTop}>
              <View style={s.micBadge}><Text style={s.mic}>◉</Text></View>
              <Text style={s.reciteTag}>{t("تدريبك اليومي", "DAILY PRACTICE")}</Text>
            </View>
            <Text style={s.reciteTitle}>{t("سمّع سورة كاملة", "Recite a full surah")}</Text>
            <Text style={s.reciteDescription}>{t("سجّل تلاوتك وراجع النص المتعرّف عليه عند توفر التحليل.", "Record your recitation and review recognized text when analysis is available.")}</Text>
            <View style={s.reciteButton}><Text style={s.reciteButtonText}>{t("ابدأ جلسة التسميع", "Start a recitation session")}</Text><Text style={s.reciteButtonArrow}>{en ? "→" : "←"}</Text></View>
          </Pressable>
        </View>

        <View style={[s.toolsRow, { backgroundColor: card, borderColor: dark ? "#21445E" : C.line }]}>
          <Pressable accessibilityRole="button" onPress={() => router.push("/quran")} style={s.tool}>
            <View style={s.toolIcon}><Text style={s.toolGlyph}>۞</Text></View>
            <View style={s.toolCopy}><Text style={[s.toolTitle, { color: ink }]}>{t("فهرس المصحف", "Quran index")}</Text><Text style={[s.toolSub, { color: muted }]}>{t("١١٤ سورة", "114 surahs")}</Text></View>
            <Text style={[s.toolArrow, { color: muted }]}>{en ? "→" : "←"}</Text>
          </Pressable>
          <View style={[s.toolDivider, { backgroundColor: dark ? "#29475F" : C.line }]} />
          <Pressable accessibilityRole="button" onPress={() => router.push("/listen")} style={s.tool}>
            <View style={[s.toolIcon, s.listenIcon]}><Text style={s.toolGlyph}>♫</Text></View>
            <View style={s.toolCopy}><Text style={[s.toolTitle, { color: ink }]}>{t("استمع للتلاوة", "Listen to Quran")}</Text><Text style={[s.toolSub, { color: muted }]}>{t("السور والتسجيلات المتاحة", "Available surahs and audio")}</Text></View>
            <Text style={[s.toolArrow, { color: muted }]}>{en ? "→" : "←"}</Text>
          </Pressable>
        </View>

        <View style={s.sourceNote}>
          <Text style={s.sourceCheck}>✓</Text>
          <Text style={[s.sourceText, { color: muted }]}>{t("نص المصحف من Tanzil Uthmani 1.1 برواية حفص؛ لا يُنشأ بالذكاء الاصطناعي. تحليل التلاوة النصي مبدئي ولا يُعدّ حكمًا على التجويد.", "Quran text uses Tanzil Uthmani 1.1, Hafs narration. Text comparison is preliminary and does not certify tajweed.")}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  page: { width: "100%", maxWidth: 1080, alignSelf: "center", paddingHorizontal: 18, paddingTop: 16, paddingBottom: 40, gap: 22 },
  pageWide: { paddingHorizontal: 32, paddingTop: 24, gap: 25 },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 47, height: 47, borderRadius: 14, backgroundColor: "#FFFFFF" },
  brandName: { fontSize: 20, fontWeight: "900", textAlign: "right" },
  brandSub: { fontSize: 8, fontWeight: "800", letterSpacing: 1, marginTop: 3, textAlign: "right" },
  indexButton: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: "#E5F8FC" },
  indexIcon: { color: "#168DA5", fontSize: 18 },
  indexText: { color: "#126A82", fontSize: 10, fontWeight: "900" },
  welcome: { backgroundColor: C.navy, borderRadius: 27, padding: 22, gap: 22, overflow: "hidden", borderWidth: 1, borderColor: "#1B4A68" },
  welcomeWide: { flexDirection: "row", alignItems: "center", padding: 30, gap: 30 },
  welcomeCopy: { flex: 1, alignItems: "flex-end" },
  eyebrow: { color: C.cyan, fontSize: 9, fontWeight: "900", letterSpacing: 1.1, textAlign: "right" },
  title: { color: C.white, fontSize: 27, lineHeight: 37, fontWeight: "900", textAlign: "right", marginTop: 11 },
  subtitle: { color: "#C8E0EC", fontSize: 12, lineHeight: 21, textAlign: "right", marginTop: 8 },
  actions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 9, marginTop: 19, alignSelf: "flex-end" },
  primaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: C.cyan, borderRadius: 13, paddingHorizontal: 15, paddingVertical: 12 },
  primaryButtonText: { color: C.navy, fontSize: 11, fontWeight: "900" },
  buttonArrow: { color: C.navy, fontSize: 17, fontWeight: "900" },
  secondaryButton: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 15, paddingVertical: 12, backgroundColor: "rgba(255,255,255,0.04)" },
  secondaryButtonText: { fontSize: 11, fontWeight: "800" },
  verseCard: { minHeight: 170, borderRadius: 22, backgroundColor: "#102B49", borderWidth: 1, borderColor: "#2B5670", alignItems: "center", justifyContent: "center", padding: 17 },
  verseOrnament: { color: "#D5AA53", fontSize: 27 },
  verse: { color: "#FFFFFF", fontSize: 23, lineHeight: 39, textAlign: "center", marginTop: 5 },
  verseDivider: { width: 42, height: 2, backgroundColor: C.cyan, borderRadius: 2, marginTop: 12 },
  verseReference: { color: "#A9D9E5", fontSize: 10, marginTop: 9 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionTitle: { fontSize: 19, fontWeight: "900", textAlign: "right" },
  sectionSub: { fontSize: 11, textAlign: "right", marginTop: 4 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#35C7DE" },
  featureGrid: { gap: 13 },
  featureGridWide: { flexDirection: "row", alignItems: "stretch" },
  surahCard: { flex: 1, borderRadius: 22, padding: 18, borderWidth: 1, minHeight: 200 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  numberBadge: { width: 35, height: 35, borderRadius: 12, backgroundColor: "#E5F8FC", alignItems: "center", justifyContent: "center" },
  numberBadgeText: { color: "#168DA5", fontSize: 10, fontWeight: "900" },
  cardSymbol: { color: "#168DA5", fontSize: 28 },
  cardLabel: { fontSize: 8, fontWeight: "900", letterSpacing: 1, textAlign: "right", marginTop: 16 },
  cardTitle: { fontSize: 23, fontWeight: "900", textAlign: "right", marginTop: 5 },
  cardMeta: { fontSize: 10, textAlign: "right", marginTop: 5 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 18 },
  cardAction: { color: "#168DA5", fontSize: 11, fontWeight: "900" },
  cardArrow: { color: "#168DA5", fontSize: 17, fontWeight: "900" },
  reciteCard: { flex: 1, borderRadius: 22, padding: 18, minHeight: 200, backgroundColor: "#EAF3FC", borderWidth: 1, borderColor: "#D3E4F5" },
  micBadge: { width: 35, height: 35, borderRadius: 12, backgroundColor: "#D6E7F8", alignItems: "center", justifyContent: "center" },
  mic: { color: "#397BB5", fontSize: 22, fontWeight: "900" },
  reciteTag: { color: "#397BB5", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  reciteTitle: { color: "#142A43", fontSize: 21, fontWeight: "900", textAlign: "right", marginTop: 15 },
  reciteDescription: { color: "#607A92", fontSize: 11, lineHeight: 19, textAlign: "right", marginTop: 7 },
  reciteButton: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 15 },
  reciteButtonText: { color: "#285F98", fontSize: 11, fontWeight: "900" },
  reciteButtonArrow: { color: "#285F98", fontSize: 17, fontWeight: "900" },
  toolsRow: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14 },
  tool: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 12 },
  toolIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#E5F8FC", alignItems: "center", justifyContent: "center" },
  listenIcon: { backgroundColor: "#F8F0DE" },
  toolGlyph: { color: "#168DA5", fontSize: 23 },
  toolCopy: { flex: 1 },
  toolTitle: { fontSize: 12, fontWeight: "900", textAlign: "right" },
  toolSub: { fontSize: 10, marginTop: 4, textAlign: "right" },
  toolArrow: { fontSize: 17, fontWeight: "800" },
  toolDivider: { height: 1, marginHorizontal: 4 },
  sourceNote: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 4 },
  sourceCheck: { color: "#168DA5", fontSize: 16, fontWeight: "900" },
  sourceText: { flex: 1, fontSize: 10, lineHeight: 17, textAlign: "right" },
  pressed: { opacity: 0.82 },
});
