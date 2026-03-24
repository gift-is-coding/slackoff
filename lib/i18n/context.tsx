"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { dict, type Lang } from "./dict";

type I18nContextType = {
  lang: Lang;
  t: (key: keyof typeof dict.zh) => string;
  toggleLang: () => void;
};

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("zh");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("slackoff_lang") as Lang | null;
    if (saved && (saved === "zh" || saved === "en")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLang(saved);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const toggleLang = () => {
    setLang((prev) => {
      const next = prev === "zh" ? "en" : "zh";
      localStorage.setItem("slackoff_lang", next);
      return next;
    });
  };

  const t = (key: keyof typeof dict.zh) => {
    return dict[lang][key] || dict.zh[key];
  };

  // Prevent hydration mismatch by rendering default (or nothing) until mounted
  // but since we want to avoid flicker of empty content, we render children
  // Even if it mismatches, it's just text.
  if (!mounted) {
    return <I18nContext.Provider value={{ lang: "zh", t: (k) => dict.zh[k], toggleLang }}>{children}</I18nContext.Provider>;
  }

  return (
    <I18nContext.Provider value={{ lang, t, toggleLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return context;
}
