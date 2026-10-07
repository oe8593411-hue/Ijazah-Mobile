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
          <Text style={styles.heroSub}>أكمل مراجعتك وقرّبك من الإتقان</Text>
          <View style={styles.progressTrack}><View style={styles.progress} /></View>
          <View style={styles.progressRow}><Text style={styles.muted}>٤٥٪ من الورد</Text><Text style={styles.white}>١٢ دقيقة</Text></View>
          <Pressable style={styles.primary} onPress={() => router.push("/recite")}>
            <Text style={styles.primaryText}>ابدأ التلاوة</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>اختصارات</Text>
        <View style={styles.grid}>
          <Action title="القرآن" sub="قراءة وحفظ" icon="۞" />
          <Action title="المراجعة" sub="خطة اليوم" icon="↻" />
          <Action title="التجويد" sub="تعلّم القواعد" icon="✦" />
          <Action title="تقدمي" sub="إحصائيات دقيقة" icon="◔" />
        </View>

        <View style={styles.streak}>
          <Text style={styles.streakIcon}>🔥</Text>
          <View style={{flex:1}}><Text style={styles.streakTitle}>سلسلة متواصلة</Text><Text style={styles.muted}>٧ أيام من الالتزام</Text></View>
          <Text style={styles.days}>٧</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Action({title, sub, icon}:{title:string;sub:string;icon:string}) {
  return <Pressable style={styles.card}><Text style={styles.icon}>{icon}</Text><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardSub}>{sub}</Text></Pressable>;
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:"#F6F8FB"},content:{padding:20,paddingTop:62,paddingBottom:40},
  header:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:24},
  kicker:{fontSize:14,color:cyan,fontWeight:"800",textAlign:"right"},title:{fontSize:25,fontWeight:"800",color:navy,textAlign:"right",marginTop:5},
  avatar:{width:46,height:46,borderRadius:23,backgroundColor:navy,alignItems:"center",justifyContent:"center"},avatarText:{color:"white",fontSize:18,fontWeight:"800"},
  hero:{backgroundColor:navy,borderRadius:28,padding:22,overflow:"hidden"},quranMark:{width:54,height:54,borderRadius:18,backgroundColor:"rgba(34,199,216,.15)",alignItems:"center",justifyContent:"center"},quran:{fontSize:27,color:cyan},
  heroTitle:{color:"white",fontSize:23,fontWeight:"800",marginTop:18,textAlign:"right"},heroSub:{color:"#AFC0D5",fontSize:14,marginTop:7,textAlign:"right"},
  progressTrack:{height:7,backgroundColor:"#183452",borderRadius:8,marginTop:22,overflow:"hidden"},progress:{width:"45%",height:7,backgroundColor:cyan,borderRadius:8},
  progressRow:{flexDirection:"row",justifyContent:"space-between",marginTop:8},muted:{color:"#7890AA",fontSize:12},white:{color:"#DDEAF6",fontSize:12},
  primary:{marginTop:20,height:52,borderRadius:17,backgroundColor:cyan,alignItems:"center",justifyContent:"center"},primaryText:{color:navy,fontSize:16,fontWeight:"800"},
  section:{fontSize:19,fontWeight:"800",color:navy,textAlign:"right",marginTop:28,marginBottom:12},grid:{flexDirection:"row",flexWrap:"wrap",gap:12},
  card:{width:"48%",minHeight:130,backgroundColor:"white",borderRadius:22,padding:17,shadowOpacity:.04,shadowRadius:12,elevation:1},icon:{fontSize:27,color:cyan,textAlign:"right"},cardTitle:{fontSize:16,fontWeight:"800",color:navy,textAlign:"right",marginTop:10},cardSub:{fontSize:12,color:"#8090A1",textAlign:"right",marginTop:5},
  streak:{marginTop:20,backgroundColor:"white",borderRadius:22,padding:17,flexDirection:"row",alignItems:"center",gap:13},streakIcon:{fontSize:26},streakTitle:{fontSize:15,fontWeight:"800",color:navy,textAlign:"right"},days:{fontSize:25,fontWeight:"900",color:cyan}
});
