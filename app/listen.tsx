import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

const NAVY = "#092A59";
const CYAN = "#39A9D0";
const PALE = "#EAF7FC";
const SURAH_NAMES = [
"الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس",
"هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه",
"الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم",
"لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر",
"فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق",
"الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة",
"الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج",
"نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس",
"التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد",
"الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات",
"القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر",
"المسد","الإخلاص","الفلق","الناس"
] as const;

const RECITERS = [
 { name:"مشاري العفاسي", id:"ar.alafasy" },
 { name:"محمود خليل الحصري", id:"ar.husary" },
 { name:"عبد الباسط عبد الصمد — مرتّل", id:"ar.abdulbasitmurattal" },
 { name:"ماهر المعيقلي", id:"ar.mahermuaiqly" },
 { name:"محمد صديق المنشاوي", id:"ar.minshawi" },
 { name:"عبد الرحمن السديس", id:"ar.abdurrahmaansudais" },
 { name:"سعود الشريم", id:"ar.saoodshuraym" },
 { name:"أبو بكر الشاطري", id:"ar.shaatree" },
];

export default function Listen() {
 const [surah, setSurah] = useState("1");
 const [reciterId, setReciterId] = useState(RECITERS[0].id);
 const [playingSurah, setPlayingSurah] = useState(0);
 const [loading, setLoading] = useState(false);
 const [message, setMessage] = useState("اختر القارئ والسورة ثم اضغط تشغيل.");
 const [editions, setEditions] = useState<string[]>([]);
 const player = useAudioPlayer(null);
 const status = useAudioPlayerStatus(player);
 const currentSurah = Math.max(1, Math.min(114, Number.parseInt(surah, 10) || 1));
 const selectedReciter = useMemo(() => RECITERS.find(r => r.id === reciterId) ?? RECITERS[0], [reciterId]);

 useEffect(() => {
   let active = true;
   fetch("https://api.alquran.cloud/v1/edition/format/audio")
     .then(r => { if (!r.ok) throw new Error("audio edition list unavailable"); return r.json(); })
     .then(json => {
       const available = (json?.data ?? []).map((x: {identifier?:string}) => x.identifier).filter((x: unknown): x is string => typeof x === "string");
       if (active) setEditions(available);
     })
     .catch(() => { if (active) setEditions(RECITERS.map(r => r.id)); });
   return () => { active = false; };
 }, []);

 const supported = editions.includes(reciterId);
 async function playSurah() {
   if (!supported) {
     setMessage("هذا التسجيل غير متاح حاليًا من مصدر الصوت. اختر قارئًا آخر من القائمة.");
     return;
   }
   const url = `https://cdn.islamic.network/quran/audio-surah/128/${reciterId}/${currentSurah}.mp3`;
   setLoading(true);
   setMessage("جارٍ الاتصال بمصدر التلاوة الموثوق…");
   try {
     await player.replace({ uri: url });
     player.play();
     setPlayingSurah(currentSurah);
     setMessage(`يُشغَّل الآن: سورة ${SURAH_NAMES[currentSurah - 1]} بصوت ${selectedReciter.name}.`);
   } catch {
     setMessage("تعذّر تشغيل هذا الملف الآن. تحقّق من الإنترنت أو اختر قارئًا آخر.");
   } finally {
     setLoading(false);
   }
 }

 function pauseOrResume() {
   if (status.playing) { player.pause(); setMessage("تم إيقاف التشغيل مؤقتًا."); }
   else if (playingSurah === currentSurah) { player.play(); setMessage("استُؤنف التشغيل."); }
   else { void playSurah(); }
 }

 return <View style={s.root}>
  <View style={s.head}>
   <Pressable onPress={() => router.back()} style={s.backButton}><Text style={s.back}>‹</Text></Pressable>
   <View style={s.headCopy}><Text style={s.title}>الاستماع للقرآن الكريم</Text><Text style={s.subtitle}>اختر القارئ والسورة</Text></View>
   <View style={s.logoMark}><Text style={s.logoText}>إ</Text></View>
  </View>
  <ScrollView contentContainerStyle={s.body}>
   <View style={s.intro}><Text style={s.introTitle}>القرآن كاملًا، سورةً سورة</Text><Text style={s.introSub}>اختر من القرّاء المتاحين، واستمع إلى السورة كاملة عبر الإنترنت.</Text></View>
   <Text style={s.label}>القارئ</Text>
   <View style={s.reciterList}>{RECITERS.map(r => {
    const isAvailable = editions.length === 0 || editions.includes(r.id);
    return <Pressable key={r.id} onPress={() => { setReciterId(r.id); setMessage(isAvailable ? `تم اختيار ${r.name}.` : "هذا القارئ غير متاح حاليًا في مصدر الصوت."); }} style={[s.reciter, reciterId===r.id&&s.selected, !isAvailable&&s.unavailable]}>
      <Text style={[s.reciterName,reciterId===r.id&&s.selectedText]}>{r.name}</Text>
      <Text style={[s.reciterState,reciterId===r.id&&s.selectedText]}>{!isAvailable?"غير متاح حاليًا":reciterId===r.id?"✓ محدد":"اختيار"}</Text>
    </Pressable>;
   })}</View>
   <Text style={s.label}>السورة (من 1 إلى 114)</Text>
   <View style={s.surahPicker}>
    <TextInput value={surah} onChangeText={v=>setSurah(v.replace(/[^0-9]/g,"").slice(0,3))} keyboardType="number-pad" style={s.surahInput} maxLength={3} />
    <View style={s.surahNameWrap}><Text style={s.surahName}>{SURAH_NAMES[currentSurah-1]}</Text><Text style={s.surahMeta}>السورة رقم {currentSurah}</Text></View>
    <View style={s.stepper}><Pressable onPress={()=>setSurah(String(Math.min(114,currentSurah+1)))} style={s.step}><Text style={s.stepText}>＋</Text></Pressable><Pressable onPress={()=>setSurah(String(Math.max(1,currentSurah-1)))} style={s.step}><Text style={s.stepText}>−</Text></Pressable></View>
   </View>
   <View style={s.playerCard}>
    <View style={s.soundIcon}><Text style={s.soundIconText}>♫</Text></View>
    <Text style={s.nowPlaying}>{status.playing ? "يتم التشغيل الآن" : "مشغّل إجازة"}</Text>
    <Text style={s.nowTitle}>{SURAH_NAMES[currentSurah-1]}</Text>
    <Text style={s.nowMeta}>{selectedReciter.name} · رواية التسجيل المتاح</Text>
    <View style={s.progressTrack}><View style={[s.progressFill,{width:status.duration>0?`${Math.min(100,Math.max(0,status.currentTime/status.duration*100))}%`:"0%"}]} /></View>
    <View style={s.times}><Text>{formatTime(status.currentTime)}</Text><Text>{formatTime(status.duration)}</Text></View>
    <Pressable style={s.playButton} onPress={pauseOrResume} disabled={loading || !supported}>
      {loading ? <ActivityIndicator color={NAVY}/> : <Text style={s.playIcon}>{status.playing?"Ⅱ":"▶"}</Text>}
      <Text style={s.playLabel}>{status.playing?"إيقاف مؤقت":"تشغيل السورة كاملة"}</Text>
    </Pressable>
    <Pressable style={s.restart} onPress={()=>{void playSurah();}} disabled={loading || !supported}><Text style={s.restartText}>↻ إعادة تشغيل السورة</Text></Pressable>
   </View>
   <View style={s.riwayaInfo}><Text style={s.infoTitle}>القراءات والروايات</Text><Text style={s.infoText}>الصوت يُشغَّل بالرواية التي يوفرها تسجيل القارئ نفسه. لن ننسب التسجيل إلى ورش أو قالون أو غيرهما دون مصدر موثّق يثبت الرواية. دعم اختيار جميع القراءات العشر يتطلب توفير تسجيلات كاملة موثّقة لكل رواية.</Text></View>
   <Text style={s.message}>{message}</Text>
   <Text style={s.footnote}>مصدر الصوت: Al Quran Cloud CDN. يحتاج التشغيل إلى اتصال بالإنترنت؛ قد تختلف الإتاحة حسب القارئ والسورة.</Text>
  </ScrollView>
 </View>;
}

function formatTime(value?: number) { const n = Number.isFinite(value) ? Math.max(0,Math.floor(value||0)) : 0; return `${Math.floor(n/60)}:${String(n%60).padStart(2,"0")}`; }

const s = StyleSheet.create({
 root:{flex:1,backgroundColor:"#F5FAFD"},
 head:{paddingTop:54,paddingHorizontal:18,paddingBottom:18,backgroundColor:NAVY,flexDirection:"row",alignItems:"center",gap:12},
 backButton:{width:35,alignItems:"center"},back:{color:"#fff",fontSize:34,lineHeight:36},
 headCopy:{flex:1,alignItems:"flex-end"},title:{color:"#fff",fontSize:18,fontWeight:"900"},subtitle:{color:"#B7E8F6",fontSize:10,marginTop:4},
 logoMark:{width:40,height:40,borderRadius:14,backgroundColor:CYAN,alignItems:"center",justifyContent:"center"},logoText:{fontSize:25,color:NAVY,fontWeight:"900"},
 body:{padding:18,paddingBottom:40},
 intro:{backgroundColor:"#E8F6FC",borderRadius:22,padding:19,marginBottom:20,borderWidth:1,borderColor:"#C9E9F5"},
 introTitle:{color:NAVY,fontSize:20,fontWeight:"900",textAlign:"right"},introSub:{color:"#526F83",fontSize:12,lineHeight:20,textAlign:"right",marginTop:7},
 label:{color:NAVY,fontSize:14,fontWeight:"900",textAlign:"right",marginTop:12,marginBottom:9},
 reciterList:{gap:8},
 reciter:{backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E1ECF2",borderRadius:15,paddingHorizontal:13,paddingVertical:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
 selected:{backgroundColor:NAVY,borderColor:NAVY},unavailable:{opacity:0.5},
 reciterName:{color:"#213C59",fontSize:12,fontWeight:"800"},reciterState:{color:"#6E879B",fontSize:10},
 selectedText:{color:"#FFFFFF"},
 surahPicker:{backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E1ECF2",borderRadius:17,padding:12,flexDirection:"row",alignItems:"center",gap:12},
 surahInput:{width:52,height:46,backgroundColor:PALE,borderRadius:12,textAlign:"center",color:NAVY,fontWeight:"900",fontSize:17},
 surahNameWrap:{flex:1,alignItems:"flex-end"},surahName:{color:NAVY,fontSize:16,fontWeight:"900"},surahMeta:{color:"#6E879B",fontSize:10,marginTop:4},
 stepper:{gap:5},step:{width:27,height:24,borderRadius:8,backgroundColor:PALE,alignItems:"center",justifyContent:"center"},stepText:{color:NAVY,fontWeight:"900"},
 playerCard:{backgroundColor:"#FFFFFF",borderRadius:24,padding:20,alignItems:"center",marginTop:20,borderWidth:1,borderColor:"#DCEAF1"},
 soundIcon:{width:64,height:64,borderRadius:22,backgroundColor:PALE,alignItems:"center",justifyContent:"center"},soundIconText:{fontSize:30,color:CYAN},
 nowPlaying:{color:"#6D899A",fontSize:10,fontWeight:"800",marginTop:13},nowTitle:{color:NAVY,fontSize:22,fontWeight:"900",marginTop:5},nowMeta:{color:"#70889B",fontSize:11,marginTop:5,textAlign:"center"},
 progressTrack:{height:5,width:"100%",backgroundColor:"#E5EFF4",borderRadius:5,marginTop:20,overflow:"hidden"},progressFill:{height:5,backgroundColor:CYAN,borderRadius:5},
 times:{width:"100%",flexDirection:"row",justifyContent:"space-between",marginTop:7},playButton:{backgroundColor:CYAN,borderRadius:15,padding:15,marginTop:18,width:"100%",flexDirection:"row",alignItems:"center",justifyContent:"center",gap:10},playIcon:{color:NAVY,fontSize:21,fontWeight:"900"},playLabel:{color:NAVY,fontSize:13,fontWeight:"900"},
 restart:{padding:11,marginTop:3},restartText:{color:"#267A9B",fontSize:11,fontWeight:"800"},
 riwayaInfo:{backgroundColor:"#F0F6FA",borderRadius:18,padding:15,marginTop:16},infoTitle:{color:NAVY,fontSize:13,fontWeight:"900",textAlign:"right"},infoText:{color:"#526C7D",fontSize:11,lineHeight:19,textAlign:"right",marginTop:6},
 message:{color:NAVY,fontSize:11,lineHeight:18,textAlign:"center",marginTop:14,fontWeight:"700"},footnote:{color:"#7A91A2",fontSize:9,lineHeight:15,textAlign:"center",marginTop:12}
});
