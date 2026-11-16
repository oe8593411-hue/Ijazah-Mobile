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
};
const DARK_TEXT: Record<string, string> = {
  "#071A33": "#F3FAFD", "#142A43": "#F3FAFD", "#0D2238": "#F3FAFD",
  "#17657B": "#8EDBEA", "#526F83": "#B8C9D9", "#52707D": "#B8C9D9",
  "#527789": "#B8C9D9", "#6D7E90": "#B4C5D4", "#6E879B": "#B4C5D4",
  "#788BA0": "#B4C5D4", "#8794A3": "#B4C5D4", "#6F8795": "#B4C5D4",
  "#766341": "#D7C49C", "#806F4C": "#D7C49C", "#805D11": "#E9CB82",
  "#168DA5": "#66D1E2", "#137E95": "#66D1E2", "#1AA6BD": "#66D1E2",
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
  const style = typeof props.style === "function" ? (state: any) => themed(props.style?.(state), dark) : themed(props.style, dark);
  return <RNPressable {...props} style={style} />;
}
export function ThemeView(props: ViewProps) {
  const { dark } = usePreferences();
  return <RNView {...props} style={themed(props.style, dark, "view")} />;
}
export function ThemeText(props: TextProps) {
  const { dark } = usePreferences();
  return <RNText {...props} style={themed(props.style, dark)} />;
}
export function ThemeScrollView(props: ScrollViewProps) {
  const { dark } = usePreferences();
  return <RNScrollView {...props} style={themed(props.style, dark, "view")} />;
}
export function ThemeTextInput(props: TextInputProps) {
  const { dark } = usePreferences();
  const placeholderTextColor = dark && props.placeholderTextColor
    ? DARK_TEXT[props.placeholderTextColor.toUpperCase()] || props.placeholderTextColor
    : props.placeholderTextColor;
  return <RNTextInput {...props} placeholderTextColor={placeholderTextColor} style={themed(props.style, dark, "text")} />;
}
