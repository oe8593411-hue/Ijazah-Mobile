import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";

const navy = "#071A33";
const cyan = "#22C7D8";

export default function Home() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>إجازة</Text>
            <Text style={styles.title}>السلام عليكم 👋</Text>
          </View>
          <Pressable style={styles.avatar}><Text style={styles.avatarText}>ع</Text></Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.quranMark}><Text style={styles.quran}>﴾﴿</Text></View>
          <Text style={styles.heroTitle}>وردك اليوم</Text>
          <Text style={styles.heroSub}>ابدأ وردك اليوم، وتابع تقدمك مع كل جلسة</Text>
          <View style={styles.progressTrack}><View style={[styles.progress,{width:"0%"}]} /></View>
          <View style={styles.progressRow}><Text style={styles.muted}>لم يبدأ الورد بعد</Text><Text style={styles.white}>ابدأ أول جلسة</Text></View>
          <Pressable style={styles.primary} onPress={() => router.push("/recite")}>
            <Text style={styles.primaryText}>ابدأ التلاوة</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>اختصارات</Text>
        <View style={styles.grid}>
          <Action title="القرآن" sub="قراءة وحفظ" icon="۞" route="/quran" />
          <Action title="المراجعة" sub="اختبار الحفظ" icon="↻" route="/smart-test" />
          <Action title="التجويد" sub="قواعد التلاوة" icon="✦" route="/tajweed" />
          <Action title="تقدمي" sub="سجل الجلسات" icon="◔" route="/progress" />
        </View>

        <Pressable style={styles.premiumCard} onPress={() => router.push("/premium")}>
          <View style={styles.premiumTop}><Text style={styles.premiumBadge}>PREMIUM 👑</Text><Text style={styles.premiumCrown}>✦</Text></View>
          <Text style={styles.premiumTitle}>ارتقِ برحلتك مع القرآن</Text>
          <Text style={styles.premiumSub}>اختبارات حفظ ذكية • مراجعة نقاط الضعف • تجربة متقدمة</Text>
          <View style={styles.premiumButton}><Text style={styles.premiumButtonText}>اكتشف إجازة بريميوم ←</Text></View>
        </Pressable>

        <View style={styles.streak}>
          <Text style={styles.streakIcon}>🔥</Text>
          <View style={{flex:1}}><Text style={styles.streakTitle}>ابدأ سلسلة إنجازك</Text><Text style={styles.muted}>ستظهر بياناتك بعد تسجيل الجلسات</Text></View>
          <Text style={styles.days}>٠</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Action({title, sub, icon, route}:{title:string;sub:string;icon:string;route:"/quran"|"/smart-test"|"/tajweed"|"/progress"}) {
  return <Pressable style={styles.card} onPress={() => router.push(route)}><Text style={styles.icon}>{icon}</Text><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardSub}>{sub}</Text></Pressable>;
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:"#F6F8FB"},content:{padding:20,paddingTop:62,paddingBottom:40},
  header:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:24},
  kicker:{fontSize:14,color:cyan,fontWeight:"800",textAlign:"right"},title:{fontSize:25,fontWeight:"800",color:navy,textAlign:"right",marginTop:5},
  avatar:{width:46,height:46,borderRadius:23,backgroundColor:navy,alignItems:"center",justifyContent:"center"},avatarText:{color:"white",fontSize:18,fontWeight:"800"},
  hero:{backgroundColor:navy,borderRadius:28,padding:22,overflow:"hidden"},quranMark:{width:54,height:54,borderRadius:18,backgroundColor:"rgba(34,199,216,.15)",alignItems:"center",justifyContent:"center"},quran:{fontSize:27,color:cyan},
  heroTitle:{color:"white",fontSize:23,fontWeight:"800",marginTop:18,textAlign:"right"},heroSub:{color:"#AFC0D5",fontSize:14,marginTop:7,textAlign:"right"},
  progressTrack:{height:7,backgroundColor:"#183452",borderRadius:8,marginTop:22,overflow:"hidden"},progress:{width:"0%",height:7,backgroundColor:cyan,borderRadius:8},
  progressRow:{flexDirection:"row",justifyContent:"space-between",marginTop:8},muted:{color:"#7890AA",fontSize:12},white:{color:"#DDEAF6",fontSize:12},
  primary:{marginTop:20,height:52,borderRadius:17,backgroundColor:cyan,alignItems:"center",justifyContent:"center"},primaryText:{color:navy,fontSize:16,fontWeight:"800"},
  section:{fontSize:19,fontWeight:"800",color:navy,textAlign:"right",marginTop:28,marginBottom:12},grid:{flexDirection:"row",flexWrap:"wrap",gap:12},
  card:{width:"48%",minHeight:130,backgroundColor:"white",borderRadius:22,padding:17,shadowOpacity:.04,shadowRadius:12,elevation:1},icon:{fontSize:27,color:cyan,textAlign:"right"},cardTitle:{fontSize:16,fontWeight:"800",color:navy,textAlign:"right",marginTop:10},cardSub:{fontSize:12,color:"#8090A1",textAlign:"right",marginTop:5},
  streak:{marginTop:20,backgroundColor:"white",borderRadius:22,padding:17,flexDirection:"row",alignItems:"center",gap:13},streakIcon:{fontSize:26},streakTitle:{fontSize:15,fontWeight:"800",color:navy,textAlign:"right"},days:{fontSize:25,fontWeight:"900",color:cyan},
  premiumCard:{marginTop:18,backgroundColor:"#102746",borderRadius:24,padding:20,borderWidth:1,borderColor:"#1B5570"},premiumTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},premiumBadge:{color:"#22C7D8",fontSize:11,fontWeight:"900",letterSpacing:1},premiumCrown:{color:"#F5D27A",fontSize:26},premiumTitle:{color:"#FFFFFF",fontSize:20,fontWeight:"900",textAlign:"right",marginTop:15},premiumSub:{color:"#B7C9DB",fontSize:12,lineHeight:20,textAlign:"right",marginTop:7},premiumButton:{marginTop:16,backgroundColor:"#22C7D8",borderRadius:14,padding:13,alignItems:"center"},premiumButtonText:{color:"#071A33",fontSize:13,fontWeight:"900"}
});
