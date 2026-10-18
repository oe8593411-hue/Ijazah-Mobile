import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export const APP_LANGUAGES = [
  { code: "ar", name: "العربية", native: "العربية", rtl: true },
  { code: "en", name: "English", native: "English", rtl: false },
  { code: "fr", name: "French", native: "Français", rtl: false },
  { code: "es", name: "Spanish", native: "Español", rtl: false },
  { code: "de", name: "German", native: "Deutsch", rtl: false },
  { code: "tr", name: "Turkish", native: "Türkçe", rtl: false },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia", rtl: false },
  { code: "ur", name: "Urdu", native: "اردو", rtl: true },
  { code: "zh", name: "Chinese", native: "中文", rtl: false },
  { code: "ja", name: "Japanese", native: "日本語", rtl: false },
  { code: "ko", name: "Korean", native: "한국어", rtl: false },
  { code: "ru", name: "Russian", native: "Русский", rtl: false },
  { code: "hi", name: "Hindi", native: "हिन्दी", rtl: false },
  { code: "pt", name: "Portuguese", native: "Português", rtl: false },
  { code: "bn", name: "Bengali", native: "বাংলা", rtl: false },
  { code: "fa", name: "Persian", native: "فارسی", rtl: true },
  { code: "ms", name: "Malay", native: "Bahasa Melayu", rtl: false },
  { code: "sw", name: "Swahili", native: "Kiswahili", rtl: false },
  { code: "it", name: "Italian", native: "Italiano", rtl: false },
  { code: "nl", name: "Dutch", native: "Nederlands", rtl: false },
  { code: "pl", name: "Polish", native: "Polski", rtl: false },
  { code: "uk", name: "Ukrainian", native: "Українська", rtl: false },
  { code: "ha", name: "Hausa", native: "Hausa", rtl: false },
  { code: "ta", name: "Tamil", native: "தமிழ்", rtl: false },
  { code: "te", name: "Telugu", native: "తెలుగు", rtl: false },
  { code: "th", name: "Thai", native: "ไทย", rtl: false },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt", rtl: false },
  { code: "fil", name: "Filipino", native: "Filipino", rtl: false },
  { code: "am", name: "Amharic", native: "አማርኛ", rtl: false },
  { code: "so", name: "Somali", native: "Soomaali", rtl: false },
] as const;

type Preferences = {
  language: string;
  setLanguage: (value: string) => void;
  dark: boolean;
  setDark: (value: boolean) => void;
};
const PreferencesContext = createContext<Preferences | null>(null);

function readStored(key: string, fallback: string) {
  try {
    if (typeof localStorage !== "undefined") return localStorage.getItem(key) || fallback;
  } catch {}
  return fallback;
}
function writeStored(key: string, value: string) {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {}
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState("ar");
  const [dark, setDarkState] = useState(false);
  useEffect(() => {
    setLanguageState(readStored("ijazah-language", "ar"));
    setDarkState(readStored("ijazah-dark-mode", "false") === "true");
  }, []);
  const setLanguage = (value: string) => {
    setLanguageState(value);
    writeStored("ijazah-language", value);
  };
  const setDark = (value: boolean) => {
    setDarkState(value);
    writeStored("ijazah-dark-mode", String(value));
  };
  const value = useMemo(() => ({ language, setLanguage, dark, setDark }), [language, dark]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}
export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider");
  return value;
}
