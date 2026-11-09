import { useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
          <Image source={require("../Ijazah profile picture.jpeg")} style={s.logoImage} resizeMode="contain" accessibilityLabel="شعار إجازة" />
          <View>
            <Text style={[s.brandName, { color: ink }]}>إجازة | IJAZAH</Text>
            <Text style={[s.subtitle, { color: dark ? "#A8D8EF" : "#788BA0" }]}>القرآن الكريم</Text>
          </View>
        </View>
        <View style={s.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="اختيار اللغة" onPress={() => setLanguagePickerVisible(true)} style={[s.button, { backgroundColor: dark ? "#163752" : "#F1F7FB", borderColor: border }]}>
            <Text style={[s.buttonText, { color: ink }]}>{chosen.native}⌄</Text>
          </Pressable>
          <View style={[s.themeSwitch, { backgroundColor: dark ? "#102B43" : "#EAF0F5", borderColor: border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="الوضع الفاتح"
              accessibilityState={{ selected: !dark }}
              onPress={() => setDark(false)}
              style={[s.themeOption, !dark && [s.themeOptionActive, { backgroundColor: "#FFFFFF" }]]}
            >
              <Text style={[s.themeIcon, { color: !dark ? "#B7791F" : "#9AAABD" }]}>☀</Text>
              <Text style={[s.themeLabel, { color: !dark ? "#182536" : "#A9B9C9" }]}>فاتح</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="الوضع الداكن"
              accessibilityState={{ selected: dark }}
              onPress={() => setDark(true)}
              style={[s.themeOption, dark && [s.themeOptionActive, { backgroundColor: "#244B68" }]]}
            >
              <Text style={[s.themeIcon, { color: dark ? "#F4D58D" : "#8495A6" }]}>☾</Text>
              <Text style={[s.themeLabel, { color: dark ? "#FFFFFF" : "#64748B" }]}>داكن</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <Modal visible={languagePickerVisible} transparent animationType="fade" onRequestClose={() => setLanguagePickerVisible(false)}>
        <Pressable style={s.backdrop} onPress={() => setLanguagePickerVisible(false)}>
          <Pressable style={[s.modal, { backgroundColor: bg, borderColor: border }]} onPress={() => {}}>
            <View style={s.modalHeading}>
              <Text style={[s.modalTitle, { color: ink }]}>اختَر لغة التطبيق</Text>
              <Pressable onPress={() => setLanguagePickerVisible(false)}><Text style={[s.close, { color: ink }]}>✕</Text></Pressable>
            </View>
            <Text style={[s.modalNote, { color: dark ? "#A8D8EF" : "#788BA0" }]}>اختر اللغة المطلوبة. سيُحفظ اختيارك على هذا الجهاز، في التطبيق أو المتصفح.</Text>
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
  logoImage: { width: 42, height: 42, borderRadius: 12 },
  brandName: { fontSize: 14, fontWeight: "900" },
  subtitle: { fontSize: 10, marginTop: 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: 7 },
  button: { minHeight: 38, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", maxWidth: 145 },
  themeSwitch: { flexDirection: "row", alignItems: "center", padding: 3, borderRadius: 15, borderWidth: 1, gap: 2 },
  themeOption: { minWidth: 67, height: 34, paddingHorizontal: 8, borderRadius: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  themeOptionActive: { shadowColor: "#071A33", shadowOpacity: 0.12, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  themeIcon: { fontSize: 15, fontWeight: "900" },
  themeLabel: { fontSize: 11, fontWeight: "900" },
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
