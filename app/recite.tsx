import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function Recite() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.kicker}>AI RECITATION</Text>
        <Text style={styles.title}>التلاوة والتصحيح</Text>
        <Text style={styles.text}>
          هذه الواجهة هي الأساس لنظام تحليل التلاوة. لن نعرض نتيجة من الذكاء الاصطناعي
          قبل ربط التسجيل بمحرك تحقق متخصص للقرآن.
        </Text>
        <View style={styles.status}>
          <Text style={styles.statusTitle}>جاهز للتسجيل</Text>
          <Text style={styles.statusText}>سيتم إضافة التسجيل الآمن والتحليل الصوتي في المرحلة التالية.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#071A2B" },
  container: { flex: 1, padding: 24, justifyContent: "center" },
  kicker: { color: "#27C7E8", fontWeight: "800", letterSpacing: 2, textAlign: "right" },
  title: { color: "#FFFFFF", fontSize: 30, fontWeight: "800", textAlign: "right", marginTop: 10 },
  text: { color: "#B8D2DB", fontSize: 16, lineHeight: 27, textAlign: "right", marginTop: 14 },
  status: { marginTop: 28, padding: 20, borderRadius: 20, backgroundColor: "#0D2B40", borderWidth: 1, borderColor: "#1B5870" },
  statusTitle: { color: "#EAFBFF", fontSize: 19, fontWeight: "700", textAlign: "right" },
  statusText: { color: "#86AAB7", lineHeight: 23, textAlign: "right", marginTop: 7 }
});