import { AdminPool, UserRole } from "@/backend";
import type { GameActor } from "@/lib/api";
import { createGameApi, isGameError } from "@/lib/api";
import { Principal } from "@icp-sdk/core/principal";
import { describe, expect, it, vi } from "vitest";
import {
  account,
  adminResetOk,
  adminRoleChangeOk,
  adminStatus,
  adminUserListOk,
  adminWithdrawOk,
  betNumber,
  blockPage,
  dailyStatsOk,
  depositAddress,
  drawResult,
  gameState,
  guideText,
  ledgerBalance,
  mintOk,
  ok,
  tokenInfo,
  transferOk,
  walletBalances,
} from "./helpers";

describe("createGameApi", () => {
  it("forwards every method to the underlying actor with the same arguments", async () => {
    const actor: GameActor = {
      getGameState: vi.fn(async () => gameState()),
      getTopBetNumbers: vi.fn(async () => []),
      getDrawResult: vi.fn(async () => drawResult()),
      getRoundHistory: vi.fn(async () => []),
      getExchangePoolState: vi.fn(async () => ({
        luckyBalance: 0n,
        icpBalance: 0n,
      })),
      getTreasuryBalance: vi.fn(async () => 0n),
      getMyProfile: vi.fn(async () => ({
        luckyBalance: 0n,
        identity: "player" as never,
        lastActionAt: 0n,
        actionCooldownMs: 0n,
        betCount: 0n,
        winCount: 0n,
      })),
      getMyBetHistory: vi.fn(async () => ({ total: 0n, items: [] })),
      getMyWinHistory: vi.fn(async () => ({ total: 0n, items: [] })),
      placeBet: vi.fn(async () => ok()),
      placeBets: vi.fn(async () => ok()),
      placeBetSelections: vi.fn(async () => ok()),
      contributeCrowdfund: vi.fn(async () => ok()),
      exchangeIcpToLucky: vi.fn(async () => ok()),
      exchangeLuckyToIcp: vi.fn(async () => ok()),
      getWalletBalances: vi.fn(async () => walletBalances()),
      getDepositAddress: vi.fn(async () => depositAddress()),
      getRecentTransfers: vi.fn(async () => []),
      transferIcp: vi.fn(async () => ok()),
      transferLucky: vi.fn(async () => ok()),
      isCallerController: vi.fn(async () => false),
      isCallerAdmin: vi.fn(async () => false),
      getCallerRole: vi.fn(async () => UserRole.guest),
      listUsers: vi.fn(async () => adminUserListOk()),
      promoteToAdmin: vi.fn(async (user: Principal) =>
        adminRoleChangeOk(user, UserRole.admin),
      ),
      demoteToUser: vi.fn(async (user: Principal) =>
        adminRoleChangeOk(user, UserRole.user),
      ),
      getAdminStatus: vi.fn(async () => adminStatus()),
      getDailyStats: vi.fn(async () => dailyStatsOk()),
      stopNextRound: vi.fn(async () => ok()),
      resumeRound: vi.fn(async () => ok()),
      withdrawFromPool: vi.fn(async () => adminWithdrawOk()),
      resetGameData: vi.fn(async () => adminResetOk()),
      getGuideText: vi.fn(async () => guideText()),
      setGuideText: vi.fn(async () => ok()),
      devSeedBalance: vi.fn(async () => ok()),
      devAdvanceRound: vi.fn(async () => ok()),
      devSetRoundElapsed: vi.fn(async () => ok()),
      getTokenInfo: vi.fn(async () => tokenInfo()),
      mintLucky: vi.fn(async () => mintOk()),
      getLedgerBalance: vi.fn(async () => ledgerBalance()),
      icrc1_transfer: vi.fn(async () => transferOk()),
      icrc3_get_blocks: vi.fn(async () => blockPage()),
    };

    const api = createGameApi(actor);
    const recipient = Principal.fromText("aaaaa-aa");

    await api.getGameState();
    await api.getTopBetNumbers();
    await api.getDrawResult(7n);
    await api.getRoundHistory(20n);
    await api.getExchangePoolState();
    await api.getTreasuryBalance();
    await api.getMyProfile();
    await api.getMyBetHistory(0n, 20n);
    await api.getMyWinHistory(0n, 20n);
    await api.placeBet(betNumber("1234567"), 1n);
    await api.placeBets([betNumber("1234567")], [1n]);
    await api.placeBetSelections(
      [[1n], [2n], [3n], [4n], [5n], [6n], [7n]],
      [1n, 1n, 1n, 1n, 1n, 1n, 1n],
    );
    await api.contributeCrowdfund(1n, 3n, 100n);
    await api.exchangeIcpToLucky(100_000_000n);
    await api.exchangeLuckyToIcp(1000n);
    await api.getWalletBalances();
    await api.getDepositAddress();
    await api.getRecentTransfers();
    await api.transferIcp(recipient, 100_000_000n);
    await api.transferLucky(recipient, 500n);
    await api.isCallerController();
    await api.isCallerAdmin();
    await api.getCallerRole();
    await api.listUsers();
    await api.promoteToAdmin(recipient);
    await api.demoteToUser(recipient);
    await api.getAdminStatus();
    await api.getDailyStats("2026-09-01", "2026-09-07");
    await api.stopNextRound();
    await api.resumeRound();
    await api.withdrawFromPool(AdminPool.treasury, 500n, recipient);
    await api.resetGameData();
    await api.getGuideText();
    await api.setGuideText("新玩法说明");
    await api.getTokenInfo();
    await api.mintLucky({ to: account(), amount: 1000n, memo: undefined });
    await api.getLedgerBalance();
    await api.icrc1_transfer({ to: account(), amount: 500n });
    await api.icrc3_get_blocks(0n, 10n, null);

    expect(actor.getDrawResult).toHaveBeenCalledWith(7n);
    expect(actor.getRoundHistory).toHaveBeenCalledWith(20n);
    expect(actor.getMyBetHistory).toHaveBeenCalledWith(0n, 20n);
    expect(actor.getMyWinHistory).toHaveBeenCalledWith(0n, 20n);
    expect(actor.placeBet).toHaveBeenCalledWith(betNumber("1234567"), 1n);
    expect(actor.placeBets).toHaveBeenCalledWith([betNumber("1234567")], [1n]);
    expect(actor.placeBetSelections).toHaveBeenCalledWith(
      [[1n], [2n], [3n], [4n], [5n], [6n], [7n]],
      [1n, 1n, 1n, 1n, 1n, 1n, 1n],
    );
    expect(actor.contributeCrowdfund).toHaveBeenCalledWith(1n, 3n, 100n);
    expect(actor.exchangeIcpToLucky).toHaveBeenCalledWith(100_000_000n);
    expect(actor.exchangeLuckyToIcp).toHaveBeenCalledWith(1000n);
    expect(actor.getWalletBalances).toHaveBeenCalledTimes(1);
    expect(actor.getDepositAddress).toHaveBeenCalledTimes(1);
    expect(actor.getRecentTransfers).toHaveBeenCalledTimes(1);
    expect(actor.transferIcp).toHaveBeenCalledWith(recipient, 100_000_000n);
    expect(actor.transferLucky).toHaveBeenCalledWith(recipient, 500n);
    expect(actor.isCallerController).toHaveBeenCalledTimes(1);
    expect(actor.isCallerAdmin).toHaveBeenCalledTimes(1);
    expect(actor.getCallerRole).toHaveBeenCalledTimes(1);
    expect(actor.listUsers).toHaveBeenCalledTimes(1);
    expect(actor.promoteToAdmin).toHaveBeenCalledWith(recipient);
    expect(actor.demoteToUser).toHaveBeenCalledWith(recipient);
    expect(actor.getAdminStatus).toHaveBeenCalledTimes(1);
    expect(actor.getDailyStats).toHaveBeenCalledWith(
      "2026-09-01",
      "2026-09-07",
    );
    expect(actor.stopNextRound).toHaveBeenCalledTimes(1);
    expect(actor.resumeRound).toHaveBeenCalledTimes(1);
    expect(actor.withdrawFromPool).toHaveBeenCalledWith(
      AdminPool.treasury,
      500n,
      recipient,
    );
    expect(actor.resetGameData).toHaveBeenCalledTimes(1);
    expect(actor.getGuideText).toHaveBeenCalledTimes(1);
    expect(actor.setGuideText).toHaveBeenCalledWith("新玩法说明");
    expect(actor.getTokenInfo).toHaveBeenCalledTimes(1);
    expect(actor.mintLucky).toHaveBeenCalledWith({
      to: account(),
      amount: 1000n,
      memo: undefined,
    });
    expect(actor.getLedgerBalance).toHaveBeenCalledTimes(1);
    expect(actor.icrc1_transfer).toHaveBeenCalledWith({
      to: account(),
      amount: 500n,
    });
    expect(actor.icrc3_get_blocks).toHaveBeenCalledWith(0n, 10n, null);
  });
});

describe("isGameError", () => {
  it("recognizes a GameError variant object", () => {
    expect(isGameError(ok())).toBe(true);
    expect(
      isGameError({
        __kind__: "rateLimited",
        rateLimited: { remainingMs: 1n },
      }),
    ).toBe(true);
  });

  it("rejects non-error values", () => {
    expect(isGameError(null)).toBe(false);
    expect(isGameError(undefined)).toBe(false);
    expect(isGameError("ok")).toBe(false);
    expect(isGameError({})).toBe(false);
  });
});
