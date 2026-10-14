import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

export default function Progress(){
 return <View style={s.root}>
  <View style={s.head}><Pressable onPress={()=>router.back()}><Text style={s.back}>‹</Text></Pressable><Text style={s.title}>تقدمي</Text><View style={{width:28}}/></View>
  <View style={s.body}>
   <Text style={s.icon}>◔</Text><Text style={s.big}>رحلتك تبدأ هنا</Text>
   <Text style={s.label}>لم نسجل جلسات مكتملة بعد، لذلك لن نعرض إحصائيات تقديرية على أنها بيانات حقيقية.</Text>
   <View style={s.card}><Text style={s.ct}>كيف تبدأ؟</Text><Text style={s.cs}>ابدأ جلسة تسميع أو اختبار حفظ. ستظهر الإحصائيات هنا عندما يتم ربط تسجيل الجلسات وتخزينها بشكل موثوق.</Text></View>
   <Pressable style={s.button} onPress={()=>router.push("/recite")}><Text style={s.buttonText}>ابدأ التسميع</Text></Pressable>
   <Pressable style={s.secondary} onPress={()=>router.push("/premium")}><Text style={s.secondaryText}>اكتشف بريميوم 👑</Text></Pressable>
  </View>
 </View>
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:"#F7F9FC"},head:{paddingTop:58,paddingHorizontal:20,paddingBottom:18,backgroundColor:"#071A33",flexDirection:"row",justifyContent:"space-between",alignItems:"center"},back:{color:"#fff",fontSize:34},title:{color:"#fff",fontSize:19,fontWeight:"800"},body:{padding:24,alignItems:"center"},icon:{fontSize:54,color:"#22C7D8",marginTop:55},big:{fontSize:21,fontWeight:"900",color:"#071A33",marginTop:18,textAlign:"center"},label:{color:"#52677D",fontSize:13,lineHeight:22,textAlign:"center",marginTop:10},card:{backgroundColor:"#fff",width:"100%",borderRadius:22,padding:20,marginTop:28},ct:{textAlign:"right",fontWeight:"800",color:"#071A33",fontSize:15},cs:{textAlign:"right",color:"#7B8C9E",marginTop:8,lineHeight:21,fontSize:12},button:{width:"100%",backgroundColor:"#22C7D8",borderRadius:16,padding:15,alignItems:"center",marginTop:18},buttonText:{color:"#071A33",fontWeight:"900"},secondary:{width:"100%",borderWidth:1,borderColor:"#D6E0E9",borderRadius:16,padding:15,alignItems:"center",marginTop:9},secondaryText:{color:"#071A33",fontWeight:"800"}});
