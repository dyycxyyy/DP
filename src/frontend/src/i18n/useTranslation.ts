import { useContext } from "react";
import { LanguageContext, type LanguageContextValue } from "./LanguageProvider";
import {
  type Language,
  type TranslationKey,
  type TranslationVars,
  translate,
} from "./translations";

export interface UseTranslationResult {
  /** Translate a key, interpolating `{name}` placeholders from `vars`. */
  t: (key: TranslationKey, vars?: TranslationVars) => string;
  /** The active interface language. */
  language: Language;
  /** Switch the interface language and persist the choice. */
  setLanguage: (language: Language) => void;
  /** Toggle between Chinese and English. */
  toggleLanguage: () => void;
}

/**
 * Access the active language and the `t()` translator.
 *
 * Must be called under `LanguageProvider`; the provider is mounted at the app
 * root in `main.tsx`, so every component can rely on it.
 */
export function useTranslation(): UseTranslationResult {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  const { language, setLanguage, toggleLanguage } = context;
  const t = (key: TranslationKey, vars?: TranslationVars) =>
    translate(language, key, vars);
  return { t, language, setLanguage, toggleLanguage };
}

export type { LanguageContextValue };
