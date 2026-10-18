import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PreferencesProvider } from "../src/preferences";
import GlobalControls from "../components/GlobalControls";

export default function RootLayout() {
  return (
    <PreferencesProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: true, header: () => <GlobalControls /> }} />
    </PreferencesProvider>
  );
}
