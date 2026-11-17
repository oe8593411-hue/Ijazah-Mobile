import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PreferencesProvider } from "../src/preferences";
import GlobalControls from "../components/GlobalControls";
import { usePreferences } from "../src/preferences";

function RootNavigator() {
  const { dark } = usePreferences();
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: true, header: () => <GlobalControls />, contentStyle: { backgroundColor: dark ? "#000000" : "#F4F8FC" } }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <PreferencesProvider>
      <RootNavigator />
    </PreferencesProvider>
  );
}
