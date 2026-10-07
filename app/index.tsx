import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

export default function Home() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.logoMark}>
          <Text style={styles.logoBook}>◫</Text>
        </View>
        <Text style={styles.arabic}>إجازة</Text>
        <Text style={styles.title}>IJAZAH</Text>
        <Text style={styles.subtitle}>Quran • Tajweed • Memorization</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>ابدأ رحلتك مع القرآن</Text>
          <Text style={styles.cardText}>
            اقرأ، احفظ، راجع، وسجّل تلاوتك مع نظام تحليل مصمم للقرآن والتجويد.
          </Text>
          <Pressable style={styles.button} onPress={() => router.push("/recite")}>
            <Text style={styles.buttonText}>ابدأ التلاوة</Text>
          </Pressable>
        </View>

        <View style={styles.features}>
          <Feature title="القرآن" text="قراءة ومتابعة" />
          <Feature title="الحفظ" text="حفظ ومراجعة" />
          <Feature title="التجويد" text="تعلم وتصحيح" />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.feature}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#071A2B" },
  container: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center" },
  logoMark: {
    width: 82, height: 82, borderRadius: 22, borderWidth: 2, borderColor: "#27C7E8",
    alignItems: "center", justifyContent: "center", marginBottom: 14
  },
  logoBook: { color: "#27C7E8", fontSize: 44 },
  arabic: { color: "#EAFBFF", fontSize: 36, fontWeight: "700", marginBottom: 2 },
  title: { color: "#27C7E8", fontSize: 25, fontWeight: "800", letterSpacing: 4 },
  subtitle: { color: "#A9C8D3", marginTop: 7, marginBottom: 34 },
  card: {
    width: "100%", borderRadius: 24, padding: 22, backgroundColor: "#0D2B40",
    borderWidth: 1, borderColor: "#1B5870"
  },
  cardTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "700", textAlign: "right" },
  cardText: { color: "#B8D2DB", fontSize: 15, lineHeight: 25, textAlign: "right", marginTop: 9 },
  button: { marginTop: 18, backgroundColor: "#27C7E8", borderRadius: 15, paddingVertical: 14, alignItems: "center" },
  buttonText: { color: "#061722", fontWeight: "800", fontSize: 16 },
  features: { width: "100%", flexDirection: "row", gap: 9, marginTop: 14 },
  feature: { flex: 1, backgroundColor: "#0B2437", borderRadius: 15, padding: 13, minHeight: 76 },
  featureTitle: { color: "#EAFBFF", fontWeight: "700", textAlign: "right" },
  featureText: { color: "#86AAB7", fontSize: 11, marginTop: 5, textAlign: "right" }
});