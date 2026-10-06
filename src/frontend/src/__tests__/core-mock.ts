import type { InternetIdentityContext } from "@caffeineai/core-infrastructure";
import { vi } from "vitest";
import type { FakeActor } from "./helpers";

/**
 * Shared mutable state backing the `@caffeineai/core-infrastructure` mock.
 *
 * Tests import this module and call `vi.mock("@caffeineai/core-infrastructure",
 * ...)` with a factory that reads from it, so a single fake actor and auth
 * context can be swapped per test without re-mocking the module.
 */
export const coreMock = {
  actor: null as FakeActor | null,
  isFetching: false,
  isAuthenticated: false,
  login: vi.fn(),
  clear: vi.fn(),
};

export function setCoreActor(actor: FakeActor | null): void {
  coreMock.actor = actor;
}

export function setAuthenticated(value: boolean): void {
  coreMock.isAuthenticated = value;
}

export function resetCoreMock(): void {
  coreMock.actor = null;
  coreMock.isFetching = false;
  coreMock.isAuthenticated = false;
  coreMock.login.mockReset();
  coreMock.clear.mockReset();
}

export function internetIdentityContext(): InternetIdentityContext {
  return {
    identity: undefined,
    login: coreMock.login,
    clear: coreMock.clear,
    loginStatus: coreMock.isAuthenticated ? "success" : "idle",
    isInitializing: false,
    isLoginIdle: !coreMock.isAuthenticated,
    isLoggingIn: false,
    isLoginSuccess: coreMock.isAuthenticated,
    isLoginError: false,
    isAuthenticated: coreMock.isAuthenticated,
  };
}
