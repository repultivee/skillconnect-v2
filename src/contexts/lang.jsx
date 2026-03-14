import { createContext, useContext, useEffect, useMemo, useState } from "react";

const LangContext = createContext(null);

const DICT = {
  ru: {
    searchPlaceholder: "Поиск по постам...",
    chats: "Чаты",
    account: "Аккаунт",
    settings: "Настройки",
    logout: "Выйти",
    login: "Войти",
    register: "Регистрация",
    home: "Главная",
    create: "Создать",
  },
  en: {
    searchPlaceholder: "Search posts...",
    chats: "Chats",
    account: "Account",
    settings: "Settings",
    logout: "Logout",
    login: "Login",
    register: "Register",
    home: "Home",
    create: "Create",
  },
};

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("sc_lang") || "ru");

  useEffect(() => {
    localStorage.setItem("sc_lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useMemo(() => {
    const pack = DICT[lang] || DICT.ru;
    return (key) => pack[key] ?? key;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside LangProvider");
  return ctx;
}