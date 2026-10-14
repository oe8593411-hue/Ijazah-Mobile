import { useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";

const C = {
  ink: "#174765",
  green: "#328DB8",
  greenDeep: "#123B55",
  mint: "#E5F5FC",
  mint2: "#F1FAFE",
  gold: "#C69A42",
  paper: "#F7F5EE",
  white: "#FFFFFF",
  muted: "#627F90",
  line: "#D8EAF2",
  purple: "#5C9CC2",
  blue: "#B78A37",
};

export default function Home() {
  const [dark, setDark] = useState(false);
  const [english, setEnglish] = useState(false);
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const t = (ar: string, en: string) => english ? en : ar;
  const bg = dark ? "#0D2A3D" : C.paper;
  const surface = dark ? "#123B55" : C.white;
  const text = dark ? "#F3FAFD" : C.ink;
  const muted = dark ? "#A8D8EF" : C.muted;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <StatusBar style={dark ? "light" : "dark"} />
      <ScrollView contentContainerStyle={[s.content, wide && s.wideContent]}>
        <View style={s.header}>
          <View style={s.brand}>
            <View style={s.logo}><Text style={s.logoMark}>إ</Text><View style={s.logoBook} /></View>
            <View>
              <Text style={[s.brandName, { color: text }]}>{t("إجازة", "IJAAZAH")}</Text>
              <Text style={[s.brandSub, { color: muted }]}>{t("الأكاديمية الإلكترونية للقرآن", "ONLINE QURAN ACADEMY")}</Text>
            </View>
          </View>
          <View style={s.controls}>
            <Pressable accessibilityLabel="Language" onPress={() => setEnglish(!english)} style={[s.control, { backgroundColor: surface, borderColor: dark ? "#245C7B" : C.line }]}>
              <Text style={[s.controlText, { color: text }]}>{english ? "عربي" : "EN"}</Text>
            </Pressable>
            <Pressable accessibilityLabel="Toggle appearance" onPress={() => setDark(!dark)} style={[s.control, { backgroundColor: surface, borderColor: dark ? "#245C7B" : C.line }]}>
              <Text style={s.controlText}>{dark ? "☀️" : "☾"}</Text>
            </Pressable>
            <View style={s.avatar}><Text style={s.avatarText}>ع</Text></View>
          </View>
        </View>

        <View style={[s.welcomeRow, wide && s.welcomeWide]}>
          <View style={s.welcomeCopy}>
            <Text style={[s.eyebrow, { color: C.green }]}>{t("بِسْمِ اللَّهِ", "YOUR QURAN SPACE")}</Text>
            <Text style={[s.greeting, { color: text }]}>{t("السلام عليكم 👋", "Assalamu Alaikum 👋")}</Text>
            <Text style={[s.intro, { color: muted }]}>{t("خطوة صغيرة كل يوم، وأثر يبقى مدى العمر.", "A small step every day. A lifelong impact.")}</Text>
          </View>
          <View style={[s.ornament, wide && s.ornamentWide]}>
            <View style={s.orbitOne} />
            <View style={s.orbitTwo} />
            <Text style={s.bookEmoji}>📖</Text>
            <View style={s.sparkle}><Text style={s.sparkleText}>✦</Text></View>
          </View>
        </View>

        <View style={[s.streakPanel, { backgroundColor: dark ? "#123B55" : "#FFFFFF", borderColor: dark ? "#245C7B" : "#D8EAF2" }]}>
          <View style={s.streakHead}>
            <View style={s.streakBadge}><Text style={s.streakBadgeText}>✦</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[s.streakTitle, { color: text }]}>{t("خطوتك اليوم", "YOUR DAILY JOURNEY")}</Text>
              <Text style={[s.streakSubtitle, { color: muted }]}>{t("ابدأ بالقليل، وداوم عليه", "Start small. Stay consistent.")}</Text>
            </View>
            <View style={s.streakCount}><Text style={s.streakCountNum}>١</Text><Text style={s.streakCountLabel}>{t("جلسة", "SESSION")}</Text></View>
          </View>
          <View style={s.streakTrack}><View style={s.streakTrackFill} /></View>
          <View style={s.streakFoot}><Text style={[s.streakFootText, { color: muted }]}>{t("هدف مقترح: ١٠ دقائق قرآن اليوم", "Suggested goal: 10 minutes of Quran today")}</Text><Text style={s.streakFootMark}>بِسْمِ اللَّهِ</Text></View>
        </View>

        <View style={[s.mainGrid, wide && s.mainGridWide]}>
          <View style={[s.primaryColumn, wide && { flex: 1.2 }]}>
            <View style={s.hero}>
              <View style={s.heroTop}>
                <View style={s.livePill}><View style={s.liveDot} /><Text style={s.liveText}>{t("ورد اليوم", "TODAY'S WIRD")}</Text></View>
                <Text style={s.heroDecoration}>✧</Text>
              </View>
              <Text style={s.heroTitle}>{t("اجعل للقرآن موعدًا اليوم", "Make time for Quran today")}</Text>
              <Text style={s.heroSub}>{t("ابدأ التلاوة، وامضِ بثبات في رحلتك.", "Begin reciting and keep moving forward.")}</Text>
              <View style={s.heroBottom}>
                <View style={s.progressWrap}>
                  <View style={s.progressTrack}><View style={s.progressFill} /></View>
                  <Text style={s.progressLabel}>{t("رحلتك تبدأ بجلسة واحدة", "Your journey starts with one session")}</Text>
                </View>
                <View style={s.heroActions}>
                  <Pressable style={s.primaryButton} onPress={() => router.push("/recite")}><Text style={s.primaryButtonText}>{t("ابدأ التسميع  ←", "Start reciting  →")}</Text></Pressable>
                  <Pressable style={s.listenButton} onPress={() => router.push("/listen")}><Text style={s.listenButtonText}>{t("استمع للقرآن  ♫", "Listen to Quran  ♫")}</Text></Pressable>
                </View>
              </View>
              <View style={s.heroGlow} />
            </View>

            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: text }]}>{t("مساحتك اليومية", "Your daily space")}</Text>
              <Text style={[s.sectionHint, { color: muted }]}>{t("اختر من أين تبدأ", "Choose where to begin")}</Text>
            </View>
            <View style={s.actionGrid}>
              <Action title={t("القرآن الكريم", "The Holy Quran")} sub={t("تصفّح السور والآيات", "Browse surahs and ayahs")} icon="۞" tone="green" route="/quran" surface={surface} text={text} muted={muted} />
              <Action title={t("مراجعة الحفظ", "Review memorization")} sub={t("ثبّت ما حفظته", "Strengthen what you know")} icon="↻" tone="purple" route="/smart-test" surface={surface} text={text} muted={muted} />
              <Action title={t("أحكام التجويد", "Tajweed rules")} sub={t("تعلّم خطوة بخطوة", "Learn step by step")} icon="✧" tone="gold" route="/tajweed" surface={surface} text={text} muted={muted} />
              <Action title={t("تقدّمي", "My progress")} sub={t("تابع رحلتك وإنجازاتك", "Track your journey")} icon="◔" tone="blue" route="/progress" surface={surface} text={text} muted={muted} />
            </View>
          </View>

          <View style={[s.sideColumn, wide && { flex: 0.8 }]}>
            <View style={[s.dailyCard, { backgroundColor: surface, borderColor: dark ? "#245C7B" : C.line }]}>
              <View style={s.dailyHeader}><Text style={s.dailyIcon}>☀</Text><Text style={[s.dailyTitle, { color: text }]}>{t("وقفة اليوم", "A moment for today")}</Text></View>
              <Text style={[s.dailyArabic, { color: text }]}>{t("وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا", "Recite the Quran with measured recitation")}</Text>
              <Text style={[s.dailyRef, { color: muted }]}>{t("سورة المزمل · ٤", "Al-Muzzammil · 4")}</Text>
              <View style={s.goldLine} />
              <Text style={[s.dailyNote, { color: muted }]}>{t("خذ وقتك في التلاوة، فالجودة والطمأنينة أهم من السرعة.", "Take your time. Presence and care matter more than speed.")}</Text>
            </View>

            <Pressable style={s.premium} onPress={() => router.push("/premium")}>
              <View style={s.premiumTop}><Text style={s.premiumCrown}>♛</Text><Text style={s.premiumLabel}>IJAZAH PREMIUM</Text></View>
              <Text style={s.premiumTitle}>{t("رحلة أعمق، بخطتك أنت", "A deeper journey, your way")}</Text>
              <Text style={s.premiumSub}>{t("اختبارات مخصصة • مراجعة ذكية • أدوات متقدمة", "Personalized tests • Smart review • Advanced tools")}</Text>
              <View style={s.premiumLink}><Text style={s.premiumLinkText}>{t("اكتشف المزايا  ←", "Explore features  →")}</Text></View>
            </Pressable>

            <View style={[s.trustCard, { backgroundColor: dark ? "#102746" : C.mint2 }]}>
              <Text style={s.trustIcon}>✓</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.trustTitle, { color: text }]}>{t("القرآن أولًا", "Quran comes first")}</Text>
                <Text style={[s.trustSub, { color: muted }]}>{t("نص موثّق وتجربة مصممة باحترام ووضوح.", "Verified text and a thoughtful, transparent experience.")}</Text>
              </View>
            </View>
          </View>
        </View>
        <Text style={[s.footer, { color: muted }]}>إجازة · {t("خطوتك القادمة تبدأ الآن", "Your next step starts now")}</Text>
      </ScrollView>
    </View>
  );
}

function Action({ title, sub, icon, tone, route, surface, text, muted }: {
  title: string; sub: string; icon: string; tone: "green" | "purple" | "gold" | "blue";
  route: "/quran" | "/smart-test" | "/tajweed" | "/progress";
  surface: string; text: string; muted: string;
}) {
  const tones = { green: "#328DB8", purple: "#5C9CC2", gold: "#B78A37", blue: "#C69A42" };
  const pale = { green: "#EAF7FC", purple: "#E5F5FC", gold: "#EAF7FC", blue: "#EAF7FC" };
  return (
    <Pressable style={[s.actionCard, { backgroundColor: surface, borderColor: "#D8EAF2" }]} onPress={() => router.push(route)}>
      <View style={[s.actionIconBox, { backgroundColor: pale[tone] }]}><Text style={[s.actionIcon, { color: tones[tone] }]}>{icon}</Text></View>
      <Text style={[s.actionTitle, { color: text }]}>{title}</Text>
      <Text style={[s.actionSub, { color: muted }]}>{sub}</Text>
      <Text style={[s.actionArrow, { color: tones[tone] }]}>↗</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  streakPanel: { borderRadius: 22, padding: 17, marginBottom: 22, borderWidth: 1, shadowColor: "#174765", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  streakHead: { flexDirection: "row", alignItems: "center", gap: 11 },
  streakBadge: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#F4EBD7", alignItems: "center", justifyContent: "center" },
  streakBadgeText: { color: "#A57A2C", fontSize: 22, fontWeight: "900" },
  streakTitle: { fontSize: 13, fontWeight: "900", textAlign: "right" },
  streakSubtitle: { fontSize: 10, marginTop: 4, textAlign: "right" },
  streakCount: { minWidth: 52, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 13, backgroundColor: "#E5F5FC", alignItems: "center" },
  streakCountNum: { color: "#328DB8", fontSize: 18, fontWeight: "900" },
  streakCountLabel: { color: "#5C9CC2", fontSize: 8, fontWeight: "800", marginTop: 1 },
  streakTrack: { height: 6, backgroundColor: "#DCEEF6", borderRadius: 8, overflow: "hidden", marginTop: 16 },
  streakTrackFill: { width: "18%", height: 6, borderRadius: 8, backgroundColor: "#C69A42" },
  streakFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 10 },
  streakFootText: { fontSize: 10, textAlign: "right", flex: 1 },
  streakFootMark: { color: "#A57A2C", fontSize: 10, fontWeight: "900" },
  content: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 40, maxWidth: 1120, width: "100%", alignSelf: "center" },
  wideContent: { paddingHorizontal: 34, paddingTop: 30 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 28 },
  brand: { flexDirection: "row", alignItems: "center", gap: 11 },
  logo: { width: 47, height: 47, borderRadius: 16, backgroundColor: C.green, alignItems: "center", justifyContent: "center", shadowColor: C.greenDeep, shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  logoMark: { color: "#FFFFFF", fontSize: 27, fontWeight: "900" },
  logoBook: { position: "absolute", bottom: 8, width: 25, height: 7, borderTopWidth: 2, borderColor: "#B7E8F6", transform: [{ rotate: "-8deg" }] },
  brandName: { fontSize: 21, fontWeight: "900", textAlign: "right" },
  brandSub: { fontSize: 10, marginTop: 2, textAlign: "right" },
  controls: { flexDirection: "row", alignItems: "center", gap: 7 },
  control: { height: 39, minWidth: 39, paddingHorizontal: 9, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  controlText: { color: C.ink, fontSize: 12, fontWeight: "900" },
  avatar: { width: 39, height: 39, borderRadius: 14, backgroundColor: C.mint, alignItems: "center", justifyContent: "center", marginLeft: 2 },
  avatarText: { color: C.green, fontWeight: "900", fontSize: 16 },
  welcomeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 24, minHeight: 118 },
  welcomeWide: { paddingHorizontal: 6, minHeight: 150 },
  welcomeCopy: { flex: 1, alignItems: "flex-end" },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginBottom: 7 },
  greeting: { fontSize: 27, fontWeight: "900", textAlign: "right" },
  intro: { fontSize: 12, lineHeight: 20, textAlign: "right", marginTop: 6 },
  ornament: { width: 102, height: 102, borderRadius: 34, backgroundColor: C.mint, alignItems: "center", justifyContent: "center", overflow: "hidden", transform: [{ rotate: "-5deg" }] },
  ornamentWide: { width: 128, height: 128, borderRadius: 42 },
  orbitOne: { position: "absolute", width: 92, height: 92, borderWidth: 1, borderColor: "#7ABED8", borderRadius: 28, transform: [{ rotate: "35deg" }] },
  orbitTwo: { position: "absolute", width: 67, height: 67, borderWidth: 1, borderColor: "#B7E8F6", borderRadius: 23, transform: [{ rotate: "55deg" }] },
  bookEmoji: { fontSize: 39 },
  sparkle: { position: "absolute", top: 9, right: 10, width: 24, height: 24, borderRadius: 12, backgroundColor: C.gold, alignItems: "center", justifyContent: "center" },
  sparkleText: { color: "#FFFFFF", fontSize: 14 },
  mainGrid: { gap: 22 },
  mainGridWide: { flexDirection: "row", alignItems: "flex-start", gap: 24 },
  primaryColumn: { flex: 1 },
  sideColumn: { gap: 14, marginTop: 0 },
  hero: { backgroundColor: C.greenDeep, borderRadius: 28, padding: 23, minHeight: 255, overflow: "hidden", borderWidth: 1, borderColor: "#246A8C" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, backgroundColor: "#164B6A" },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#80D6F0" },
  liveText: { color: "#B7E8F6", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  heroDecoration: { color: "#C69A42", fontSize: 32 },
  heroTitle: { color: "#FFFFFF", fontSize: 25, lineHeight: 35, fontWeight: "900", textAlign: "right", marginTop: 16, maxWidth: 430, alignSelf: "flex-end" },
  heroSub: { color: "#C5E4F1", fontSize: 12, lineHeight: 20, textAlign: "right", marginTop: 8 },
  heroBottom: { marginTop: 20, gap: 14 },
  progressWrap: { gap: 8 },
  progressTrack: { height: 5, backgroundColor: "#246A8C", borderRadius: 5, overflow: "hidden" },
  progressFill: { width: "8%", height: 5, backgroundColor: "#C69A42", borderRadius: 5 },
  progressLabel: { color: "#B7D7E8", fontSize: 10, textAlign: "right" },
  heroActions: { flexDirection: "row", flexWrap: "wrap", gap: 9, justifyContent: "flex-end" },
  primaryButton: { backgroundColor: "#C69A42", paddingVertical: 13, paddingHorizontal: 16, borderRadius: 14, alignSelf: "flex-end" },
  primaryButtonText: { color: "#174765", fontSize: 12, fontWeight: "900" },
  listenButton: { borderColor: "#80D6F0", borderWidth: 1, paddingVertical: 12, paddingHorizontal: 15, borderRadius: 14, alignSelf: "flex-end" },
  listenButtonText: { color: "#E7F7FD", fontSize: 12, fontWeight: "900" },
  heroGlow: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "#247CA5", opacity: 0.35, right: -92, top: 54 },
  sectionHeader: { marginTop: 26, marginBottom: 13, gap: 4, alignItems: "flex-end" },
  sectionTitle: { fontSize: 18, fontWeight: "900" },
  sectionHint: { fontSize: 11 },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  actionCard: { width: "48%", minHeight: 145, borderRadius: 21, padding: 15, borderWidth: 1, overflow: "hidden" },
  actionIconBox: { width: 43, height: 43, borderRadius: 15, alignItems: "center", justifyContent: "center", alignSelf: "flex-end" },
  actionIcon: { fontSize: 25, fontWeight: "700" },
  actionTitle: { fontSize: 13, fontWeight: "900", textAlign: "right", marginTop: 11 },
  actionSub: { fontSize: 10, textAlign: "right", marginTop: 5, lineHeight: 16 },
  actionArrow: { fontSize: 16, fontWeight: "900", position: "absolute", bottom: 13, left: 14 },
  dailyCard: { borderRadius: 23, padding: 19, borderWidth: 1 },
  dailyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  dailyIcon: { color: C.gold, fontSize: 20 },
  dailyTitle: { fontSize: 15, fontWeight: "900" },
  dailyArabic: { fontSize: 21, fontWeight: "900", textAlign: "center", lineHeight: 38, marginTop: 18 },
  dailyRef: { fontSize: 10, textAlign: "center", marginTop: 7 },
  goldLine: { height: 1, backgroundColor: "#A8DDED", width: 54, alignSelf: "center", marginTop: 15 },
  dailyNote: { fontSize: 11, lineHeight: 19, textAlign: "center", marginTop: 13 },
  premium: { backgroundColor: "#174765", borderRadius: 23, padding: 20, borderWidth: 1, borderColor: "#1A4B70" },
  premiumTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  premiumCrown: { color: "#C69A42", fontSize: 24 },
  premiumLabel: { color: "#C69A42", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  premiumTitle: { color: "#FFFFFF", fontSize: 19, fontWeight: "900", textAlign: "right", marginTop: 13, lineHeight: 28 },
  premiumSub: { color: "#D1E5EE", fontSize: 11, lineHeight: 18, textAlign: "right", marginTop: 7 },
  premiumLink: { backgroundColor: "#C69A42", borderRadius: 13, padding: 12, marginTop: 15, alignItems: "center" },
  premiumLinkText: { color: "#174765", fontSize: 11, fontWeight: "900" },
  trustCard: { borderRadius: 18, padding: 15, flexDirection: "row", alignItems: "center", gap: 12 },
  trustIcon: { width: 31, height: 31, borderRadius: 16, overflow: "hidden", textAlign: "center", textAlignVertical: "center", backgroundColor: "#E5F5FC", color: "#328DB8", fontWeight: "900", fontSize: 18, paddingTop: 4 },
  trustTitle: { fontSize: 12, fontWeight: "900", textAlign: "right" },
  trustSub: { fontSize: 10, lineHeight: 16, textAlign: "right", marginTop: 3 },
  footer: { fontSize: 10, textAlign: "center", marginTop: 28 }
});
