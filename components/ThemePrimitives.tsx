import React from "react";
import {
  Pressable as RNPressable,
  PressableProps,
  ScrollView as RNScrollView,
  ScrollViewProps,
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  TextInputProps,
  TextProps,
  View as RNView,
  ViewProps,
} from "react-native";
import { usePreferences } from "../src/preferences";

const DARK_SURFACES: Record<string, string> = {
  "#F4F8FC": "#000000",
  "#F2F5F8": "#000000",
  "#F0F6FA": "#000000",
  "#FFFFFF": "#000000",
  "#fff": "#000000",
  "#35C7DE": "#147D91",
  "#168DA5": "#176A7D",
  "#E5F8FC": "#0D0D0D",
  "#EAF7FC": "#0D0D0D",
  "#E8F6FC": "#0D0D0D",
  "#DDF7FA": "#111111",
  "#E6F7FB": "#0D0D0D",
  "#D4F1F7": "#111111",
  "#D1F0F7": "#111111",
  "#F1F7FB": "#000000",
  "#EEF4F8": "#0D0D0D",
  "#E0EAF2": "#222222",
  "#E0E7ED": "#222222",
  "#EDF2F7": "#222222",
  "#E8EEF4": "#222222",
  "#E8EDF2": "#222222",
  "#FFF8E6": "#181818",
  "#F4EBD7": "#181818",
  "#D5EDF5": "#0D0D0D",
  "#B7E8F6": "#0D0D0D",
  "#D1E5EE": "#0D0D0D",
  "#DCEEF6": "#0D0D0D",
  "#C5E4F1": "#0D0D0D",
  "#DCE3EA": "#222222",
  "#F5F7FA": "#000000",
  "#F0FBFD": "#000000",
  "#E5EFF4": "#0D0D0D",
  "#E7F7FD": "#0D0D0D",
  "#EAF1FC": "#0D0D0D",
  "#F8F0DE": "#181818",
  "#F4EFE3": "#181818",
  "#F5D27A": "#181818",
  "#D8DEE7": "#222222",
  "#D6E0E9": "#222222",
  "#DDF9FC": "#0D0D0D",
  "#C9E9F5": "#0D0D0D",
  "#A8D8EF": "#0D0D0D",
  "#0D2A3D": "#000000",
  "#102B49": "#0D0D0D",
  "#102746": "#0D0D0D",
  "#071A33": "#000000",
  "#12304D": "#111111",
  "#173451": "#161616",
  "#173654": "#161616",
  "#173B58": "#161616",
  "#163A55": "#161616",
  "#193E58": "#161616",
  "#213C59": "#161616",
  "#1A4A65": "#161616",
  "#1B405E": "#161616",
  "#245C7B": "#222222",
  "#294760": "#222222",
  "#2B6474": "#222222",
  "#247CA5": "#222222",
  "#1F2023": "#000000",
  "#17181B": "#000000",
  "#26292F": "#0D0D0D",
  "#2E3136": "#222222",
  "#1B1C1F": "#0D0D0D",
  "#F5F7FA": "#000000",
  "#F5D27A": "#181818",
  "#E8EDF2": "#222222",
  "#F0F6FA": "#0D0D0D",
  "#EAF7FC": "#0D0D0D",
  "#F2F5F8": "#0D0D0D"
};
const DARK_TEXT: Record<string, string> = {
  "#071A33": "#F3FAFD",
  "#182536": "#F3FAFD",
  "#64748B": "#B8C9D9",
  "#718096": "#B8C9D9",
  "#9AA0A6": "#B8C9D9",
  "#142A43": "#F3FAFD",
  "#0D2238": "#F3FAFD",
  "#17657B": "#8EDBEA",
  "#526F83": "#B8C9D9",
  "#52707D": "#B8C9D9",
  "#527789": "#B8C9D9",
  "#6D7E90": "#B4C5D4",
  "#6E879B": "#B4C5D4",
  "#788BA0": "#B4C5D4",
  "#8794A3": "#B4C5D4",
  "#6F8795": "#B4C5D4",
  "#766341": "#D7C49C",
  "#806F4C": "#D7C49C",
  "#805D11": "#E9CB82",
  "#168DA5": "#66D1E2",
  "#137E95": "#66D1E2",
  "#1AA6BD": "#66D1E2",
  "#294760": "#B8D5E6",
  "#245C7B": "#8EDBEA",
  "#173451": "#B8D5E6",
  "#102B49": "#B8D5E6",
  "#102746": "#B8D5E6",
  "#12304D": "#B8D5E6",
  "#164B6A": "#8EDBEA",
  "#1A4B70": "#8EDBEA",
  "#1A4A65": "#8EDBEA",
  "#246A8C": "#8EDBEA",
  "#267A9B": "#8EDBEA",
  "#2B6474": "#8EDBEA",
  "#526C7D": "#B8C9D9",
  "#58788C": "#B8C9D9",
  "#6C9AAF": "#B8C9D9",
  "#7A91A2": "#B8C9D9",
  "#70889B": "#B8C9D9",
  "#6D899A": "#B8C9D9",
  "#A9C1D5": "#B8C9D9",
  "#AFCBDD": "#B8C9D9",
  "#9FB6CC": "#B8C9D9",
  "#B5C7D8": "#B8C9D9",
  "#9AA0A6": "#B8C9D9",
  "#8E98A6": "#B8C9D9"

};
function themed(style: any, dark: boolean) {
  const flat = StyleSheet.flatten(style) || {};
  if (!dark) return flat;
  const next: Record<string, any> = { ...flat };
  for (const key of ["color", "placeholderTextColor"]) {
    if (typeof next[key] === "string") { const hit = Object.entries(DARK_TEXT).find(([source]) => source.toUpperCase() === next[key].toUpperCase()); if (hit) next[key] = hit[1]; }
  }
  for (const key of ["backgroundColor", "borderColor", "borderTopColor", "borderBottomColor", "borderLeftColor", "borderRightColor"]) {
    if (typeof next[key] === "string") { const hit = Object.entries(DARK_SURFACES).find(([source]) => source.toUpperCase() === next[key].toUpperCase()); if (hit) next[key] = hit[1]; }
  }
  return next;
}

export function ThemePressable(props: PressableProps) {
  const { dark } = usePreferences();
  const style = typeof props.style === "function" ? (state: any) => themed((props.style as (state: any) => any)(state), dark) : themed(props.style, dark);
  return <RNPressable {...props} style={style} />;
}
export function ThemeView(props: ViewProps) {
  const { dark } = usePreferences();
  return <RNView {...props} style={themed(props.style, dark)} />;
}
export function ThemeText(props: TextProps) {
  const { dark } = usePreferences();
  return <RNText {...props} style={themed(props.style, dark)} />;
}
export function ThemeScrollView(props: ScrollViewProps) {
  const { dark } = usePreferences();
  return <RNScrollView {...props} style={themed(props.style, dark)} />;
}
export function ThemeTextInput(props: TextInputProps) {
  const { dark } = usePreferences();
  const originalPlaceholderColor = props.placeholderTextColor;
  const placeholderTextColor = dark && typeof originalPlaceholderColor === "string"
    ? Object.entries(DARK_TEXT).find(([source]) => source.toUpperCase() === originalPlaceholderColor.toUpperCase())?.[1] || originalPlaceholderColor
    : originalPlaceholderColor;
  return <RNTextInput {...props} placeholderTextColor={placeholderTextColor} style={themed(props.style, dark)} />;
}
