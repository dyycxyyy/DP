import { UserRole } from "@/backend";
import { useCallerRole } from "@/hooks/useGame";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  coreMock,
  internetIdentityContext,
  resetCoreMock,
  setCoreActor,
} from "./core-mock";
import { createFakeActor } from "./helpers";

vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: coreMock.actor, isFetching: coreMock.isFetching }),
  useInternetIdentity: () => internetIdentityContext(),
  InternetIdentityProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

/**
 * Cover for the platform-role admin authorization seam.
 *
 * The accepted work moves admin authority from the canister-controller identity
 * to the platform application-level role system (`#admin` / `#user` / `#guest`).
 * `useCallerRole` is the frontend consumer of that role: it reads
 * `getCallerRole()` and exposes `isAdmin`. These tests pin the contract the
 * admin-gated surfaces rely on — an admin is recognized, a user/guest is not,
 * and the gate fails closed while the role is unresolved or the read errors.
 *
 * The actor is a local typed mock, so this proves the frontend's contract with
 * the actor, never the real canister's authorization.
 */
describe("useCallerRole platform-role contract", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  afterEach(() => {
    resetCoreMock();
  });

  it("reports an admin caller as admin and isAdmin true", async () => {
    setCoreActor(
      createFakeActor({ getCallerRole: vi.fn(async () => UserRole.admin) }),
    );

    const { result } = renderHook(() => useCallerRole(), { wrapper });

    await waitFor(() => expect(result.current.role).toBe(UserRole.admin));
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it("reports a regular user as not admin", async () => {
    setCoreActor(
      createFakeActor({ getCallerRole: vi.fn(async () => UserRole.user) }),
    );

    const { result } = renderHook(() => useCallerRole(), { wrapper });

    await waitFor(() => expect(result.current.role).toBe(UserRole.user));
    expect(result.current.isAdmin).toBe(false);
  });

  it("reports a guest as not admin", async () => {
    setCoreActor(
      createFakeActor({ getCallerRole: vi.fn(async () => UserRole.guest) }),
    );

    const { result } = renderHook(() => useCallerRole(), { wrapper });

    await waitFor(() => expect(result.current.role).toBe(UserRole.guest));
    expect(result.current.isAdmin).toBe(false);
  });

  it("fails closed while the role read is unresolved", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(() => new Promise<UserRole>(() => {})),
      }),
    );

    const { result } = renderHook(() => useCallerRole(), { wrapper });

    // The query is pending, so no role is exposed and the gate is closed.
    expect(result.current.role).toBeNull();
    expect(result.current.isAdmin).toBe(false);
  });

  it("fails closed when the role read rejects", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(async () => {
          throw new Error("backend unavailable");
        }),
      }),
    );

    const { result } = renderHook(() => useCallerRole(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.role).toBeNull();
    expect(result.current.isAdmin).toBe(false);
  });
});
