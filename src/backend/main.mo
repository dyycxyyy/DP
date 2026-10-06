import AccessControl "mo:caffeineai-authorization/access-control";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import Expose "mo:caffeineai-oql/Expose";
import OQL "mo:caffeineai-oql";
import Entity "mo:caffeineai-oql/Entity";
import NatValue "mo:caffeineai-oql/NatValue";
import IntValue "mo:caffeineai-oql/IntValue";
import TextValue "mo:caffeineai-oql/TextValue";
import PrincipalValue "mo:caffeineai-oql/PrincipalValue";
import Iter "mo:core/Iter";
import List "mo:core/List";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Text "mo:core/Text";
import State "types/state";
import Game "types/game";
import Wallet "types/wallet";
import Admin "types/admin";
import LuckyLedger "types/lucky-ledger";
import GameApi "mixins/game-api";
import ExchangeApi "mixins/exchange-api";
import PlayerApi "mixins/player-api";
import DevApi "mixins/dev-api";
import WalletApi "mixins/wallet-api";
import AdminApi "mixins/admin-api";
import GuideApi "mixins/guide-api";
import AdminAuthApi "mixins/admin-authorization-api";
import LuckyLedgerApi "mixins/lucky-ledger-api";
import ApiDocMixin "mixins/api-doc";

actor self {
  let accessControlState : AccessControl.AccessControlState;
  /// Shared game state: round lifecycle, prize pool, treasury, exchange pool
  /// and player accounts. Declared once here and passed by reference into every
  /// domain mixin so all domains read and write the same values.
  let gameState : State.GameState;

  /// Render a 7-digit number as a fixed-width text string (leading zeros kept).
  func numberToText(number : [Nat]) : Text {
    number.values().map(func d = d.toText()).join("");
  };

  /// Render a player identity variant as a stable text label.
  func identityToText(identity : State.PlayerIdentity) : Text {
    switch (identity) {
      case (#player) { "player" };
      case (#manipulator) { "manipulator" };
      case (#conspirator) { "conspirator" };
    };
  };

  /// Render a wallet transfer asset variant as a stable text label.
  func assetToText(asset : Wallet.TransferAsset) : Text {
    switch (asset) {
      case (#icp) { "icp" };
      case (#lucky) { "lucky" };
    };
  };

  /// Render a wallet transfer direction variant as a stable text label.
  func directionToText(direction : Wallet.TransferDirection) : Text {
    switch (direction) {
      case (#outgoing) { "outgoing" };
      case (#incoming) { "incoming" };
    };
  };

  /// Render a wallet transfer status variant as a stable text label.
  func statusToText(status : Wallet.TransferStatus) : Text {
    switch (status) {
      case (#completed) { "completed" };
      case (#pending) { "pending" };
      case (#failed) { "failed" };
    };
  };

  /// Render a platform authorization role as a stable text label.
  func roleToText(role : AccessControl.UserRole) : Text {
    switch (role) {
      case (#admin) { "admin" };
      case (#user) { "user" };
      case (#guest) { "guest" };
    };
  };

  /// Render the persisted crowdfunding basis of positions 1-3 as a compact
  /// text column: `pos:winningDigit:winningAmount:locked` joined by `;`.
  func basisToText(positions : [Game.PositionBasis]) : Text {
    positions.values().map(
      func(p) {
        p.position.toText() # ":" # p.winningDigit.toText() # ":"
        # p.winningAmount.toText() # ":" # (if (p.locked) { "1" } else { "0" });
      },
    ).join(";");
  };

  /// Render a player's per-round bet aggregate as a compact text column:
  /// `round:ticketCount:num=count,num=count;...|complex=count,...` joined by
  /// `;`. The map holds at most one entry (the current round), so the column
  /// stays bounded; complex submissions are rendered by ticket count only.
  func roundBetsToText(roundBets : Map.Map<Nat, Game.RoundBetAggregate>) : Text {
    roundBets.entries().map(
      func((round, agg)) {
        let numbers = agg.numbers.values().map(
          func((number, count)) = numberToText(number) # "=" # count.toText(),
        ).join(",");
        let complex = agg.complexBets.values().map(
          func(bet) = bet.ticketCount.toText(),
        ).join(",");
        round.toText() # ":" # agg.ticketCount.toText() # ":" # numbers # "|complex=" # complex;
      },
    ).join(";");
  };

  /// Render a player's per-round winnings as a compact text column:
  /// `round:amount:tier` joined by `;`, where `tier` is `-` when the player
  /// did not win that round. Bounded by the retention window.
  func roundWinningsToText(roundWinnings : Map.Map<Nat, Game.RoundWinnings>) : Text {
    roundWinnings.entries().map(
      func((round, win)) {
        let tier = switch (win.tier) { case (?t) t.toText(); case null "-" };
        round.toText() # ":" # win.amount.toText() # ":" # tier;
      },
    ).join(";");
  };

  /// Rows for the public round-history entity: one row per finished round.
  func historyRows() : Iter.Iter<State.RoundHistoryEntry> {
    gameState.history.values();
  };

  /// Rows for the per-user player entity, pairing each account with its
  /// principal (the map key). `null` yields every account (schema seeding); a
  /// subject yields only that principal's account.
  func playerRows(subject : ?Principal) : Iter.Iter<(Principal, State.PlayerAccount)> {
    switch (subject) {
      case null { gameState.players.entries() };
      case (?p) {
        switch (gameState.players.get(p)) {
          case (?account) { Iter.singleton((p, account)) };
          case null { Iter.empty() };
        };
      };
    };
  };

  /// Rows for the daily-statistics entity, pairing each UTC day's aggregate
  /// with its `YYYY-MM-DD` key. Admin-only data, so the entity is
  /// controller-scoped rather than public or per-user.
  func dailyStatsRows() : Iter.Iter<(Text, Admin.DailyStats)> {
    gameState.dailyStats.entries();
  };

  /// Rows for the user-role registry entity, pairing each registered principal
  /// (the map key) with its platform role. The identity lives in the key, so
  /// the entity is declared in manual mode over `.entries()` and the principal
  /// is promoted to a payload column. Admin-only data: the registry is
  /// controller-scoped rather than public or per-user.
  func userRoleRows() : Iter.Iter<(Principal, AccessControl.UserRole)> {
    accessControlState.userRoles.entries();
  };

  /// Lowercase hex encoding of a blob, matching the ledger's canonical
  /// account-text subaccount suffix.
  func blobToHex(blob : Blob) : Text {
    let digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];
    blob.toArray().values().map(func b = digits[b.toNat() / 16] # digits[b.toNat() % 16]).join("");
  };

  /// Render a ledger account as canonical text (`owner` or
  /// `owner-subaccount-hex`), or `-` for the absent side of a mint.
  func ledgerAccountToText(account : ?LuckyLedger.Account) : Text {
    switch (account) {
      case null { "-" };
      case (?a) {
        switch (a.subaccount) {
          case null { a.owner.toText() };
          case (?sub) { a.owner.toText() # "-" # blobToHex(sub) };
        };
      };
    };
  };

  /// Render a ledger transaction kind as a stable text label.
  func ledgerKindToText(kind : LuckyLedger.TransactionKind) : Text {
    switch (kind) {
      case (#mint) { "mint" };
      case (#transfer) { "transfer" };
      case (#approve) { "approve" };
      case (#transferFrom) { "transferFrom" };
    };
  };

  /// Rows for the ledger block-log entity: one row per transaction, oldest
  /// first. The block index is a field, so the entity is declared in manual
  /// mode over `.values()` and the optional account/memo fields are rendered
  /// to text columns. Admin-only data: the log is controller-scoped.
  func ledgerBlockRows() : Iter.Iter<LuckyLedger.Transaction> {
    gameState.luckyLedger.blocks.values();
  };

  /// Rows for the per-account ledger-balance entity, pairing each balance with
  /// its canonical account text (the map key). The identity lives in the key,
  /// so the entity is declared in manual mode over `.entries()` and the account
  /// is promoted to a payload column. Admin-only data: the balances are
  /// controller-scoped.
  func ledgerBalanceRows() : Iter.Iter<(Text, LuckyLedger.Lucky)> {
    gameState.luckyLedger.balances.entries();
  };

  /// Rows for the per-user wallet-transfer entity, pairing each transfer
  /// record with its owning principal (the map key). `null` yields every
  /// caller's records (schema seeding); a subject yields only that principal's
  /// records, so a scoped caller can never read another user's transfers.
  func transferRows(subject : ?Principal) : Iter.Iter<(Principal, Wallet.WalletTransferRecord)> {
    switch (subject) {
      case null {
        gameState.walletTransfers.entries().flatMap(
          func((owner, records)) = records.values().map(func(record) = (owner, record)),
        );
      };
      case (?p) {
        switch (gameState.walletTransfers.get(p)) {
          case (?records) { records.values().map(func(record) = (p, record)) };
          case null { Iter.empty() };
        };
      };
    };
  };

  include MixinAuthorization(accessControlState, null);
  include Expose({
    entities = [
      // Public round history: every finished round is world-readable.
      OQL.Entity.manual<State.RoundHistoryEntry>(
        "roundHistory",
        historyRows,
        "RoundHistoryEntry",
        "round",
      )
        .sample({
          round = 0;
          winningNumber = [0, 0, 0, 0, 0, 0, 0];
          totalPrizePool = 0;
          crowdfundTotal = 0;
          totalDistributed = 0;
          finishedAt = 0;
          positions = [];
        })
        .payload("round", func r = r.round)
        .payload("winningNumber", func r = numberToText(r.winningNumber))
        .payload("totalPrizePool", func r = r.totalPrizePool)
        .payload("crowdfundTotal", func r = r.crowdfundTotal)
        .payload("totalDistributed", func r = r.totalDistributed)
        .payload("finishedAt", func r = r.finishedAt)
        .payload("crowdfundBasis", func r = basisToText(r.positions))
        .public_()
        .build(),
      // Player accounts: each signed-in caller reads only its own row; the
      // platform controller (and the data agent) reads all for aggregates.
      OQL.Entity.newScoped(
        "player",
        playerRows,
        "PlayerAccount",
        "principal",
        func (_ : (Principal, State.PlayerAccount)) : Entity.Row = [],
      )
        .sample((
          Principal.fromText("aaaaa-aa"),
          {
            var luckyBalance = 0;
            var identity : State.PlayerIdentity = #player;
            var lastActionAt = 0;
            var roundsPos1 = 0;
            var roundsPos2 = 0;
            var roundsPos3 = 0;
            var multiPositionRounds = 0;
            var lastCrowdfundRound = 0;
            var lastCrowdfundMask = 0;
            var betHistory = List.empty();
            var winHistory = List.empty();
            var roundBets = Map.empty();
            var roundWinnings = Map.empty();
          } : State.PlayerAccount,
        ))
        .payload("principal", func ((p, _)) = p)
        .payload("luckyBalance", func ((_, a)) = a.luckyBalance)
        .payload("identity", func ((_, a)) = identityToText(a.identity))
        .payload("roundsPos1", func ((_, a)) = a.roundsPos1)
        .payload("roundsPos2", func ((_, a)) = a.roundsPos2)
        .payload("roundsPos3", func ((_, a)) = a.roundsPos3)
        .payload("multiPositionRounds", func ((_, a)) = a.multiPositionRounds)
        .payload("betCount", func ((_, a)) = a.betHistory.size())
        .payload("winCount", func ((_, a)) = a.winHistory.size())
        .payload("roundBets", func ((_, a)) = roundBetsToText(a.roundBets))
        .payload("roundWinnings", func ((_, a)) = roundWinningsToText(a.roundWinnings))
        .controllerOrScoped()
        .build(),
      // Wallet transfer records: each signed-in caller reads only its own
      // records; the platform controller (and the data agent) reads all.
      OQL.Entity.newScoped(
        "walletTransfer",
        transferRows,
        "WalletTransferRecord",
        "id",
        func (_ : (Principal, Wallet.WalletTransferRecord)) : Entity.Row = [],
      )
        .sample((
          Principal.fromText("aaaaa-aa"),
          {
            id = 0;
            asset : Wallet.TransferAsset = #icp;
            direction : Wallet.TransferDirection = #outgoing;
            amount = 0;
            fee = 0;
            counterparty = Principal.fromText("aaaaa-aa");
            status : Wallet.TransferStatus = #completed;
            createdAt = 0;
          },
        ))
        .payload("id", func ((_, r)) = r.id)
        .payload("owner", func ((p, _)) = p)
        .payload("asset", func ((_, r)) = assetToText(r.asset))
        .payload("direction", func ((_, r)) = directionToText(r.direction))
        .payload("amount", func ((_, r)) = r.amount)
        .payload("fee", func ((_, r)) = r.fee)
        .payload("counterparty", func ((_, r)) = r.counterparty)
        .payload("status", func ((_, r)) = statusToText(r.status))
        .payload("createdAt", func ((_, r)) = r.createdAt)
        .controllerOrScoped()
        .build(),
      // Daily statistics: admin-only aggregates, so only the platform
      // controller (and the data agent) may read them.
      OQL.Entity.manual<(Text, Admin.DailyStats)>(
        "dailyStats",
        dailyStatsRows,
        "DailyStats",
        "date",
      )
        .sample(("1970-01-01", { totalBets = 0; totalPayouts = 0; treasuryIncome = 0 }))
        .payload("date", func ((date, _)) = date)
        .payload("totalBets", func ((_, s)) = s.totalBets)
        .payload("totalPayouts", func ((_, s)) = s.totalPayouts)
        .payload("treasuryIncome", func ((_, s)) = s.treasuryIncome)
        .controllerOnly()
        .build(),
      // User-role registry: the platform authorization roles keyed by
      // principal. The identity is the map key, so manual mode over
      // `.entries()` promotes it to a `principal` column. Admin-only data,
      // so only the platform controller (and the data agent) may read it.
      OQL.Entity.manual<(Principal, AccessControl.UserRole)>(
        "userRole",
        userRoleRows,
        "UserRoleEntry",
        "principal",
      )
        .sample((Principal.fromText("aaaaa-aa"), #user))
        .payload("principal", func ((p, _)) = p)
        .payload("role", func ((_, role)) = roleToText(role))
        .controllerOnly()
        .build(),
      // Lucky ledger block log: one row per ICRC-3 transaction, oldest first.
      // The block index is a field, so manual mode over `.values()` renders the
      // optional account/memo fields to text columns. Admin-only data, so only
      // the platform controller (and the data agent) may read it.
      OQL.Entity.manual<LuckyLedger.Transaction>(
        "luckyBlock",
        ledgerBlockRows,
        "LuckyTransaction",
        "index",
      )
        .sample({
          index = 0;
          timestamp = 0;
          from = null;
          to = null;
          amount = 0;
          fee = 0;
          memo = null;
          kind = #mint;
        })
        .payload("index", func t = t.index)
        .payload("timestamp", func t = t.timestamp)
        .payload("from", func t = ledgerAccountToText(t.from))
        .payload("to", func t = ledgerAccountToText(t.to))
        .payload("amount", func t = t.amount)
        .payload("fee", func t = t.fee)
        .payload("memo", func t = switch (t.memo) { case null { "" }; case (?m) { blobToHex(m) } })
        .payload("kind", func t = ledgerKindToText(t.kind))
        .controllerOnly()
        .build(),
      // Lucky ledger balances: one row per account, keyed by canonical account
      // text. The identity lives in the map key, so manual mode over
      // `.entries()` promotes it to an `account` column. Admin-only data, so
      // only the platform controller (and the data agent) may read it.
      OQL.Entity.manual<(Text, LuckyLedger.Lucky)>(
        "luckyBalance",
        ledgerBalanceRows,
        "LuckyBalance",
        "account",
      )
        .sample(("aaaaa-aa", 0))
        .payload("account", func ((account, _)) = account)
        .payload("balance", func ((_, balance)) = balance)
        .controllerOnly()
        .build(),
    ];
  });
  include GameApi(gameState);
  include ExchangeApi(gameState);
  include PlayerApi(gameState);
  include DevApi(gameState, accessControlState);
  include WalletApi(gameState, Principal.fromActor(self));
  include AdminApi(gameState, accessControlState);
  include GuideApi(gameState, accessControlState);
  include AdminAuthApi(accessControlState);
  include LuckyLedgerApi(gameState, accessControlState);
  include ApiDocMixin();
};
