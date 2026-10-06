import { AppShell } from "@/components/AppShell";
import { AccountPage } from "@/pages/AccountPage";
import { AdminPage } from "@/pages/AdminPage";
import { ArenaPage } from "@/pages/ArenaPage";
import { CrowdfundPage } from "@/pages/CrowdfundPage";
import { ExchangePage } from "@/pages/ExchangePage";
import { GuidePage } from "@/pages/GuidePage";
import { HistoryPage } from "@/pages/HistoryPage";
import { RankingPage } from "@/pages/RankingPage";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { Toaster } from "sonner";

function Layout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

const rootRoute = createRootRoute({ component: Layout });

const arenaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ArenaPage,
});

const crowdfundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/crowdfund",
  component: CrowdfundPage,
});

const rankingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/ranking",
  component: RankingPage,
});

// Dedicated token-exchange page, reachable from the bottom navigation.
const exchangeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/exchange",
  component: ExchangePage,
});

// Personal center: the single destination behind the header auth control.
const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account",
  component: AccountPage,
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history",
  component: HistoryPage,
});

const guideRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/guide",
  component: GuidePage,
});

// Super-admin console. Reachable only from the controller-gated nav entry; the
// page itself renders a no-permission state for non-controller callers.
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminPage,
});

const routeTree = rootRoute.addChildren([
  arenaRoute,
  crowdfundRoute,
  rankingRoute,
  exchangeRoute,
  accountRoute,
  historyRoute,
  guideRoute,
  adminRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors />
    </>
  );
}
