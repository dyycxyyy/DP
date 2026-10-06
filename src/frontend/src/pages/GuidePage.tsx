import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  useGuideText,
  useIsCallerController,
  useSetGuideText,
} from "@/hooks/useGame";
import { useTranslation } from "@/i18n/useTranslation";
import { gameErrorMessage, toErrorMessage } from "@/lib/errors";
import { BookOpen, Pencil, Save, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Split admin-authored guide text into paragraphs on blank lines, preserving
 * single newlines as line breaks inside a paragraph. A run of blank lines
 * separates blocks; leading/trailing whitespace is trimmed so the layout stays
 * tight regardless of how the admin spaced the source text.
 */
function toParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
}

/** Render one paragraph, turning single newlines into explicit line breaks. */
function GuideParagraph({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
      {lines.map((line, index) => (
        // Lines are positional within a paragraph and never reordered, so the
        // index is a stable identity here.
        // biome-ignore lint/suspicious/noArrayIndexKey: positional line breaks
        <span key={index}>
          {line}
          {index < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </p>
  );
}

/**
 * The 玩法说明 page.
 *
 * Content is admin-authored plain text stored on the backend. Every visitor
 * reads the saved text (or a sensible default when nothing is set yet); only a
 * caller with the platform admin role sees the edit control, which opens a
 * textarea pre-filled with the current text and saves through `setGuideText`.
 */
export function GuidePage() {
  const { t } = useTranslation();
  const { data, isLoading } = useGuideText();
  const { isController: isAdmin } = useIsCallerController();
  const setGuideText = useSetGuideText();

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    document.title = `${t("nav.guide")} · ${t("app.name")}`;
  }, [t]);

  const savedText = data?.text ?? "";
  const isSet = data?.isSet ?? false;
  const defaultText = t("guide.defaultText");
  const displayText =
    isSet && savedText.trim() !== "" ? savedText : defaultText;
  const paragraphs = toParagraphs(displayText);

  const openEditor = () => {
    setDraft(isSet && savedText.trim() !== "" ? savedText : defaultText);
    setIsEditing(true);
  };

  const closeEditor = () => {
    setIsEditing(false);
    setDraft("");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const next = draft.trim();
    if (next === "" || setGuideText.isPending) return;
    setGuideText.mutate(next, {
      onSuccess: (result) => {
        if (result && result.__kind__ !== "ok") {
          toast.error(gameErrorMessage(t, result));
          return;
        }
        toast.success(t("guide.edit.success"));
        closeEditor();
      },
      onError: (error) => {
        toast.error(toErrorMessage(t, error));
      },
    });
  };

  return (
    <div data-ocid="guide.page" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen
            className="size-5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <h1 className="truncate font-display text-xl font-bold tracking-tight">
            {t("guide.title")}
          </h1>
        </div>
        {isAdmin && !isEditing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-ocid="guide.edit_button"
            onClick={openEditor}
            className="shrink-0"
          >
            <Pencil className="size-4" aria-hidden="true" />
            {t("guide.edit.action")}
          </Button>
        ) : null}
      </div>

      {isAdmin && !isSet && !isEditing ? (
        <p
          data-ocid="guide.edit.empty_state"
          className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground"
        >
          {t("guide.edit.empty")}
        </p>
      ) : null}

      {isEditing ? (
        <Card
          data-ocid="guide.edit.panel"
          className="gap-3 rounded-lg border-border py-4 shadow-none"
        >
          <CardHeader className="px-4">
            <CardTitle className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("guide.edit.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("guide.edit.hint")}
              </p>
              <Textarea
                data-ocid="guide.edit.textarea"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t("guide.edit.placeholder")}
                aria-label={t("guide.edit.title")}
                rows={12}
                className="min-h-48 resize-y font-body"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-ocid="guide.edit.cancel_button"
                  onClick={closeEditor}
                  disabled={setGuideText.isPending}
                >
                  <X className="size-4" aria-hidden="true" />
                  {t("guide.edit.cancel")}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  data-ocid="guide.edit.save_button"
                  disabled={setGuideText.isPending || draft.trim() === ""}
                >
                  <Save className="size-4" aria-hidden="true" />
                  {setGuideText.isPending
                    ? t("guide.edit.saving")
                    : t("guide.edit.save")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card
        data-ocid="guide.content.panel"
        className="gap-3 rounded-lg border-border py-4 shadow-none"
      >
        <CardContent className="space-y-3 px-4">
          {isLoading ? (
            <div
              data-ocid="guide.loading_state"
              className="space-y-2"
              aria-busy="true"
            >
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
            </div>
          ) : (
            paragraphs.map((paragraph, index) => (
              // Paragraphs are positional blocks of one document; the index is
              // a stable identity because the list is never reordered.
              // biome-ignore lint/suspicious/noArrayIndexKey: positional paragraphs
              <GuideParagraph key={index} text={paragraph} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
