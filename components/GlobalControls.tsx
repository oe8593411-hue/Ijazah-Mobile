import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { APP_LANGUAGES, usePreferences } from "../src/preferences";

export default function GlobalControls() {
  const { language, setLanguage, dark, setDark } = usePreferences();
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const chosen = APP_LANGUAGES.find((item) => item.code === language) || APP_LANGUAGES[0];
  const bg = dark ? "#0D2238" : "#FFFFFF";
  const ink = dark ? "#F3FAFD" : "#142A43";
  const border = dark ? "#244866" : "#DDE8F0";

  return (
    <>
      <View style={[s.header, { backgroundColor: bg, borderBottomColor: border }]}>
        <View style={s.brand}>
          <View style={s.logo}><Text style={s.logoText}>إ</Text></View>
          <View>
            <Text style={[s.brandName, { color: ink }]}>إجازة | IJAZAH</Text>
            <Text style={[s.subtitle, { color: dark ? "#A8D8EF" : "#788BA0" }]}>القرآن الكريم</Text>
          </View>
        </View>
        <View style={s.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="اختيار اللغة" onPress={() => setLanguagePickerVisible(true)} style={[s.button, { backgroundColor: dark ? "#163752" : "#F1F7FB", borderColor: border }]}>
            <Text style={[s.buttonText, { color: ink }]}>{chosen.native}⌄</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="تبديل الوضع الليلي" onPress={() => setDark(!dark)} style={[s.iconButton, { backgroundColor: dark ? "#163752" : "#F1F7FB", borderColor: border }]}>
            <Text style={[s.buttonText, { color: ink }]}>{dark ? "☀" : "☾"}</Text>
          </Pressable>
        </View>
      </View>
      <Modal visible={languagePickerVisible} transparent animationType="fade" onRequestClose={() => setLanguagePickerVisible(false)}>
        <Pressable style={s.backdrop} onPress={() => setLanguagePickerVisible(false)}>
          <Pressable style={[s.modal, { backgroundColor: bg, borderColor: border }]} onPress={() => {}}>
            <View style={s.modalHeading}>
              <Text style={[s.modalTitle, { color: ink }]}>اختَر لغة التطبيق</Text>
              <Pressable onPress={() => setLanguagePickerVisible(false)}><Text style={[s.close, { color: ink }]}>✕</Text></Pressable>
            </View>
            <Text style={[s.modalNote, { color: dark ? "#A8D8EF" : "#788BA0" }]}>اختر اللغة المطلوبة. سيظل اختيارك محفوظًا في المتصفح.</Text>
            <ScrollView style={s.languageList} keyboardShouldPersistTaps="handled">
              {APP_LANGUAGES.map((item) => (
                <Pressable key={item.code} onPress={() => { setLanguage(item.code); setLanguagePickerVisible(false); }} style={[s.languageRow, { borderBottomColor: border, backgroundColor: item.code === language ? (dark ? "#163752" : "#E5F8FC") : "transparent" }]}>
                  <Text style={[s.languageName, { color: ink }]}>{item.native}</Text>
                  <Text style={[s.languageCode, { color: dark ? "#A8D8EF" : "#788BA0" }]}>{item.name}</Text>
                  {item.code === language ? <Text style={s.check}>✓</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  header: { minHeight: 72, paddingHorizontal: 18, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, gap: 10 },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  logo: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#35C7DE" },
  logoText: { color: "#071A33", fontSize: 24, fontWeight: "900" },
  brandName: { fontSize: 14, fontWeight: "900" },
  subtitle: { fontSize: 10, marginTop: 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: 7 },
  button: { minHeight: 38, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", maxWidth: 145 },
  iconButton: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 12, fontWeight: "800" },
  backdrop: { flex: 1, backgroundColor: "rgba(3,15,30,0.55)", justifyContent: "center", alignItems: "center", padding: 18 },
  modal: { width: "100%", maxWidth: 460, maxHeight: "84%", borderWidth: 1, borderRadius: 22, padding: 18 },
  modalHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  modalTitle: { fontSize: 19, fontWeight: "900" },
  close: { fontSize: 20, padding: 4 },
  modalNote: { fontSize: 12, lineHeight: 19, marginBottom: 10 },
  languageList: { flexGrow: 0 },
  languageRow: { minHeight: 49, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", gap: 8 },
  languageName: { flex: 1, fontSize: 14, fontWeight: "700" },
  languageCode: { fontSize: 11 },
  check: { color: "#168DA5", fontSize: 16, fontWeight: "900", marginLeft: 4 },
});
