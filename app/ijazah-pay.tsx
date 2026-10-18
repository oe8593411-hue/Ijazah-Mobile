import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";

const C = {
  navy: "#071A33",
  navy2: "#102746",
  cyan: "#35C7DE",
  bg: "#F4F8FC",
  ink: "#142A43",
  muted: "#788BA0",
  white: "#FFFFFF",
  line: "#DDE8F1",
  gold: "#F5D27A",
};

export default function IjazahPay() {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="رجوع" onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>‹</Text>
        </Pressable>
        <View style={s.brand}>
          <View style={s.logo}><Text style={s.logoText}>إ</Text></View>
          <View>
            <Text style={s.brandName}>IJAZAH PAY</Text>
            <Text style={s.brandSub}>الدفع والاشتراكات</Text>
          </View>
        </View>
        <View style={s.lock}><Text style={s.lockText}>🔒</Text></View>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.hero}>
          <View style={s.eyebrow}><Text style={s.eyebrowText}>دفع آمن • تجربة إجازة</Text></View>
          <Text style={s.heroTitle}>ادعم رحلتك مع القرآن</Text>
          <Text style={s.heroCopy}>إدارة الاشتراك ومزايا بريميوم من مكان واحد، بتجربة واضحة وآمنة.</Text>
          <View style={s.trustRow}>
            <View style={s.trustItem}><Text style={s.trustIcon}>✓</Text><Text style={s.trustText}>حالة اشتراك واضحة</Text></View>
            <View style={s.trustItem}><Text style={s.trustIcon}>✓</Text><Text style={s.trustText}>لا نخزّن بيانات بطاقتك</Text></View>
          </View>
        </View>

        <Text style={s.sectionTitle}>اختر فترة الاشتراك</Text>
        <View style={s.toggle}>
          <Pressable accessibilityRole="button" onPress={() => setPeriod("monthly")} style={[s.toggleOption, period === "monthly" && s.toggleActive]}>
            <Text style={[s.toggleText, period === "monthly" && s.toggleTextActive]}>شهري</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setPeriod("yearly")} style={[s.toggleOption, period === "yearly" && s.toggleActive]}>
            <Text style={[s.toggleText, period === "yearly" && s.toggleTextActive]}>سنوي</Text>
          </Pressable>
        </View>

        <View style={s.planCard}>
          <View style={s.planTop}>
            <View style={s.planMark}><Text style={s.planMarkText}>✦</Text></View>
            <View style={s.planCopy}>
              <Text style={s.planTitle}>إجازة بريميوم</Text>
              <Text style={s.planSub}>مزايا الحفظ والمراجعة المتقدمة</Text>
            </View>
            <View style={s.comingBadge}><Text style={s.comingText}>قريبًا</Text></View>
          </View>
          <View style={s.divider} />
          <View style={s.featureRow}><Text style={s.featureCheck}>✓</Text><Text style={s.featureText}>إدارة الاشتراك من حسابك</Text></View>
          <View style={s.featureRow}><Text style={s.featureCheck}>✓</Text><Text style={s.featureText}>إيصال واضح بعد تأكيد الدفع</Text></View>
          <View style={s.featureRow}><Text style={s.featureCheck}>✓</Text><Text style={s.featureText}>تأكيد المزايا من الخادم فقط</Text></View>
          <View style={s.priceArea}>
            <Text style={s.price}>{period === "monthly" ? "السعر الشهري سيُعلن لاحقًا" : "السعر السنوي سيُعلن لاحقًا"}</Text>
            <Text style={s.priceNote}>لن يتم خصم أي مبلغ في هذه المرحلة.</Text>
          </View>
        </View>

        <View style={s.notice}>
          <Text style={s.noticeTitle}>🔐 تجهيز الدفع الآمن</Text>
          <Text style={s.noticeText}>واجهة إجازة باي قيد الإنشاء. تفعيل الدفع يحتاج اختيار مزوّد مرخّص، وموافقة حساب التاجر، وربط تأكيد الدفع بالخادم. لن نعرض عملية دفع وهمية أو نطلب بيانات البطاقة داخل التطبيق.</Text>
        </View>

        <Pressable accessibilityRole="button" style={s.disabledButton} disabled>
          <Text style={s.disabledButtonText}>الدفع سيتاح بعد الربط الآمن</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={s.backHome} onPress={() => router.replace("/premium")}>
          <Text style={s.backHomeText}>العودة إلى بريميوم</Text>
        </Pressable>
        <Text style={s.foot}>اختيار الفترة هنا لا ينشئ اشتراكًا ولا يفعّل مزايا مدفوعة.</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { paddingTop: 54, paddingHorizontal: 18, paddingBottom: 18, backgroundColor: C.navy, flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 28, height: 42, justifyContent: "center" },
  backText: { color: C.white, fontSize: 34 },
  brand: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 40, height: 40, borderRadius: 14, backgroundColor: C.cyan, alignItems: "center", justifyContent: "center" },
  logoText: { color: C.navy, fontSize: 24, fontWeight: "900" },
  brandName: { color: C.white, fontSize: 14, fontWeight: "900", letterSpacing: 1.2 },
  brandSub: { color: "#AFC4D8", fontSize: 11, marginTop: 3 },
  lock: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#173654", alignItems: "center", justifyContent: "center" },
  lockText: { fontSize: 16 },
  content: { padding: 18, paddingBottom: 42 },
  hero: { backgroundColor: C.navy, borderRadius: 25, padding: 22, borderWidth: 1, borderColor: "#1A4A65" },
  eyebrow: { alignSelf: "flex-end", backgroundColor: "#173654", borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7 },
  eyebrowText: { color: C.cyan, fontSize: 10, fontWeight: "800" },
  heroTitle: { color: C.white, fontSize: 25, fontWeight: "900", textAlign: "right", marginTop: 19 },
  heroCopy: { color: "#B8C9D9", fontSize: 13, lineHeight: 22, textAlign: "right", marginTop: 9 },
  trustRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 20 },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  trustIcon: { color: C.cyan, fontWeight: "900", fontSize: 15 },
  trustText: { color: "#D9E8F4", fontSize: 10 },
  sectionTitle: { color: C.navy, fontSize: 17, fontWeight: "900", textAlign: "right", marginTop: 24, marginBottom: 12 },
  toggle: { backgroundColor: "#E8F0F7", padding: 4, borderRadius: 15, flexDirection: "row", marginBottom: 14 },
  toggleOption: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  toggleActive: { backgroundColor: C.navy },
  toggleText: { color: C.muted, fontSize: 13, fontWeight: "800" },
  toggleTextActive: { color: C.white },
  planCard: { backgroundColor: C.white, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: C.line },
  planTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  planMark: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#E5F8FC", alignItems: "center", justifyContent: "center" },
  planMarkText: { color: "#167E99", fontSize: 23 },
  planCopy: { flex: 1 },
  planTitle: { color: C.navy, fontSize: 15, fontWeight: "900", textAlign: "right" },
  planSub: { color: C.muted, fontSize: 10, textAlign: "right", marginTop: 4 },
  comingBadge: { backgroundColor: "#FFF5D9", borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6 },
  comingText: { color: "#805D11", fontSize: 10, fontWeight: "900" },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 17 },
  featureRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 9, marginBottom: 12 },
  featureCheck: { color: "#15839A", fontSize: 14, fontWeight: "900" },
  featureText: { color: C.ink, fontSize: 12 },
  priceArea: { marginTop: 6, backgroundColor: "#F3F8FC", borderRadius: 14, padding: 13, alignItems: "center" },
  price: { color: C.navy, fontSize: 13, fontWeight: "900" },
  priceNote: { color: C.muted, fontSize: 10, marginTop: 5 },
  notice: { backgroundColor: "#FFF8E6", borderWidth: 1, borderColor: "#F3DCA0", borderRadius: 17, padding: 15, marginTop: 16 },
  noticeTitle: { color: "#805D11", fontSize: 13, fontWeight: "900", textAlign: "right" },
  noticeText: { color: "#806F4C", fontSize: 11, lineHeight: 20, textAlign: "right", marginTop: 7 },
  disabledButton: { backgroundColor: "#C9D6E2", borderRadius: 16, padding: 16, alignItems: "center", marginTop: 17 },
  disabledButtonText: { color: "#52687D", fontWeight: "900", fontSize: 13 },
  backHome: { borderWidth: 1, borderColor: C.line, borderRadius: 15, padding: 14, alignItems: "center", marginTop: 10 },
  backHomeText: { color: C.navy, fontWeight: "800", fontSize: 12 },
  foot: { color: "#8794A3", fontSize: 10, lineHeight: 17, textAlign: "center", marginTop: 14 },
});
