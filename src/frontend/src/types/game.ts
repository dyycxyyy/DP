import type {
  BetNumber,
  BetRecord,
  Digit,
  DigitCrowdfund,
  DrawResult,
  ExchangePoolState,
  GameError,
  GameState,
  PlayerIdentity,
  PlayerProfile,
  Position,
  PositionCrowdfund,
  RoundHistoryEntry,
  TierResult,
  TopBetNumber,
  WinRecord,
} from "@/backend";
import type { TranslationKey, Translator } from "@/i18n/translations";

export type {
  BetNumber,
  BetRecord,
  Digit,
  DigitCrowdfund,
  DrawResult,
  ExchangePoolState,
  GameError,
  GameState,
  PlayerIdentity,
  PlayerProfile,
  Position,
  PositionCrowdfund,
  RoundHistoryEntry,
  TierResult,
  TopBetNumber,
  WinRecord,
};

export { Phase, PlayerIdentity as PlayerIdentityEnum } from "@/backend";

/** A single digit selection per position for the bet form. */
export type DigitSelection = Set<number>;

/** The 7 positions of a bet number, each holding 1..10 selected digits. */
export type BetSelections = DigitSelection[];

export const POSITION_COUNT = 7;
export const CROWDFUND_POSITION_COUNT = 3;
export const DIGIT_COUNT = 10;
export const CROWDFUND_THRESHOLD = 100_000n;
export const TICKET_PRICE = 1n;
export const ICP_TO_LUCKY_RATE = 1000n;
export const ICP_E8S_PER_ICP = 100_000_000n;
export const LUCKY_TO_ICP_FEE_BPS = 300n;

export interface PhaseMeta {
  /** CSS custom-property token suffix driving the phase accent color. */
  token: string;
  /** Translation key for the full phase label. */
  labelKey: TranslationKey;
  /** Translation key for the compact phase label. */
  shortKey: TranslationKey;
  /** Translation key for the phase description. */
  descKey: TranslationKey;
}

export const PHASE_META: Record<string, PhaseMeta> = {
  betting: {
    token: "phase-bet",
    labelKey: "phase.betting",
    shortKey: "phase.betting.short",
    descKey: "phase.betting.desc",
  },
  crowdfunding: {
    token: "phase-crowd",
    labelKey: "phase.crowdfunding",
    shortKey: "phase.crowdfunding.short",
    descKey: "phase.crowdfunding.desc",
  },
  drawing: {
    token: "phase-draw",
    labelKey: "phase.drawing",
    shortKey: "phase.drawing.short",
    descKey: "phase.drawing.desc",
  },
  payout: {
    token: "phase-pay",
    labelKey: "phase.payout",
    shortKey: "phase.payout.short",
    descKey: "phase.payout.desc",
  },
};

/** Resolve a phase's full label through the active translator. */
export function phaseLabel(t: Translator, phase: string): string {
  const meta = PHASE_META[phase];
  return meta ? t(meta.labelKey) : phase;
}

export const PHASE_ORDER = [
  "betting",
  "crowdfunding",
  "drawing",
  "payout",
] as const;

export interface IdentityMeta {
  /** Translation key for the identity label. */
  labelKey: TranslationKey;
  /** Translation key for the identity description. */
  descKey: TranslationKey;
  className: string;
}

export const IDENTITY_META: Record<string, IdentityMeta> = {
  player: {
    labelKey: "identity.player",
    descKey: "identity.player.desc",
    className: "border-border bg-muted text-muted-foreground",
  },
  manipulator: {
    labelKey: "identity.manipulator",
    descKey: "identity.manipulator.desc",
    className: "border-warning/40 bg-warning/15 text-warning",
  },
  conspirator: {
    labelKey: "identity.conspirator",
    descKey: "identity.conspirator.desc",
    className: "border-destructive/40 bg-destructive/15 text-destructive",
  },
};

/** Translation key for each prize tier (7-digit match down to 1-digit). */
export const TIER_LABELS: Record<number, TranslationKey> = {
  7: "tier.7",
  6: "tier.6",
  5: "tier.5",
  4: "tier.4",
  3: "tier.3",
  2: "tier.2",
  1: "tier.1",
};

/** Resolve a prize tier's label through the active translator. */
export function tierLabel(t: Translator, tier: bigint): string {
  const key = TIER_LABELS[Number(tier)] ?? "tier.other";
  return t(key, { tier: tier.toString() });
}
