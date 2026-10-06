import { LANGUAGES, type Language } from "@/i18n/translations";
import { useTranslation } from "@/i18n/useTranslation";
import { cn } from "@/lib/utils";

const LABEL_KEYS = {
  zh: "lang.zh",
  en: "lang.en",
} as const;

const FULL_NAMES: Record<Language, string> = {
  zh: "中文",
  en: "English",
};

/**
 * Segmented 中/EN language switch for the terminal header.
 *
 * Built on native radio inputs so keyboard arrow navigation and screen-reader
 * announcement of the active language come for free; the visible pill is the
 * styled label.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { language, setLanguage, t } = useTranslation();

  return (
    <fieldset
      data-ocid="lang.toggle"
      aria-label={t("lang.label")}
      className={cn(
        "toggle-track m-0 inline-flex items-center gap-0.5 rounded-full border-0 p-0.5",
        className,
      )}
    >
      {LANGUAGES.map((option) => {
        const isActive = option === language;
        return (
          <label
            key={option}
            data-ocid={`lang.option.${option}`}
            className={cn(
              "tap-target flex min-w-9 cursor-pointer items-center justify-center rounded-full px-2 text-xs font-bold transition-snap",
              isActive
                ? "toggle-thumb text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <input
              type="radio"
              name="interface-language"
              value={option}
              checked={isActive}
              aria-label={t("lang.switchTo", { lang: FULL_NAMES[option] })}
              onChange={() => setLanguage(option)}
              className="sr-only"
            />
            {t(LABEL_KEYS[option])}
          </label>
        );
      })}
    </fieldset>
  );
}
