import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { usePreferences } from "../src/preferences";

const C = {
  navy: "#071A33",
  navy2: "#0D2A45",
  cyan: "#35C7DE",
  cyanPale: "#E5F8FC",
  gold: "#D5AA53",
  paper: "#F4F8FC",
  white: "#FFFFFF",
  ink: "#142A43",
  muted: "#788BA0",
  line: "#DFEAF2",
};

type Destination = "/listen" | "/recite" | "/quran";

export default function Home() {
  const { language, dark } = usePreferences();
  const { width } = useWindowDimensions();
  const english = language !== "ar";
  const wide = width >= 760;
  const t = (ar: string, en: string) => english ? en : ar;
  const bg = dark ? "#061525" : C.paper;
  const surface = dark ? "#102B43" : C.white;
  const ink = dark ? "#F4FAFD" : C.ink;
  const muted = dark ? "#A8C8D9" : C.muted;

  const options: {
    number: string; icon: string; title: string; description: string;
    action: string; route: Destination; accent: string; tint: string;
  }[] = [
    {
      number: "01", icon: "♫", title: t("استمع للقرآن", "Listen to Quran"),
      description: t("استمع إلى السور واختر القارئ الذي تحبّه.", "Listen to surahs and choose your favorite reciter."),
      action: t("ابدأ الاستماع", "Start listening"), route: "/listen",
      accent: "#168DA5", tint: "#E5F8FC",
    },
    {
      number: "02", icon: "◉", title: t("التسميع", "Recitation practice"),
      description: t("سمّع ما حفظته وراجع المقارنة النصية المتاحة.", "Recite from memory and review the available text comparison."),
      action: t("ابدأ التسميع", "Start reciting"), route: "/recite",
      accent: "#4F7FB2", tint: "#EAF1FC",
    },
    {
      number: "03", icon: "۞", title: t("اقرأ المصحف", "Read the Quran"),
      description: t("تصفّح السور والآيات من نص قرآني موثّق.", "Browse surahs and ayahs from a verified Quran text."),
      action: t("افتح المصحف", "Open Quran"), route: "/quran",
      accent: "#A57A2C", tint: "#F8F0DE",
    },
  ];

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <StatusBar style={dark ? "light" : "dark"} />
      <ScrollView contentContainerStyle={[s.content, wide && s.contentWide]}>
        <View style={s.brandRow}>
          <View style={s.brandCopy}>
            <Text style={[s.brandName, { color: ink }]}>{t("إجازة", "IJAAZAH")}</Text>
            <Text style={[s.brandSub, { color: muted }]}>{t("الأكاديمية الإلكترونية للقرآن الكريم", "ONLINE QURAN ACADEMY")}</Text>
          </View>
          <View style={s.logoFrame}>
            <Image source={require("../Ijazah profile picture.jpeg")} style={s.logo} resizeMode="contain" accessibilityLabel="شعار إجازة" />
          </View>
        </View>

        <View style={[s.hero, wide && s.heroWide]}>
          <View style={s.heroGlowOne} />
          <View style={s.heroGlowTwo} />
          <View style={s.heroText}>
            <View style={s.heroBadge}>
              <Text style={s.heroBadgeText}>{t("رحلتك مع القرآن تبدأ هنا", "YOUR QURAN JOURNEY STARTS HERE")}</Text>
            </View>
            <Text style={s.heroTitle}>{t("اجعل القرآن رفيق يومك", "Make the Quran part of your day")}</Text>
            <Text style={s.heroSubtitle}>{t("اقرأ، واستمع، وسمّع محفوظك — في مساحة هادئة صُمّمت لتقرّبك من كتاب الله.", "Read, listen, and recite from memory in a calm space designed to bring you closer to the Quran.")}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push("/journey")} style={({ pressed }) => [s.heroButton, { opacity: pressed ? 0.86 : 1 }]}>
              <Text style={s.heroButtonText}>{t("ابدأ رحلتك", "Begin your journey")}</Text>
              <Text style={s.heroButtonArrow}>{english ? "→" : "←"}</Text>
            </Pressable>
          </View>
          <View style={s.heroArt}>
            <View style={s.artRingOuter} />
            <View style={s.artRingInner} />
            <View style={s.bookPlate}>
              <Text style={s.bookMark}>۞</Text>
              <View style={s.bookLine} />
              <View style={s.bookLineShort} />
            </View>
            <Text style={s.artSparkle}>✦</Text>
            <Text style={s.artArabic}>وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا</Text>
          </View>
        </View>

        <View style={s.sectionHeading}>
          <View style={{ flex: 1 }}>
            <Text style={[s.sectionTitle, { color: ink }]}>{t("اختر خطوتك التالية", "Choose your next step")}</Text>
            <Text style={[s.sectionSubtitle, { color: muted }]}>{t("كل طريق يقودك إلى صحبة أقرب مع القرآن.", "Every path brings you closer to the Quran.")}</Text>
          </View>
          <View style={s.sectionMark}><Text style={s.sectionMarkText}>✦</Text></View>
        </View>

        <View style={[s.optionsGrid, wide && s.optionsGridWide]}>
          {options.map((item) => (
            <Pressable key={item.number} accessibilityRole="button" onPress={() => router.push(item.route)}
              style={({ pressed }) => [s.optionCard, { backgroundColor: surface, borderColor: dark ? "#21445E" : C.line, opacity: pressed ? 0.88 : 1 }, wide && s.optionCardWide]}>
              <View style={s.optionTop}>
                <Text style={[s.optionNumber, { color: item.accent }]}>{item.number}</Text>
                <View style={[s.optionIconWrap, { backgroundColor: item.tint }]}>
                  <Text style={[s.optionIcon, { color: item.accent }]}>{item.icon}</Text>
                </View>
              </View>
              <Text style={[s.optionTitle, { color: ink }]}>{item.title}</Text>
              <Text style={[s.optionDescription, { color: muted }]}>{item.description}</Text>
              <View style={s.optionActionRow}>
                <Text style={[s.optionAction, { color: item.accent }]}>{item.action}</Text>
                <Text style={[s.optionArrow, { color: item.accent }]}>{english ? "→" : "←"}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Pressable accessibilityRole="button" onPress={() => router.push("/premium")}
          style={({ pressed }) => [s.premiumCard, { opacity: pressed ? 0.9 : 1 }]}>
          <View style={s.premiumGlow} />
          <View style={s.premiumTop}>
            <View style={s.crownWrap}><Text style={s.crown}>♛</Text></View>
            <View style={s.premiumPill}><Text style={s.premiumPillText}>{t("تجربة مميزة", "PREMIUM EXPERIENCE")}</Text></View>
          </View>
          <Text style={s.premiumTitle}>{t("ارتقِ برحلتك القرآنية", "Take your Quran journey further")}</Text>
          <Text style={s.premiumDescription}>{t("اكتشف أدوات مراجعة الحفظ والاختبارات المخصصة والمزايا المتقدمة المتاحة في بريميوم.", "Discover memorization review tools, personalized quizzes, and advanced Premium features.")}</Text>
          <View style={s.premiumButton}>
            <Text style={s.premiumButtonText}>{t("اكتشف بريميوم", "Explore Premium")}</Text>
            <Text style={s.premiumButtonArrow}>{english ? "→" : "←"}</Text>
          </View>
        </Pressable>

        <View style={s.trustRow}>
          <View style={s.trustIcon}><Text style={s.trustCheck}>✓</Text></View>
          <Text style={[s.trustText, { color: muted }]}>{t("نص القرآن من مصدر موثّق، وليس مولّدًا بالذكاء الاصطناعي.", "Quran text comes from a verified source, not AI-generated text.")}</Text>
        </View>
        <Text style={[s.footer, { color: muted }]}>إجازة · {t("كل خطوة مع القرآن لها قيمة", "Every step with the Quran matters")}</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { width: "100%", maxWidth: 1080, alignSelf: "center", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 44 },
  contentWide: { paddingHorizontal: 34, paddingTop: 25 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 13, marginBottom: 22 },
  brandCopy: { alignItems: "flex-end" },
  brandName: { fontSize: 23, fontWeight: "900", letterSpacing: 0.4 },
  brandSub: { fontSize: 9, fontWeight: "700", letterSpacing: 0.7, marginTop: 3, textAlign: "right" },
  logoFrame: { width: 64, height: 64, borderRadius: 21, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DCEAF2", alignItems: "center", justifyContent: "center", shadowColor: "#071A33", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  logo: { width: 55, height: 55, borderRadius: 16 },
  hero: { minHeight: 300, backgroundColor: C.navy, borderRadius: 30, padding: 23, overflow: "hidden", flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#1B4A68", marginBottom: 28 },
  heroWide: { minHeight: 320, padding: 34, gap: 25 },
  heroGlowOne: { position: "absolute", width: 250, height: 250, borderRadius: 125, backgroundColor: "#168DA5", opacity: 0.22, right: -95, top: -105 },
  heroGlowTwo: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "#D5AA53", opacity: 0.09, left: -85, bottom: -95 },
  heroText: { flex: 1, alignItems: "flex-end", zIndex: 1 },
  heroBadge: { borderRadius: 20, backgroundColor: "#153B55", paddingHorizontal: 11, paddingVertical: 8, borderWidth: 1, borderColor: "#245573", marginBottom: 13 },
  heroBadgeText: { color: "#9FE8F2", fontSize: 9, fontWeight: "900", letterSpacing: 0.6, textAlign: "right" },
  heroTitle: { color: "#FFFFFF", fontSize: 27, lineHeight: 38, fontWeight: "900", textAlign: "right", maxWidth: 430 },
  heroSubtitle: { color: "#C8E0EC", fontSize: 12, lineHeight: 21, textAlign: "right", marginTop: 9, maxWidth: 460 },
  heroButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: C.gold, paddingVertical: 13, paddingHorizontal: 17, borderRadius: 15, marginTop: 19, alignSelf: "flex-end" },
  heroButtonText: { color: C.navy, fontSize: 12, fontWeight: "900" },
  heroButtonArrow: { color: C.navy, fontSize: 17, fontWeight: "900" },
  heroArt: { width: 130, alignItems: "center", justifyContent: "center", minHeight: 200 },
  artRingOuter: { position: "absolute", width: 124, height: 124, borderRadius: 40, borderWidth: 1, borderColor: "#4BAFC4", transform: [{ rotate: "45deg" }] },
  artRingInner: { position: "absolute", width: 94, height: 94, borderRadius: 31, borderWidth: 1, borderColor: "#D5AA53", transform: [{ rotate: "20deg" }] },
  bookPlate: { width: 75, height: 85, borderRadius: 23, backgroundColor: "#123A56", borderWidth: 1, borderColor: "#28637F", alignItems: "center", justifyContent: "center" },
  bookMark: { color: C.gold, fontSize: 38, fontWeight: "800" },
  bookLine: { height: 2, width: 32, backgroundColor: "#8CDDE9", borderRadius: 2, marginTop: 2 },
  bookLineShort: { height: 2, width: 20, backgroundColor: "#8CDDE9", borderRadius: 2, marginTop: 4 },
  artSparkle: { position: "absolute", color: C.gold, fontSize: 22, top: 15, right: 8 },
  artArabic: { color: "#C8E0EC", fontSize: 10, textAlign: "center", marginTop: 22, lineHeight: 18 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 15 },
  sectionTitle: { fontSize: 20, lineHeight: 28, fontWeight: "900", textAlign: "right" },
  sectionSubtitle: { fontSize: 11, lineHeight: 18, textAlign: "right", marginTop: 3 },
  sectionMark: { width: 39, height: 39, borderRadius: 14, backgroundColor: "#E5F8FC", alignItems: "center", justifyContent: "center" },
  sectionMarkText: { color: "#168DA5", fontSize: 20, fontWeight: "900" },
  optionsGrid: { gap: 12 },
  optionsGridWide: { flexDirection: "row", alignItems: "stretch" },
  optionCard: { minHeight: 190, borderWidth: 1, borderRadius: 23, padding: 17, shadowColor: "#071A33", shadowOpacity: 0.035, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  optionCardWide: { flex: 1 },
  optionTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  optionNumber: { fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
  optionIconWrap: { width: 50, height: 50, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  optionIcon: { fontSize: 27, fontWeight: "900" },
  optionTitle: { fontSize: 17, fontWeight: "900", textAlign: "right", marginTop: 14 },
  optionDescription: { fontSize: 11, lineHeight: 18, textAlign: "right", marginTop: 6, flex: 1 },
  optionActionRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 14 },
  optionAction: { fontSize: 11, fontWeight: "900" },
  optionArrow: { fontSize: 17, fontWeight: "900" },
  premiumCard: { backgroundColor: C.navy, borderRadius: 26, padding: 22, marginTop: 18, overflow: "hidden", borderWidth: 1, borderColor: "#1A4B70" },
  premiumGlow: { position: "absolute", width: 170, height: 170, borderRadius: 85, backgroundColor: "#247CA5", opacity: 0.18, left: -75, bottom: -95 },
  premiumTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  crownWrap: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#163A55", alignItems: "center", justifyContent: "center" },
  crown: { color: C.gold, fontSize: 25 },
  premiumPill: { backgroundColor: "#193E58", paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20 },
  premiumPillText: { color: C.gold, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  premiumTitle: { color: C.white, fontSize: 22, lineHeight: 31, fontWeight: "900", textAlign: "right", marginTop: 15 },
  premiumDescription: { color: "#D1E5EE", fontSize: 12, lineHeight: 21, textAlign: "right", marginTop: 7, maxWidth: 700 },
  premiumButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: C.gold, borderRadius: 15, paddingVertical: 13, paddingHorizontal: 15, marginTop: 17, alignSelf: "flex-end" },
  premiumButtonText: { color: C.navy, fontSize: 12, fontWeight: "900" },
  premiumButtonArrow: { color: C.navy, fontSize: 17, fontWeight: "900" },
  trustRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 22, paddingHorizontal: 8 },
  trustIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#E5F8FC", alignItems: "center", justifyContent: "center" },
  trustCheck: { color: "#168DA5", fontSize: 15, fontWeight: "900" },
  trustText: { flex: 1, fontSize: 10, lineHeight: 16, textAlign: "right" },
  footer: { fontSize: 10, textAlign: "center", marginTop: 20 },
});
