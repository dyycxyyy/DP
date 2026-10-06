import {
  type ReactNode,
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  LANGUAGE_TAGS,
  type Language,
  toLanguage,
} from "./translations";

export interface LanguageContextValue {
  /** The active interface language. */
  language: Language;
  /** Switch the interface language and persist the choice. */
  setLanguage: (language: Language) => void;
  /** Toggle between Chinese and English. */
  toggleLanguage: () => void;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

/** Read the persisted language preference, defaulting to Chinese. */
function readStoredLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    return (
      toLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)) ??
      DEFAULT_LANGUAGE
    );
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/**
 * Provides the interface language to the whole app.
 *
 * The preference is persisted in localStorage and defaults to Chinese. The
 * active language is mirrored onto `<html lang>` so CJK glyph correction and
 * screen-reader pronunciation follow the visible copy.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  useEffect(() => {
    document.documentElement.lang = LANGUAGE_TAGS[language];
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Storage can be unavailable (private mode); the in-memory choice stands.
    }
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((current) => (current === "zh" ? "en" : "zh"));
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, toggleLanguage }),
    [language, setLanguage, toggleLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
