import { LanguageProvider } from "@/i18n/LanguageProvider";
import { InternetIdentityProvider } from "@caffeineai/core-infrastructure";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

BigInt.prototype.toJSON = function () {
  return this.toString();
};

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

// The app is dark-only: apply the `dark` class before first paint so the
// near-black terminal theme is active from the very first frame.
document.documentElement.classList.add("dark");

// Shared cache tuned for a polling-heavy live app:
// - `staleTime` matches the fastest poll cadence, so a component that mounts
//   within one poll window reuses the cached value instead of firing a fresh
//   request. This removes the mount-refetch storm when navigating between tabs.
// - `gcTime` keeps recently used data alive across route changes so returning
//   to a tab renders instantly from cache.
// - `refetchOnWindowFocus` is off: the live queries already poll on an interval,
//   so a focus refetch only duplicates work.
// - `retry` is capped so a transient canister error does not multiply requests.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
      retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <InternetIdentityProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </InternetIdentityProvider>
  </QueryClientProvider>,
);
