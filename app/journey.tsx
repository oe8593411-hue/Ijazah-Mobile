import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { usePreferences } from "../src/preferences";

const C = {
  navy: "#071A33",
  cyan: "#35C7DE",
  gold: "#D5AA53",
  paper: "#F4F8FC",
  ink: "#142A43",
  muted: "#788BA0",
  white: "#FFFFFF",
};

export default function Journey() {
  const { language, dark } = usePreferences();
  const english = language !== "ar";
  const t = (ar: string, en: string) => english ? en : ar;
  const bg = dark ? "#0D2A3D" : C.paper;
  const surface = dark ? "#102B49" : C.white;
  const ink = dark ? "#F3FAFD" : C.ink;
  const muted = dark ? "#A8D8EF" : C.muted;

  const choices = [
    {
      number: "01",
      icon: "♫",
      title: t("السماع", "Listen"),
      subtitle: t("استمع إلى السور واختر القارئ الذي تحبّه.", "Listen to Quran surahs and choose your favorite reciter."),
      detail: t("استمع الآن", "Listen now"),
      route: "/listen" as const,
      tone: "#168DA5",
      tint: "#E5F8FC",
    },
    {
      number: "02",
      icon: "🎙",
      title: t("التسميع", "Recitation practice"),
      subtitle: t("سمّع ما حفظته وراجع المقارنة النصية المتاحة.", "Recite from memory and review the available text comparison."),
      detail: t("ابدأ التسميع", "Start reciting"),
      route: "/recite" as const,
      tone: "#4F7FB2",
      tint: "#EAF1FC",
    },
    {
      number: "03",
      icon: "۞",
      title: t("القراءة", "Read Quran"),
      subtitle: t("تصفّح سور القرآن الكريم وآياته من مصدر موثّق.", "Browse Quran surahs and ayahs from a verified text source."),
      detail: t("افتح المصحف", "Open Quran"),
      route: "/quran" as const,
      tone: "#A57A2C",
      tint: "#F8F0DE",
    },
  ];

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <StatusBar style={dark ? "light" : "dark"} />
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("رجوع", "Go back")} onPress={() => router.back()} style={s.backButton}>
            <Text style={s.backText}>{english ? "←" : "→"}</Text>
          </Pressable>
          <View style={s.brandMark}><Text style={s.brandMarkText}>۞</Text></View>
        </View>

        <View style={s.intro}>
          <Text style={s.eyebrow}>{t("رحلتك مع القرآن", "YOUR QURAN JOURNEY")}</Text>
          <Text style={[s.title, { color: ink }]}>{t("من أين تحب أن تبدأ؟", "Where would you like to begin?")}</Text>
          <Text style={[s.subtitle, { color: muted }]}>{t("اختر خطوتك التالية، واجعل للقرآن نصيبًا من يومك.", "Choose your next step and make room for Quran in your day.")}</Text>
        </View>

        <View style={s.choiceList}>
          {choices.map((item) => (
            <Pressable
              key={item.number}
              accessibilityRole="button"
              onPress={() => router.push(item.route)}
              style={({ pressed }) => [s.choiceCard, { backgroundColor: surface, borderColor: dark ? "#245C7B" : "#E0EAF2", opacity: pressed ? 0.88 : 1 }]}
            >
              <View style={[s.iconBox, { backgroundColor: item.tint }]}>
                <Text style={[s.icon, { color: item.tone }]}>{item.icon}</Text>
              </View>
              <View style={s.choiceCopy}>
                <View style={s.choiceTitleRow}>
                  <Text style={[s.choiceTitle, { color: ink }]}>{item.title}</Text>
                  <Text style={[s.number, { color: item.tone }]}>{item.number}</Text>
                </View>
                <Text style={[s.choiceSubtitle, { color: muted }]}>{item.subtitle}</Text>
                <Text style={[s.choiceAction, { color: item.tone }]}>{item.detail}  {english ? "→" : "←"}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/premium")}
          style={({ pressed }) => [s.premiumCard, { opacity: pressed ? 0.92 : 1 }]}
        >
          <View style={s.premiumHeader}>
            <View style={s.crownBox}><Text style={s.crown}>♛</Text></View>
            <View style={s.premiumPill}><Text style={s.premiumPillText}>{t("اكتشف بريميوم", "DISCOVER PREMIUM")}</Text></View>
          </View>
          <Text style={s.premiumTitle}>{t("ارتقِ برحلتك القرآنية ✨", "Take your Quran journey further ✨")}</Text>
          <Text style={s.premiumDescription}>{t("تجربة أكثر تخصيصًا، وأدوات لمراجعة الحفظ، واختبارات تساعدك على الاستمرار بثبات.", "A more personal experience, memorization review tools, and quizzes designed to help you stay consistent.")}</Text>
          <View style={s.premiumBottom}>
            <Text style={s.premiumButtonText}>{t("اكتشف خطة بريميوم", "Explore Premium")}</Text>
            <Text style={s.premiumArrow}>{english ? "→" : "←"}</Text>
          </View>
          <Text style={s.premiumFootnote}>{t("تعرّف على المزايا قبل اتخاذ قرارك.", "Explore the features before deciding.")}</Text>
          <View style={s.glow} />
        </Pressable>

        <Text style={[s.footer, { color: muted }]}>{t("كل خطوة مع القرآن لها قيمة.", "Every step with the Quran matters.")}</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { width: "100%", maxWidth: 780, alignSelf: "center", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 42 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
  backButton: { width: 43, height: 43, borderRadius: 15, backgroundColor: "#E5F8FC", alignItems: "center", justifyContent: "center" },
  backText: { color: "#168DA5", fontSize: 25, fontWeight: "900" },
  brandMark: { width: 43, height: 43, borderRadius: 15, backgroundColor: C.navy, alignItems: "center", justifyContent: "center" },
  brandMarkText: { color: C.gold, fontSize: 27, fontWeight: "900" },
  intro: { alignItems: "flex-end", marginBottom: 23 },
  eyebrow: { color: "#168DA5", fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginBottom: 8 },
  title: { fontSize: 28, lineHeight: 38, fontWeight: "900", textAlign: "right" },
  subtitle: { fontSize: 13, lineHeight: 22, textAlign: "right", marginTop: 7, maxWidth: 560 },
  choiceList: { gap: 12 },
  choiceCard: { borderRadius: 22, borderWidth: 1, padding: 17, flexDirection: "row", alignItems: "center", gap: 15, minHeight: 132, shadowColor: "#071A33", shadowOpacity: 0.035, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  iconBox: { width: 58, height: 58, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 29, fontWeight: "800" },
  choiceCopy: { flex: 1, alignItems: "stretch" },
  choiceTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  choiceTitle: { fontSize: 18, fontWeight: "900", textAlign: "right" },
  number: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  choiceSubtitle: { fontSize: 11, lineHeight: 18, textAlign: "right", marginTop: 6 },
  choiceAction: { fontSize: 11, fontWeight: "900", textAlign: "right", marginTop: 9 },
  premiumCard: { backgroundColor: C.navy, borderRadius: 26, padding: 21, marginTop: 18, overflow: "hidden", borderWidth: 1, borderColor: "#1A4B70" },
  premiumHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  crownBox: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#163A55", alignItems: "center", justifyContent: "center" },
  crown: { color: C.gold, fontSize: 25 },
  premiumPill: { backgroundColor: "#193E58", paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20 },
  premiumPillText: { color: C.gold, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  premiumTitle: { color: C.white, fontSize: 23, lineHeight: 32, fontWeight: "900", textAlign: "right", marginTop: 16 },
  premiumDescription: { color: "#D1E5EE", fontSize: 12, lineHeight: 21, textAlign: "right", marginTop: 8 },
  premiumBottom: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: C.gold, borderRadius: 15, paddingVertical: 13, paddingHorizontal: 15, marginTop: 17 },
  premiumButtonText: { color: C.navy, fontSize: 12, fontWeight: "900" },
  premiumArrow: { color: C.navy, fontSize: 17, fontWeight: "900" },
  premiumFootnote: { color: "#AFCBDD", fontSize: 10, textAlign: "center", marginTop: 11 },
  glow: { position: "absolute", width: 130, height: 130, borderRadius: 65, backgroundColor: "#247CA5", opacity: 0.14, left: -50, bottom: -65 },
  footer: { textAlign: "center", fontSize: 10, marginTop: 22 },
});
