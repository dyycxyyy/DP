import { UserRole } from "@/backend";
import { LanguageToggle } from "@/components/LanguageToggle";
import { translations } from "@/i18n/translations";
import { GuidePage } from "@/pages/GuidePage";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  coreMock,
  internetIdentityContext,
  resetCoreMock,
  setCoreActor,
} from "./core-mock";
import { createFakeActor, guideText, ok } from "./helpers";
import { renderWithProviders } from "./render";

vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: coreMock.actor, isFetching: coreMock.isFetching }),
  useInternetIdentity: () => internetIdentityContext(),
  InternetIdentityProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}));

/**
 * Cover for the admin-editable "How to Play" guide.
 *
 * The accepted work replaces the static guide with a plain-text document stored
 * on the backend: every visitor reads the saved text (or a default when nothing
 * is set), only a caller with the platform admin role sees the edit control, and
 * saving persists through `setGuideText`. The actor is a local typed mock, so
 * this proves the frontend's contract with the actor, never the real canister's
 * behavior.
 */
describe("guide page reads the saved document", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "";
  });

  it("shows the admin-saved text when one is set", async () => {
    setCoreActor(
      createFakeActor({
        getGuideText: vi.fn(async () =>
          guideText({ text: "第一段\n\n第二段", isSet: true }),
        ),
      }),
    );

    renderWithProviders(<GuidePage />);

    await waitFor(() =>
      expect(screen.getByTestId("guide.content.panel")).toHaveTextContent(
        "第一段",
      ),
    );
    expect(screen.getByTestId("guide.content.panel")).toHaveTextContent(
      "第二段",
    );
  });

  it("falls back to the default text when nothing is set", async () => {
    setCoreActor(
      createFakeActor({
        getGuideText: vi.fn(async () => guideText({ text: "", isSet: false })),
      }),
    );

    renderWithProviders(<GuidePage />);

    await waitFor(() =>
      expect(screen.getByTestId("guide.content.panel")).toHaveTextContent(
        "开奖号码不是外部随机源",
      ),
    );
  });

  it("renders multi-paragraph text as separate blocks and keeps single newlines", async () => {
    setCoreActor(
      createFakeActor({
        getGuideText: vi.fn(async () =>
          guideText({ text: "A1\nA2\n\nB1", isSet: true }),
        ),
      }),
    );

    renderWithProviders(<GuidePage />);

    await waitFor(() =>
      expect(
        screen.getByTestId("guide.content.panel").querySelectorAll("p"),
      ).toHaveLength(2),
    );
    const content = screen.getByTestId("guide.content.panel");
    // Two paragraphs: the blank line splits them, the single newline stays.
    const paragraphs = content.querySelectorAll("p");
    expect(paragraphs[0]).toHaveTextContent("A1");
    expect(paragraphs[0]).toHaveTextContent("A2");
    expect(paragraphs[1]).toHaveTextContent("B1");
  });

  it("does not show the edit control to a non-admin", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(async () => UserRole.user),
        getGuideText: vi.fn(async () =>
          guideText({ text: "只读内容", isSet: true }),
        ),
      }),
    );

    renderWithProviders(<GuidePage />);

    await screen.findByTestId("guide.content.panel");
    expect(screen.queryByTestId("guide.edit_button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("guide.edit.panel")).not.toBeInTheDocument();
  });
});

describe("guide page admin editing", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "";
  });

  it("lets an admin edit and save the text through setGuideText", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      getGuideText: vi.fn(async () =>
        guideText({ text: "旧内容", isSet: true }),
      ),
      setGuideText: vi.fn(async () => ok()),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<GuidePage />);

    await user.click(await screen.findByTestId("guide.edit_button"));
    const textarea = screen.getByTestId("guide.edit.textarea");
    // The editor opens pre-filled with the current text.
    expect(textarea).toHaveValue("旧内容");

    await user.clear(textarea);
    await user.type(textarea, "新内容");
    await user.click(screen.getByTestId("guide.edit.save_button"));

    await waitFor(() =>
      expect(actor.setGuideText).toHaveBeenCalledWith("新内容"),
    );
    // The success toast fires from the mutation's onSuccess, one microtask
    // after the actor call is recorded, so wait for it rather than asserting
    // synchronously.
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("shows the empty-state hint to an admin before anything is set", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(async () => UserRole.admin),
        getGuideText: vi.fn(async () => guideText({ text: "", isSet: false })),
      }),
    );

    renderWithProviders(<GuidePage />);

    expect(
      await screen.findByTestId("guide.edit.empty_state"),
    ).toBeInTheDocument();
  });

  it("cancels editing without saving", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      getGuideText: vi.fn(async () =>
        guideText({ text: "旧内容", isSet: true }),
      ),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<GuidePage />);

    await user.click(await screen.findByTestId("guide.edit_button"));
    await user.click(screen.getByTestId("guide.edit.cancel_button"));

    expect(screen.queryByTestId("guide.edit.panel")).not.toBeInTheDocument();
    expect(actor.setGuideText).not.toHaveBeenCalled();
  });
});

describe("guide page language toggle", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    setCoreActor(
      createFakeActor({
        getGuideText: vi.fn(async () => guideText({ text: "", isSet: false })),
      }),
    );
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "";
  });

  it("switches the default guide text from Chinese to English", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <LanguageToggle />
        <GuidePage />
      </>,
    );

    const content = await screen.findByTestId("guide.content.panel");
    await waitFor(() =>
      expect(content).toHaveTextContent("开奖号码不是外部随机源"),
    );

    await user.click(screen.getByRole("radio", { name: "切换到English" }));

    await waitFor(() =>
      expect(screen.getByTestId("guide.content.panel")).toHaveTextContent(
        "The winning number is not an external random source",
      ),
    );
  });
});
