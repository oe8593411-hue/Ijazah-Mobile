import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, ScrollView } from "react-native";
import { router } from "expo-router";
import { SURAHS } from "../src/quran/surahs";

const C = { navy:"#071A33", cyan:"#22C7D8", surface:"#F7F9FC", ink:"#152A42", muted:"#8391A3", white:"#FFFFFF" };

export default function Quran() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SURAHS;
    return SURAHS.filter(s => s.nameAr.includes(q) || String(s.number) === q);
  }, [query]);

  return (
    <View style={s.root}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()}><Text style={s.back}>‹</Text></Pressable>
        <View style={s.headCenter}><Text style={s.title}>القرآن الكريم</Text><Text style={s.meta}>حفص • رسم عثماني • ١١٤ سورة</Text></View>
        <View style={s.verified}><Text style={s.verifiedText}>موثّق</Text></View>
      </View>

      <View style={s.searchBox}>
        <Text style={s.searchIcon}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث باسم السورة أو رقمها"
          placeholderTextColor={s.placeholder.color}
          style={s.input}
          textAlign="right"
        />
      </View>

      <ScrollView contentContainerStyle={s.list}>
        <View style={s.sourceCard}>
          <Text style={s.sourceTitle}>📖 مصحف موثّق</Text>
          <Text style={s.sourceText}>النص محفوظ من Tanzil Uthmani 1.1، وتم التحقق من ٦٢٣٦ آية و١١٤ سورة قبل اعتماده.</Text>
        </View>

        {filtered.map(surah => (
          <Pressable key={surah.number} style={s.item} onPress={() => router.push({ pathname:"/surah", params:{ number:String(surah.number) } })}>
            <Text style={s.arrow}>‹</Text>
            <View style={s.copy}>
              <Text style={s.name}>{surah.nameAr}</Text>
              <Text style={s.sub}>{surah.ayahCount} آية • رقم {surah.number}</Text>
            </View>
            <View style={s.num}><Text style={s.numText}>{surah.number}</Text></View>
          </Pressable>
        ))}

        {filtered.length === 0 && <View style={s.empty}><Text style={s.emptyTitle}>لا توجد سورة مطابقة</Text><Text style={s.emptyText}>جرّب اسمًا آخر أو رقم السورة.</Text></View>}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:{flex:1,backgroundColor:C.surface},
  head:{paddingTop:56,paddingHorizontal:18,paddingBottom:17,backgroundColor:C.navy,flexDirection:"row",alignItems:"center",gap:10},
  back:{color:"#fff",fontSize:34,lineHeight:36,width:34},
  headCenter:{flex:1,alignItems:"center"},
  title:{color:"#fff",fontSize:19,fontWeight:"900"},
  meta:{color:"#8EDFE7",fontSize:9,marginTop:4},
  verified:{borderWidth:1,borderColor:"#2B6474",borderRadius:12,paddingHorizontal:9,paddingVertical:6},
  verifiedText:{color:"#B8F1F4",fontSize:9,fontWeight:"900"},
  searchBox:{margin:16,backgroundColor:C.white,borderRadius:17,paddingHorizontal:14,flexDirection:"row",alignItems:"center",borderWidth:1,borderColor:"#E3EAF0"},
  searchIcon:{fontSize:25,color:C.cyan},
  input:{flex:1,height:50,color:C.ink,fontSize:13,paddingHorizontal:10},
  placeholder:{color:"#9BA8B5"},
  list:{paddingHorizontal:16,paddingBottom:36,gap:10},
  sourceCard:{backgroundColor:"#E9F8FA",borderRadius:18,padding:15,borderWidth:1,borderColor:"#BDEDF1",marginBottom:3},
  sourceTitle:{color:"#087E8B",fontWeight:"900",fontSize:13,textAlign:"right"},
  sourceText:{color:"#52707D",fontSize:10,lineHeight:17,marginTop:5,textAlign:"right"},
  item:{backgroundColor:C.white,borderRadius:19,padding:14,flexDirection:"row",alignItems:"center",gap:12},
  num:{width:42,height:42,borderRadius:14,backgroundColor:"#E8FAFC",alignItems:"center",justifyContent:"center"},
  numText:{color:"#087E8B",fontWeight:"900",fontSize:13},
  copy:{flex:1},
  name:{color:C.navy,fontSize:18,fontWeight:"900",textAlign:"right"},
  sub:{color:C.muted,fontSize:10,marginTop:4,textAlign:"right"},
  arrow:{fontSize:24,color:"#A5B2C0",width:18},
  empty:{backgroundColor:C.white,borderRadius:20,padding:22,alignItems:"center"},
  emptyTitle:{color:C.navy,fontSize:15,fontWeight:"900"},
  emptyText:{color:C.muted,fontSize:11,marginTop:5}
});
