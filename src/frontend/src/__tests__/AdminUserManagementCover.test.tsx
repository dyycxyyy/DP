import { UserRole } from "@/backend";
import { AdminPage } from "@/pages/AdminPage";
import { Principal } from "@icp-sdk/core/principal";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  coreMock,
  internetIdentityContext,
  resetCoreMock,
  setAuthenticated,
  setCoreActor,
} from "./core-mock";
import {
  adminRoleChangeErr,
  adminRoleChangeOk,
  adminStatus,
  adminUserEntry,
  adminUserListErr,
  adminUserListOk,
  createFakeActor,
} from "./helpers";
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

const ADMIN = Principal.fromText("aaaaa-aa");
const USER = Principal.fromText("2vxsx-fae");

/**
 * Cover for the admin console's user-management section.
 *
 * The accepted work adds a role-based admin system: an admin sees every
 * registered user with their role and identity label, and can promote a regular
 * user or demote another admin. The section is only reachable once the caller is
 * authorized, so a non-admin never triggers `listUsers` or a role change. The
 * actor is a local typed mock, so this proves the frontend's contract with the
 * actor, never the real canister's authorization.
 */
describe("admin user management", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    setAuthenticated(true);
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("lists every registered user with their role and identity label", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(async () => UserRole.admin),
        getAdminStatus: vi.fn(async () => adminStatus()),
        listUsers: vi.fn(async () =>
          adminUserListOk([
            adminUserEntry(ADMIN, UserRole.admin),
            adminUserEntry(USER, UserRole.user),
          ]),
        ),
      }),
    );

    renderWithProviders(<AdminPage />);

    const section = await screen.findByTestId("admin.users.section");
    const table = await within(section).findByTestId("admin.users.table");
    // Both users are listed, with their principal rendered as the identity label
    // so same-named users can be told apart.
    expect(within(table).getByText(ADMIN.toText())).toBeInTheDocument();
    expect(within(table).getByText(USER.toText())).toBeInTheDocument();
    expect(within(table).getByText("管理员")).toBeInTheDocument();
    expect(within(table).getByText("普通用户")).toBeInTheDocument();
  });

  it("promotes a regular user to admin", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      getAdminStatus: vi.fn(async () => adminStatus()),
      listUsers: vi.fn(async () =>
        adminUserListOk([adminUserEntry(USER, UserRole.user)]),
      ),
      promoteToAdmin: vi.fn(async () =>
        adminRoleChangeOk(USER, UserRole.admin),
      ),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<AdminPage />);

    await user.click(await screen.findByTestId("admin.users.promote_button.1"));

    await waitFor(() =>
      expect(actor.promoteToAdmin).toHaveBeenCalledWith(USER),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it("demotes another admin back to a regular user", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      getAdminStatus: vi.fn(async () => adminStatus()),
      listUsers: vi.fn(async () =>
        adminUserListOk([adminUserEntry(USER, UserRole.admin)]),
      ),
      demoteToUser: vi.fn(async () => adminRoleChangeOk(USER, UserRole.user)),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<AdminPage />);

    await user.click(await screen.findByTestId("admin.users.demote_button.1"));

    await waitFor(() => expect(actor.demoteToUser).toHaveBeenCalledWith(USER));
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows an empty state when no users are registered", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(async () => UserRole.admin),
        getAdminStatus: vi.fn(async () => adminStatus()),
        listUsers: vi.fn(async () => adminUserListOk([])),
      }),
    );

    renderWithProviders(<AdminPage />);

    expect(
      await screen.findByTestId("admin.users.empty_state"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("admin.users.table")).not.toBeInTheDocument();
  });

  it("surfaces a failed role change as an inline row error", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      getAdminStatus: vi.fn(async () => adminStatus()),
      listUsers: vi.fn(async () =>
        adminUserListOk([adminUserEntry(USER, UserRole.user)]),
      ),
      promoteToAdmin: vi.fn(async () =>
        adminRoleChangeErr({ __kind__: "notRegistered", notRegistered: null }),
      ),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<AdminPage />);

    await user.click(await screen.findByTestId("admin.users.promote_button.1"));

    expect(
      await screen.findByTestId("admin.users.row_error.1"),
    ).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("surfaces a failed user-list read as an error state", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(async () => UserRole.admin),
        getAdminStatus: vi.fn(async () => adminStatus()),
        listUsers: vi.fn(async () =>
          adminUserListErr({ __kind__: "notRegistered", notRegistered: null }),
        ),
      }),
    );

    renderWithProviders(<AdminPage />);

    expect(
      await screen.findByTestId("admin.users.error_state"),
    ).toBeInTheDocument();
  });

  it("never lists users or changes a role for a non-admin caller", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.user),
    });
    setCoreActor(actor);

    renderWithProviders(<AdminPage />);

    expect(
      await screen.findByTestId("admin.no_permission"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("admin.users.section")).not.toBeInTheDocument();
    expect(actor.listUsers).not.toHaveBeenCalled();
    expect(actor.promoteToAdmin).not.toHaveBeenCalled();
    expect(actor.demoteToUser).not.toHaveBeenCalled();
  });
});
