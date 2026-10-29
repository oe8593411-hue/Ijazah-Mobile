import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { SURAHS } from "../src/quran/surahs";

const C = {
  bg: "#1F2023", bar: "#17181B", card: "#26292F", line: "#2E3136",
  ink: "#F4EFE3", muted: "#9AA0A6", gold: "#E0A93B", goldSoft: "rgba(224,169,59,0.16)", dark: "#1B1C1F",
};

// Surah picker: tap a surah to open the recitation screen on it (whole surah, from ayah 1).
export default function Surahs() {
  const params = useLocalSearchParams<{ current?: string }>();
  const current = Number(params.current) || 0;

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backButton}><Text style={s.back}>›</Text></Pressable>
        <Text style={s.title}>اختر السورة</Text>
        <View style={s.spacer} />
      </View>

      <ScrollView contentContainerStyle={s.list}>
        {SURAHS.map((x) => {
          const active = x.number === current;
          return (
            <Pressable
              key={x.number}
              onPress={() => router.navigate({ pathname: "/recite", params: { surah: String(x.number), ayah: "1", scope: "surah" } })}
              style={[s.row, active && s.rowActive]}
            >
              <View style={[s.num, active && s.numActive]}>
                <Text style={[s.numText, active && s.numTextActive]}>{x.number}</Text>
              </View>
              <View style={s.info}>
                <Text style={[s.name, active && s.nameActive]}>{x.nameAr}</Text>
                <Text style={s.count}>{x.ayahCount} آية</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { paddingTop: 12, paddingHorizontal: 12, paddingBottom: 10, flexDirection: "row", alignItems: "center", backgroundColor: C.bar, borderBottomWidth: 1, borderBottomColor: C.line },
  backButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  back: { color: C.gold, fontSize: 34, lineHeight: 36 },
  title: { flex: 1, textAlign: "center", color: C.ink, fontSize: 17, fontWeight: "700" },
  spacer: { width: 36 },
  list: { padding: 14, gap: 8 },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: C.line },
  rowActive: { borderColor: C.gold, backgroundColor: C.goldSoft },
  num: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bar, alignItems: "center", justifyContent: "center" },
  numActive: { backgroundColor: C.gold },
  numText: { color: C.gold, fontWeight: "800", fontSize: 14 },
  numTextActive: { color: C.dark },
  info: { flex: 1, alignItems: "flex-end" },
  name: { color: C.ink, fontSize: 18, fontWeight: "700", fontFamily: Platform.OS === "web" ? "'Amiri Quran', 'Amiri', serif" : undefined },
  nameActive: { color: C.gold },
  count: { color: C.muted, fontSize: 11, marginTop: 2 },
});
