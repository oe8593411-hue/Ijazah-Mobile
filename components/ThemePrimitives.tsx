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
  "#F4F8FC": "#0B1F32", "#F2F5F8": "#0B1F32", "#F0F6FA": "#102B43",
  "#FFFFFF": "#102B43", "#fff": "#102B43", "#35C7DE": "#147D91", "#168DA5": "#176A7D",
  "#E5F8FC": "#173B52", "#EAF7FC": "#173B52", "#E8F6FC": "#173B52",
  "#DDF7FA": "#1A4058", "#E6F7FB": "#173B52", "#D4F1F7": "#1A4058",
  "#D1F0F7": "#1A4058", "#F1F7FB": "#102B43", "#EEF4F8": "#173B52",
  "#E0EAF2": "#29465D", "#E0E7ED": "#29465D", "#EDF2F7": "#29465D",
  "#E8EEF4": "#29465D", "#E8EDF2": "#29465D",
  "#FFF8E6": "#3B3425", "#F4EBD7": "#3B3425",
  "#D5EDF5": "#173B52", "#B7E8F6": "#173B52", "#D1E5EE": "#173B52",
  "#DCEEF6": "#173B52", "#C5E4F1": "#173B52", "#DCE3EA": "#29465D",
  "#F5F7FA": "#102B43", "#F5F7FA": "#102B43", "#F0FBFD": "#102B43",
  "#E5EFF4": "#173B52", "#E7F7FD": "#173B52", "#EAF1FC": "#173B52",
  "#F8F0DE": "#3B3425", "#F4EFE3": "#3B3425", "#F5D27A": "#3B3425",
  "#D8DEE7": "#29465D", "#D6E0E9": "#29465D", "#E0E7ED": "#29465D",
  "#DDF9FC": "#173B52", "#C9E9F5": "#173B52", "#A8D8EF": "#173B52",
  "#E5F8FC": "#173B52", "#DDF7FA": "#173B52", "#EAF7FC": "#173B52",
};
const DARK_TEXT: Record<string, string> = {
  "#071A33": "#F3FAFD", "#142A43": "#F3FAFD", "#0D2238": "#F3FAFD",
  "#17657B": "#8EDBEA", "#526F83": "#B8C9D9", "#52707D": "#B8C9D9",
  "#527789": "#B8C9D9", "#6D7E90": "#B4C5D4", "#6E879B": "#B4C5D4",
  "#788BA0": "#B4C5D4", "#8794A3": "#B4C5D4", "#6F8795": "#B4C5D4",
  "#766341": "#D7C49C", "#806F4C": "#D7C49C", "#805D11": "#E9CB82",
  "#168DA5": "#66D1E2", "#137E95": "#66D1E2", "#1AA6BD": "#66D1E2",
  "#294760": "#B8D5E6", "#245C7B": "#8EDBEA", "#173451": "#B8D5E6",
  "#102B49": "#B8D5E6", "#102746": "#B8D5E6", "#12304D": "#B8D5E6",
  "#164B6A": "#8EDBEA", "#1A4B70": "#8EDBEA", "#1A4A65": "#8EDBEA",
  "#246A8C": "#8EDBEA", "#267A9B": "#8EDBEA", "#2B6474": "#8EDBEA",
  "#526C7D": "#B8C9D9", "#58788C": "#B8C9D9", "#6C9AAF": "#B8C9D9",
  "#7A91A2": "#B8C9D9", "#70889B": "#B8C9D9", "#6D899A": "#B8C9D9",
  "#A9C1D5": "#B8C9D9", "#AFCBDD": "#B8C9D9", "#9FB6CC": "#B8C9D9",
  "#B5C7D8": "#B8C9D9", "#9AA0A6": "#B8C9D9", "#8E98A6": "#B8C9D9",
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
