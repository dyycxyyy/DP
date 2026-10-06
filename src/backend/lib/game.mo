/// Domain logic for the round lifecycle, betting, crowdfunding, drawing and
/// payout. Every function receives the shared actor state by reference.
///
/// Rounds advance lazily: `advance` is called at the top of every public entry
/// point and, using IC time, closes elapsed phases, runs the draw and payout
/// once the crowdfunding deadline has passed, and opens the next round after
/// the drawing and payout observation windows. There is no timer. `advance` is
/// idempotent.
///
/// Performance contract:
/// - `getTopBetNumbers` reads the incrementally maintained `state.topBets`
///   structure (O(K)) instead of sorting the whole tally map.
/// - `runDrawAndPayout` counts winning tickets and credits winners from the
///   per-round `PlayerAccount.roundBets` aggregate, so it is O(players) rather
///   than O(players x bets ever placed).
/// - `getDrawResult` reads the caller's per-round winnings from
///   `PlayerAccount.roundWinnings` in O(1) instead of scanning their history.
import Array "mo:core/Array";
import List "mo:core/List";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Common "../types/common";
import Admin "../types/admin";
import Game "../types/game";
import State "../types/state";

module {
  /// Lucky token amount, aliased for readability in this module.
  type Lucky = Common.Lucky;

  // ---- Timeline (nanoseconds) -------------------------------------------
  /// Betting window length: 5 minutes.
  let BETTING_NS : Int = 300_000_000_000;
  /// Crowdfunding window length: 8 minutes.
  let CROWDFUND_NS : Int = 480_000_000_000;
  /// Drawing observation window: 30 seconds after crowdfunding closes.
  let DRAWING_NS : Int = 30_000_000_000;
  /// Payout observation window: 30 seconds after the drawing window.
  let PAYOUT_NS : Int = 30_000_000_000;
  /// Minimum interval between two game actions by the same caller: 3 seconds.
  let COOLDOWN_NS : Int = 3_000_000_000;

  // ---- Crowdfunding ------------------------------------------------------
  /// Per-digit threshold that locks a position's winning digit.
  let THRESHOLD : Nat = 100_000;
  /// Maximum Lucky accepted in a single crowdfunding contribution.
  let MAX_CROWDFUND : Nat = 100_000;
  /// A single contribution at or above this share of the threshold marks the
  /// contributor as a manipulator.
  let MANIPULATOR_SHARE : Nat = 50_000;

  // ---- Payout ------------------------------------------------------------
  /// Payout base cap; any prize pool above this is transferred to the treasury.
  let POOL_CAP : Nat = 99_999_900;
  /// Tier allocation percentages of the payout base (index 1..6).
  let TIER_PERCENT : [Nat] = [0, 10, 8, 7, 6, 5, 4];
  /// Maximum number of finished rounds kept in the history list.
  let MAX_HISTORY : Nat = 50;
  /// Number of top bet numbers returned by `getTopBetNumbers`.
  let TOP_K : Nat = 10;
  /// Largest cartesian product of a complex submission that `getTopBetNumbers`
  /// fully enumerates when building top-K candidates. Larger products contribute
  /// only their `TOP_K` lexicographically smallest combinations: every member of
  /// a product carries the same count, so no product can place more than `TOP_K`
  /// numbers in the ranking and the smallest `TOP_K` are the only ones that can
  /// appear. The ranking stays exact without enumerating 10^7 numbers.
  let MAX_ENUMERATED_PRODUCT : Nat = 4096;
  /// Number of finished rounds whose per-player winnings are retained in
  /// `PlayerAccount.roundWinnings`.
  let WINNINGS_RETENTION : Nat = 50;

  // ---- Helpers -----------------------------------------------------------

  func nowNs() : Int {
    Time.now();
  };

  // ---- Daily statistics (UTC) -------------------------------------------

  /// Nanoseconds in one day.
  let DAY_NS : Int = 86_400_000_000_000;

  /// Zero-pad `value` to two digits.
  func pad2(value : Nat) : Text {
    if (value < 10) { "0" # value.toText() } else { value.toText() };
  };

  /// UTC day key `YYYY-MM-DD` for a nanosecond timestamp. Days are counted from
  /// the Unix epoch, so the key is derived by integer division and civil-date
  /// conversion without any timezone offset.
  func dayKeyOf(ns : Int) : Text {
    let days = ns / DAY_NS;
    let (year, month, day) = civilFromDays(days);
    year.toText() # "-" # pad2(month) # "-" # pad2(day);
  };

  /// Civil date (year, month, day) from days since 1970-01-01, using Howard
  /// Hinnant's `civil_from_days` algorithm. Valid for the full proleptic
  /// Gregorian calendar.
  func civilFromDays(days : Int) : (Int, Nat, Nat) {
    let z = days + 719_468;
    let era = (if (z >= 0) { z } else { z - 146_096 }) / 146_097;
    let doe = z - era * 146_097; // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365; // [0, 399]
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let d = doy - (153 * mp + 2) / 5 + 1; // [1, 31]
    let m = if (mp < 10) { mp + 3 } else { mp - 9 }; // [1, 12]
    let year = if (m <= 2) { y + 1 } else { y };
    (year, m.toNat(), d.toNat());
  };

  /// The day bucket for `key`, creating a zeroed one on first contact.
  func dailyBucket(state : State.GameState, key : Text) : Admin.DailyStats {
    switch (state.dailyStats.get(key)) {
      case (?stats) { stats };
      case null {
        let fresh : Admin.DailyStats = { totalBets = 0; totalPayouts = 0; treasuryIncome = 0 };
        state.dailyStats.add(key, fresh);
        fresh;
      };
    };
  };

  /// Add `amount` to the day's total bets.
  func recordDailyBets(state : State.GameState, now : Int, amount : Lucky) {
    let key = dayKeyOf(now);
    let bucket = dailyBucket(state, key);
    state.dailyStats.add(key, { bucket with totalBets = bucket.totalBets + amount });
  };

  /// Add `payouts` and `treasury` to the day's payout and treasury-income
  /// totals.
  func recordDailyDraw(state : State.GameState, now : Int, payouts : Lucky, treasury : Lucky) {
    let key = dayKeyOf(now);
    let bucket = dailyBucket(state, key);
    state.dailyStats.add(
      key,
      {
        bucket with
        totalPayouts = bucket.totalPayouts + payouts;
        treasuryIncome = bucket.treasuryIncome + treasury;
      },
    );
  };

  /// 2 raised to `n`, for small non-negative `n` (bitmask helper).
  func pow2(n : Nat) : Nat {
    var result = 1;
    var i = 0;
    while (i < n) {
      result *= 2;
      i += 1;
    };
    result;
  };

  /// Encode a 7-digit number as a Nat in 0..9_999_999. Fixed width means
  /// numeric order equals lexicographic order.
  func numberToNat(number : Common.BetNumber) : Nat {
    var value = 0;
    for (digit in number.values()) {
      value := value * 10 + digit;
    };
    value;
  };

  /// True when `number` is exactly 7 digits, each 0-9.
  func isValidNumber(number : Common.BetNumber) : Bool {
    if (number.size() != 7) { return false };
    number.all(func d = d <= 9);
  };

  /// Tens digit of `value` (0 when the value has fewer than two digits).
  func tensDigit(value : Nat) : Common.Digit {
    value / 10 % 10;
  };

  /// Units digit of `value`.
  func unitsDigit(value : Nat) : Common.Digit {
    value % 10;
  };

  /// Number of matching digit positions between two 7-digit numbers.
  func matchCount(a : Common.BetNumber, b : Common.BetNumber) : Nat {
    var matches = 0;
    var i = 0;
    while (i < 7) {
      if (a[i] == b[i]) { matches += 1 };
      i += 1;
    };
    matches;
  };

  /// Tier for a match count: 7->1, 6->2, 5->3, 4->4, 3->5, 2->6, else 0.
  func tierFor(matches : Nat) : Nat {
    if (matches >= 7) { 1 }
    else if (matches == 6) { 2 }
    else if (matches == 5) { 3 }
    else if (matches == 4) { 4 }
    else if (matches == 3) { 5 }
    else if (matches == 2) { 6 }
    else { 0 };
  };

  /// Rank of an identity so it only ever strengthens.
  func identityRank(id : Common.PlayerIdentity) : Nat {
    switch (id) {
      case (#player) { 0 };
      case (#manipulator) { 1 };
      case (#conspirator) { 2 };
    };
  };

  func stronger(a : Common.PlayerIdentity, b : Common.PlayerIdentity) : Common.PlayerIdentity {
    if (identityRank(a) >= identityRank(b)) { a } else { b };
  };

  /// Look up a player account, creating a zero-balance one on first contact.
  public func getOrCreatePlayer(state : State.GameState, caller : Principal) : State.PlayerAccount {
    switch (state.players.get(caller)) {
      case (?account) { account };
      case null {
        let account : State.PlayerAccount = {
          var luckyBalance = 0;
          var identity = #player;
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
        };
        state.players.add(caller, account);
        account;
      };
    };
  };

  /// Enforce the 3-second per-caller action interval. Returns the remaining
  /// milliseconds when the caller must wait, or null when the action may run.
  func cooldownRemaining(account : State.PlayerAccount, now : Int) : ?Nat {
    let elapsed = now - account.lastActionAt;
    if (elapsed >= COOLDOWN_NS) { return null };
    let remainingNs = COOLDOWN_NS - elapsed;
    // Round up to whole milliseconds so a positive remainder never reads as 0.
    ?((remainingNs + 999_999) / 1_000_000).toNat();
  };

  /// Reset the per-round crowdfunding accumulators in place.
  func resetPositions(state : State.GameState) {
    for (position in state.positions.values()) {
      for (digit in position.digits.values()) {
        digit.amount := 0;
        digit.reachedAt := null;
      };
      position.lockedDigit := null;
    };
  };

  /// Digit with the highest amount in a position; ties go to the larger digit.
  func leadingDigit(position : State.PositionFund) : Common.Digit {
    var best : Common.Digit = 0;
    var bestAmount : Lucky = 0;
    var d = 0;
    while (d < 10) {
      let amount = position.digits[d].amount;
      if (amount >= bestAmount) {
        bestAmount := amount;
        best := d;
      };
      d += 1;
    };
    best;
  };

  /// Winning digit for a position at draw time: the locked digit when one was
  /// reached, otherwise the leading digit (highest amount, ties -> larger).
  func resolveDigit(position : State.PositionFund) : Common.Digit {
    switch (position.lockedDigit) {
      case (?digit) { digit };
      case null { leadingDigit(position) };
    };
  };

  /// Snapshot the crowdfunding basis of positions 1-3 at draw time.
  func snapshotBasis(state : State.GameState) : [Game.PositionBasis] {
    let basis = List.empty<Game.PositionBasis>();
    var i = 0;
    while (i < 3) {
      let position = state.positions[i];
      let winningDigit = resolveDigit(position);
      let digitAmounts = Array.tabulate(10, func(d) = position.digits[d].amount);
      basis.add({
        position = i + 1;
        winningDigit;
        winningAmount = digitAmounts[winningDigit];
        locked = position.lockedDigit != null;
        digitAmounts;
      });
      i += 1;
    };
    basis.toArray();
  };

  /// Record a crowdfunding contribution against the player's behaviour
  /// counters and strengthen their identity.
  func recordCrowdfundBehaviour(
    state : State.GameState,
    account : State.PlayerAccount,
    position : Common.Position,
    amount : Common.Lucky,
    lockedNow : Bool,
  ) {
    let round = state.round;
    if (account.lastCrowdfundRound != round) {
      account.lastCrowdfundRound := round;
      account.lastCrowdfundMask := 0;
    };
    // Bitmask of positions contributed to this round (bit 0 -> position 1).
    let bit : Nat = pow2(position - 1);
    if (account.lastCrowdfundMask / bit % 2 == 0) {
      account.lastCrowdfundMask := account.lastCrowdfundMask + bit;
      switch (position) {
        case (1) { account.roundsPos1 += 1 };
        case (2) { account.roundsPos2 += 1 };
        case (3) { account.roundsPos3 += 1 };
        case (_) {};
      };
      // Count the round as multi-position once a second position is touched.
      if (account.lastCrowdfundMask == 3 or account.lastCrowdfundMask == 5 or account.lastCrowdfundMask == 6 or account.lastCrowdfundMask == 7) {
        account.multiPositionRounds += 1;
      };
    };
    if (amount >= MANIPULATOR_SHARE) {
      account.identity := stronger(account.identity, #manipulator);
    };
    if (lockedNow) {
      account.identity := stronger(account.identity, #conspirator);
    };
  };

  /// True when `a` ranks before `b`: higher count first, ties by smaller number.
  func ranksBefore(a : Common.BetNumber, aCount : Nat, b : Common.BetNumber, bCount : Nat) : Bool {
    if (aCount != bCount) { aCount > bCount } else { numberToNat(a) < numberToNat(b) };
  };

  /// Insert or update `number` in the incrementally maintained top-K structure
  /// with its new ticket count, keeping `order` ranked (count desc, number asc)
  /// and capped at `TOP_K`. Called on every bet so reads never sort the tally.
  func topBetsUpsert(top : State.TopBets, number : Common.BetNumber, count : Nat) {
    top.counts.add(number, count);
    // Rebuild the ranked order from the tracked candidates. `counts` holds at
    // most TOP_K + 1 entries (the previous top-K plus the number just bet), so
    // this is O(K log K), not O(distinct bets).
    let candidates = top.counts.entries().toArray();
    let sorted = candidates.sort(
      func((a, aCount), (b, bCount)) {
        if (ranksBefore(a, aCount, b, bCount)) { #less }
        else if (ranksBefore(b, bCount, a, aCount)) { #greater }
        else { #equal };
      },
    );
    top.order.clear();
    var i = 0;
    while (i < sorted.size() and i < TOP_K) {
      top.order.add(sorted[i].0);
      i += 1;
    };
    // Drop candidates that fell out of the top-K so `counts` stays bounded.
    let kept = Map.empty<Common.BetNumber, Nat>();
    for (entry in sorted.values()) {
      if (kept.size() < TOP_K) { kept.add(entry.0, entry.1) };
    };
    top.counts := kept;
  };

  /// Clear the top-K structure for a new round.
  func topBetsReset(top : State.TopBets) {
    top.counts.clear();
    top.order.clear();
  };

  /// The player's per-round aggregate for the current round, replacing any
  /// stale round entry so it holds at most one round.
  func currentAggregate(account : State.PlayerAccount, round : Nat) : Game.RoundBetAggregate {
    switch (account.roundBets.get(round)) {
      case (?aggregate) { aggregate };
      case null {
        account.roundBets.clear();
        let fresh : Game.RoundBetAggregate = { ticketCount = 0; numbers = []; complexBets = [] };
        account.roundBets.add(round, fresh);
        fresh;
      };
    };
  };

  /// Record `count` tickets on `number` for `account` in the current round:
  /// updates the per-round aggregate (`roundBets`) and the top-K structure.
  func recordBet(
    state : State.GameState,
    account : State.PlayerAccount,
    number : Common.BetNumber,
    count : Nat,
  ) {
    let round = state.round;
    let aggregate = currentAggregate(account, round);
    var found = false;
    let merged = aggregate.numbers.map(
      func((n, c)) {
        if (n == number) { found := true; (n, c + count) } else { (n, c) };
      },
    );
    let numbers = if (found) { merged } else { merged.concat([(number, count)]) };
    account.roundBets.add(round, { aggregate with ticketCount = aggregate.ticketCount + count; numbers });
    // Tally and top-K for the current round.
    let newCount = switch (state.tally.get(number)) {
      case (?existing) { existing + count };
      case null { count };
    };
    state.tally.add(number, newCount);
    topBetsUpsert(state.topBets, number, newCount);
  };

  /// Record a complex (复式) submission for `account` in the current round
  /// without materializing its cartesian product.
  ///
  /// The submission is stored as its per-position selection structure plus the
  /// ticket count (the product of the per-position selection sizes), so the
  /// aggregate stays bounded at 7 positions x 10 digits. The per-number tally
  /// and the top-K ranking are NOT updated here: a complex submission
  /// contributes exactly one ticket to every number in the cartesian product of
  /// its selection sets, so its contribution is kept as the bounded
  /// `ComplexBet` aggregate and merged into the tally/top-K on the read path
  /// (`getTopBetNumbers`). This keeps the write O(1) in the ticket count and
  /// makes the published counts identical to recording every combination
  /// individually.
  func recordComplexBet(
    state : State.GameState,
    account : State.PlayerAccount,
    selections : [[Common.Digit]],
    counts : [Nat],
    ticketCount : Nat,
  ) {
    let round = state.round;
    let aggregate = currentAggregate(account, round);
    let complexBet : Game.ComplexBet = { selections; counts; ticketCount };
    account.roundBets.add(
      round,
      {
        aggregate with
        ticketCount = aggregate.ticketCount + ticketCount;
        complexBets = aggregate.complexBets.concat([complexBet]);
      },
    );
    state.complexBets.add(complexBet);
  };

  /// The `index`-th combination of a submission's cartesian product in
  /// lexicographic order, decoded from the mixed-radix index without
  /// enumerating the product. `index` must be less than the product. Index 0 is
  /// the lexicographically smallest combination (the smallest selected digit at
  /// every position), which is always a member of the product.
  ///
  /// Position 1 is the most significant digit, matching `numberToNat`, so the
  /// stride of position `p` is the product of the selection counts of every
  /// position after it. Index `0..TOP_K-1` therefore maps to the numerically
  /// smallest `TOP_K` combinations in the same order the ranking key uses.
  func combinationAt(bet : Game.ComplexBet, index : Nat) : Common.BetNumber {
    Array.tabulate(
      7,
      func(p) {
        var stride = 1;
        var q = p + 1;
        while (q < 7) {
          stride *= bet.counts[q];
          q += 1;
        };
        bet.selections[p][index / stride % bet.counts[p]];
      },
    );
  };

  /// Candidate numbers for the top-K read, deduplicated by number and carrying
  /// each number's cumulative ticket count.
  ///
  /// A number's count is its simple/batch tally plus the number of complex
  /// submissions whose cartesian product contains it. Every number inside one
  /// submission's product carries the same contribution (exactly one ticket), so
  /// the highest-count members of a product are its lexicographically smallest
  /// ones. To determine the true top-K it is therefore enough to keep the
  /// smallest `TOP_K` combinations of each submission: no product can place more
  /// than `TOP_K` numbers in the ranking, and any member beyond the smallest
  /// `TOP_K` is dominated by those within its own product. This stays bounded —
  /// at most `TOP_K` candidates per submission — and never enumerates a 10^7
  /// product.
  ///
  /// Candidates are merged into a single map keyed by number, so a number that
  /// appears in several overlapping submissions (or in both the tally and a
  /// product) is counted once with the summed contribution. The returned list
  /// therefore holds distinct numbers only.
  func topBetCandidates(state : State.GameState) : List.List<(Common.BetNumber, Nat)> {
    let counts = Map.empty<Common.BetNumber, Nat>();
    for ((number, count) in state.tally.entries()) {
      counts.add(number, count);
    };
    for (bet in state.complexBets.values()) {
      var product = 1;
      var position = 0;
      while (position < 7) {
        product *= bet.counts[position];
        position += 1;
      };
      // Enumerate the whole product when it is small, otherwise only the
      // smallest `TOP_K` combinations, which is all the ranking can use.
      let limit = if (product <= MAX_ENUMERATED_PRODUCT) { product } else { TOP_K };
      var index = 0;
      while (index < limit) {
        let number = combinationAt(bet, index);
        let existing = counts.get(number) ?? 0;
        counts.add(number, existing + 1);
        index += 1;
      };
    };
    List.fromArray(counts.entries().toArray());
  };

  /// Distribution of match counts over the combinations of a complex
  /// submission against `winningNumber`: element `k` is the number of
  /// combinations that match exactly `k` positions. Computed by multiplying one
  /// per-position polynomial at a time, so it is O(7 x 7) arithmetic and never
  /// enumerates the cartesian product.
  ///
  /// For position `i` with selection size `n_i`:
  /// - when the drawn digit is selected, the matching branch contributes 1 way
  ///   and the non-matching branch contributes `n_i - 1` ways;
  /// - when the drawn digit is not selected, all `n_i` ways are non-matching.
  func complexMatchDistribution(bet : Game.ComplexBet, winningNumber : Common.BetNumber) : [Nat] {
    // `dist[k]` = combinations matching exactly k positions so far.
    var dist : [var Nat] = [var 1, 0, 0, 0, 0, 0, 0, 0];
    var position = 0;
    while (position < 7) {
      let selected = bet.selections[position];
      let size = selected.size();
      let matched = selected.any(func(d) = d == winningNumber[position]);
      // Ways that do not match this position: all but the drawn digit when it
      // is selected, otherwise every selected digit.
      let unmatchedWays = if (matched) { size - 1 } else { size };
      let next : [var Nat] = [var 0, 0, 0, 0, 0, 0, 0, 0];
      var k = 0;
      while (k <= position) {
        let ways = dist[k];
        if (ways > 0) {
          if (matched) { next[k + 1] += ways };
          next[k] += ways * unmatchedWays;
        };
        k += 1;
      };
      dist := next;
      position += 1;
    };
    Array.tabulate(8, func(k) = dist[k]);
  };

  /// Drop per-round winnings older than the retention window so
  /// `PlayerAccount.roundWinnings` stays bounded.
  func pruneRoundWinnings(account : State.PlayerAccount, currentRound : Nat) {
    if (currentRound <= WINNINGS_RETENTION) { return };
    let cutoff = currentRound - WINNINGS_RETENTION;
    let stale = List.empty<Nat>();
    for ((round, _) in account.roundWinnings.entries()) {
      if (round < cutoff) { stale.add(round) };
    };
    for (round in stale.values()) {
      account.roundWinnings.remove(round);
    };
  };

  // ---- Round lifecycle ---------------------------------------------------

  /// Current phase derived from elapsed time since the round started.
  func phaseOf(state : State.GameState, now : Int) : Common.Phase {
    let elapsed = now - state.roundStart;
    if (elapsed < BETTING_NS) { #betting }
    else if (elapsed < CROWDFUND_NS) { #crowdfunding }
    else if (elapsed < CROWDFUND_NS + DRAWING_NS) { #drawing }
    else { #payout };
  };

  /// Absolute deadline of the current phase.
  func phaseDeadlineOf(state : State.GameState, now : Int) : Common.Timestamp {
    let elapsed = now - state.roundStart;
    if (elapsed < BETTING_NS) { state.roundStart + BETTING_NS }
    else if (elapsed < CROWDFUND_NS) { state.roundStart + CROWDFUND_NS }
    else if (elapsed < CROWDFUND_NS + DRAWING_NS) { state.roundStart + CROWDFUND_NS + DRAWING_NS }
    else { state.roundStart + CROWDFUND_NS + DRAWING_NS + PAYOUT_NS };
  };

  /// Run the draw and payout for the current round, then open the next round.
  /// Called only when the crowdfunding deadline has passed. Counts winning
  /// tickets and credits winners from each player's per-round aggregate, so it
  /// is O(players) rather than O(players x bets).
  func runDrawAndPayout(state : State.GameState, now : Int) {
    let round = state.round;
    // Idempotent: a round that already has a stored draw is never redrawn.
    switch (state.draws.get(round)) {
      case (?_) { return };
      case null {};
    };

    // Freeze the winning number from the crowdfunding basis and the pools.
    let basis = snapshotBasis(state);
    let digits = Array.tabulate(
      7,
      func(i) {
        if (i < 3) { basis[i].winningDigit }
        else if (i < 5) {
          // Digits 4-5 from the total prize pool before the excess transfer.
          if (i == 3) { tensDigit(state.totalPrizePool) } else { unitsDigit(state.totalPrizePool) };
        } else {
          // Digits 6-7 from the crowdfund total.
          if (i == 5) { tensDigit(state.crowdfundTotal) } else { unitsDigit(state.crowdfundTotal) };
        };
      },
    );
    let winningNumber : Common.BetNumber = digits;

    // Payout base: cap the pool and move the excess to the treasury.
    let pool = state.totalPrizePool;
    let base = if (pool > POOL_CAP) { POOL_CAP } else { pool };
    let treasuryIncome = if (pool > POOL_CAP) { pool - POOL_CAP } else { 0 };
    if (pool > POOL_CAP) {
      state.treasuryBalance += treasuryIncome;
    };

    // Count winning tickets per tier from each player's per-round aggregate.
    // O(players), never O(players x bets). Complex submissions are counted
    // arithmetically from their selection structure, never expanded.
    let winningTickets : [var Nat] = [var 0, 0, 0, 0, 0, 0, 0];
    for ((_, account) in state.players.entries()) {
      switch (account.roundBets.get(round)) {
        case (?aggregate) {
          for ((number, count) in aggregate.numbers.values()) {
            let tier = tierFor(matchCount(number, winningNumber));
            if (tier >= 1 and tier <= 6) {
              winningTickets[tier] += count;
            };
          };
          for (bet in aggregate.complexBets.values()) {
            // Credit each tier with the combinations that match exactly that
            // many positions, derived from the true match-count distribution.
            let distribution = complexMatchDistribution(bet, winningNumber);
            var k = 2;
            while (k <= 7) {
              let tier = tierFor(k);
              if (tier >= 1 and tier <= 6) {
                winningTickets[tier] += distribution[k];
              };
              k += 1;
            };
          };
        };
        case null {};
      };
    };

    // Per-tier payout: floor(base * percent / 100 / winningTickets).
    let tiers = List.empty<Game.TierResult>();
    var totalDistributed = 0;
    var tier = 1;
    while (tier <= 6) {
      let tickets = winningTickets[tier];
      let payoutPerTicket = if (tickets == 0) { 0 } else { base * TIER_PERCENT[tier] / 100 / tickets };
      let distributed = payoutPerTicket * tickets;
      totalDistributed += distributed;
      tiers.add({ tier; winningTickets = tickets; payoutPerTicket; distributed });
      tier += 1;
    };

    // Credit winners and record per-round winnings for O(1) draw-result reads.
    for ((_, account) in state.players.entries()) {
      switch (account.roundBets.get(round)) {
        case (?aggregate) {
          var amount = 0;
          var bestTier : ?Nat = null;
          for ((number, count) in aggregate.numbers.values()) {
            let t = tierFor(matchCount(number, winningNumber));
            if (t >= 1 and t <= 6) {
              let payoutPerTicket = if (winningTickets[t] == 0) { 0 } else { base * TIER_PERCENT[t] / 100 / winningTickets[t] };
              let payout = payoutPerTicket * count;
              if (payout > 0) {
                amount += payout;
                account.luckyBalance += payout;
                account.winHistory.add({
                  round;
                  number;
                  tier = t;
                  payout;
                  claimedAt = now;
                });
                switch (bestTier) {
                  case null { bestTier := ?t };
                  case (?existing) { if (t < existing) { bestTier := ?t } };
                };
              };
            };
          };
          // Complex submissions: one bounded win record per submission, with
          // the matched ticket count and payout computed arithmetically.
          for (bet in aggregate.complexBets.values()) {
            let distribution = complexMatchDistribution(bet, winningNumber);
            var betPayout = 0;
            var betBestTier : ?Nat = null;
            var k = 2;
            while (k <= 7) {
              let t = tierFor(k);
              if (t >= 1 and t <= 6) {
                let tickets = distribution[k];
                if (tickets > 0) {
                  let payoutPerTicket = if (winningTickets[t] == 0) { 0 } else { base * TIER_PERCENT[t] / 100 / winningTickets[t] };
                  let payout = payoutPerTicket * tickets;
                  if (payout > 0) {
                    betPayout += payout;
                    switch (betBestTier) {
                      case null { betBestTier := ?t };
                      case (?existing) { if (t < existing) { betBestTier := ?t } };
                    };
                  };
                };
              };
              k += 1;
            };
            if (betPayout > 0) {
              amount += betPayout;
              account.luckyBalance += betPayout;
              account.winHistory.add({
                round;
                number = bet.selections.map(func(s) = s[0]);
                tier = betBestTier ?? 0;
                payout = betPayout;
                claimedAt = now;
              });
              switch (betBestTier) {
                case (?t) {
                  switch (bestTier) {
                    case null { bestTier := ?t };
                    case (?existing) { if (t < existing) { bestTier := ?t } };
                  };
                };
                case null {};
              };
            };
          };
          if (amount > 0) {
            account.roundWinnings.add(round, { amount; tier = bestTier });
          };
          pruneRoundWinnings(account, round);
        };
        case null {};
      };
    };

    // Remaining pool carries to the next round. The distributed amount is
    // floored per tier, so it can never exceed the base; the excess above the
    // cap was already moved to the treasury, so the pool is exactly the base
    // minus what was paid out.
    state.totalPrizePool := base - totalDistributed;

    let stored : State.StoredDraw = {
      round;
      winningNumber;
      tiers = tiers.toArray();
      totalDistributed;
      finishedAt = now;
    };
    state.draws.add(round, stored);

    // Append the finished-round summary, newest first, capped at MAX_HISTORY.
    state.history.add({
      round;
      winningNumber;
      totalPrizePool = pool;
      crowdfundTotal = state.crowdfundTotal;
      totalDistributed;
      finishedAt = now;
      positions = basis;
    });
    while (state.history.size() > MAX_HISTORY) {
      ignore state.history.removeLast();
    };

    state.winningNumber := ?winningNumber;
    // Aggregate the day's payouts and treasury income at the draw, so the
    // totals are exact and never require scanning history.
    recordDailyDraw(state, now, totalDistributed, treasuryIncome);
    startNextRound(state, now);
  };

  /// Open the next round with fresh crowdfunding state, an empty tally and a
  /// reset top-K structure.
  func startNextRound(state : State.GameState, now : Int) {
    state.round += 1;
    state.roundStart := now;
    state.crowdfundTotal := 0;
    state.winningNumber := null;
    state.tally.clear();
    state.complexBets.clear();
    topBetsReset(state.topBets);
    resetPositions(state);
  };

  /// Advance the round if the crowdfunding deadline has passed. Idempotent and
  /// safe to call from every public entry point.
  public func advance(state : State.GameState) {
    let now = nowNs();
    if (now - state.roundStart >= CROWDFUND_NS) {
      runDrawAndPayout(state, now);
    };
  };

  // ---- Reads -------------------------------------------------------------

  /// Read the current public game state.
  public func getGameState(state : State.GameState) : Game.GameState {
    advance(state);
    let now = nowNs();
    let positions = Array.tabulate(
      3,
      func(i) {
        let position = state.positions[i];
        let digits = Array.tabulate(
          10,
          func(d) {
            let fund = position.digits[d];
            {
              digit = d;
              amount = fund.amount;
              thresholdReached = fund.reachedAt != null;
              reachedAt = fund.reachedAt;
            };
          },
        );
        let leading = leadingDigit(position);
        {
          position = i + 1;
          digits;
          leadingDigit = leading;
          lockedDigit = position.lockedDigit;
        };
      },
    );
    {
      round = state.round;
      phase = phaseOf(state, now);
      phaseDeadline = phaseDeadlineOf(state, now);
      bettingDeadline = state.roundStart + BETTING_NS;
      crowdfundingDeadline = state.roundStart + CROWDFUND_NS;
      totalPrizePool = state.totalPrizePool;
      crowdfundTotal = state.crowdfundTotal;
      treasuryBalance = state.treasuryBalance;
      exchangePoolIcp = state.exchangePoolIcp;
      exchangePoolLucky = state.exchangePoolLucky;
      winningNumber = state.winningNumber;
      roundStopped = state.roundStopped;
      positions;
    };
  };

  /// Read the top-10 most-bet numbers with their ticket counts.
  ///
  /// Simple/batch bets are read from the incrementally maintained `topBets`
  /// structure; complex (复式) submissions are merged in from their bounded
  /// selection structure. A number's count is its simple tally plus the number
  /// of complex submissions whose cartesian product contains it, so the result
  /// is identical to recording every combination individually. Candidates are
  /// deduplicated by number before ranking, so overlapping submissions yield
  /// distinct numbers with their summed counts. Ranking uses the same
  /// tie-breaking as `topBetsUpsert` (count desc, number asc).
  public func getTopBetNumbers(state : State.GameState) : [Game.TopBetNumber] {
    advance(state);
    let candidates = topBetCandidates(state);
    let ranked = candidates.toArray().sort(
      func((a, aCount), (b, bCount)) {
        if (ranksBefore(a, aCount, b, bCount)) { #less }
        else if (ranksBefore(b, bCount, a, aCount)) { #greater }
        else { #equal };
      },
    );
    let result = List.empty<Game.TopBetNumber>();
    var i = 0;
    while (i < ranked.size() and i < TOP_K) {
      result.add({ number = ranked[i].0; ticketCount = ranked[i].1 });
      i += 1;
    };
    result.toArray();
  };

  /// Read the draw result of a round, including the caller's own winnings,
  /// looked up in O(1) from the caller's per-round winnings map.
  public func getDrawResult(state : State.GameState, caller : Principal, round : Nat) : ?Game.DrawResult {
    advance(state);
    switch (state.draws.get(round)) {
      case (?stored) {
        var callerWinnings = 0;
        var callerTier : ?Nat = null;
        switch (state.players.get(caller)) {
          case (?account) {
            switch (account.roundWinnings.get(round)) {
              case (?winnings) {
                callerWinnings := winnings.amount;
                callerTier := winnings.tier;
              };
              case null {};
            };
          };
          case null {};
        };
        ?{
          round = stored.round;
          winningNumber = stored.winningNumber;
          tiers = stored.tiers;
          callerWinnings;
          callerTier;
        };
      };
      case null { null };
    };
  };

  /// Read recent completed rounds, newest first.
  public func getRoundHistory(state : State.GameState, limit : Nat) : [Game.RoundHistoryEntry] {
    advance(state);
    let capped = if (limit > MAX_HISTORY) { MAX_HISTORY } else { limit };
    let result = List.empty<Game.RoundHistoryEntry>();
    var i = 0;
    while (i < capped and i < state.history.size()) {
      // History is stored oldest-first; read from the tail for newest-first.
      let index = state.history.size() - 1 - i;
      switch (state.history.get(index)) {
        case (?entry) { result.add(entry) };
        case null {};
      };
      i += 1;
    };
    result.toArray();
  };

  // ---- Mutations ---------------------------------------------------------

  /// Place `count` tickets on a 7-digit number, 1 Lucky per ticket.
  public func placeBet(state : State.GameState, caller : Principal, number : Common.BetNumber, count : Nat) : Common.GameError {
    placeBets(state, caller, [number], [count]);
  };

  /// Place several distinct 7-digit numbers in one call, each with its own
  /// ticket count.
  public func placeBets(
    state : State.GameState,
    caller : Principal,
    numbers : [Common.BetNumber],
    counts : [Nat],
  ) : Common.GameError {
    advance(state);
    let now = nowNs();
    if (state.roundStopped) { return #roundStopped };
    if (phaseOf(state, now) != #betting) {
      return #phaseClosed({ current = phaseOf(state, now); required = #betting });
    };
    if (numbers.size() != counts.size() or numbers.size() == 0) {
      return #invalidAmount({ step = 1 });
    };
    var totalTickets = 0;
    for (i in numbers.keys()) {
      if (not isValidNumber(numbers[i])) { return #invalidBetNumber };
      if (counts[i] == 0) { return #invalidAmount({ step = 1 }) };
      totalTickets += counts[i];
    };

    let account = getOrCreatePlayer(state, caller);
    switch (cooldownRemaining(account, now)) {
      case (?remainingMs) { return #rateLimited({ remainingMs }) };
      case null {};
    };
    if (account.luckyBalance < totalTickets) {
      return #insufficientBalance({ required = totalTickets; available = account.luckyBalance });
    };

    account.luckyBalance -= totalTickets;
    account.lastActionAt := now;
    state.totalPrizePool += totalTickets;
    recordDailyBets(state, now, totalTickets);

    for (i in numbers.keys()) {
      let number = numbers[i];
      let count = counts[i];
      recordBet(state, account, number, count);
      account.betHistory.add({
        round = state.round;
        number;
        ticketCount = count;
        cost = count;
        placedAt = now;
      });
    };
    #ok;
  };

  /// Place a complex (复式) bet from a per-position selection structure.
  ///
  /// `selections` holds one array of selected digits per position (7 positions)
  /// and `counts` the number of selected digits per position. The total ticket
  /// count is the product of the per-position counts, so the frontend never has
  /// to materialize the cartesian product.
  ///
  /// Validation, deduction and cooldown match `placeBets` exactly: betting
  /// phase only, cooldown clear, balance covering the total. The submission is
  /// recorded as a bounded aggregate (its selection structure plus the ticket
  /// count) and the tally/top-K are updated arithmetically, so a 10,000,000-note
  /// submission costs O(positions x digits) instead of O(ticket count) and
  /// never exceeds the per-message instruction limit. The resulting tally,
  /// roundBets aggregate, top-K and player stats are identical to recording
  /// every combination individually.
  public func placeBetSelections(
    state : State.GameState,
    caller : Principal,
    selections : [[Common.Digit]],
    counts : [Nat],
  ) : Common.GameError {
    advance(state);
    let now = nowNs();
    if (state.roundStopped) { return #roundStopped };
    if (phaseOf(state, now) != #betting) {
      return #phaseClosed({ current = phaseOf(state, now); required = #betting });
    };
    if (selections.size() != 7 or counts.size() != 7) {
      return #invalidAmount({ step = 1 });
    };
    // Validate each position and compute the total ticket count as the product
    // of the per-position selected-digit counts.
    var totalTickets = 1;
    var position = 0;
    while (position < 7) {
      let selected = selections[position];
      let declared = counts[position];
      if (declared == 0 or selected.size() != declared) {
        return #invalidAmount({ step = 1 });
      };
      if (not selected.all(func d = d <= 9)) {
        return #invalidBetNumber;
      };
      totalTickets *= declared;
      position += 1;
    };

    let account = getOrCreatePlayer(state, caller);
    switch (cooldownRemaining(account, now)) {
      case (?remainingMs) { return #rateLimited({ remainingMs }) };
      case null {};
    };
    if (account.luckyBalance < totalTickets) {
      return #insufficientBalance({ required = totalTickets; available = account.luckyBalance });
    };

    account.luckyBalance -= totalTickets;
    account.lastActionAt := now;
    state.totalPrizePool += totalTickets;
    recordDailyBets(state, now, totalTickets);

    // Record the submission as a bounded aggregate and update the tally and
    // top-K arithmetically; the cartesian product is never enumerated.
    recordComplexBet(state, account, selections, counts, totalTickets);
    // One bounded history entry per submission, not one per note.
    account.betHistory.add({
      round = state.round;
      number = selections.map(func(s) = s[0]);
      ticketCount = totalTickets;
      cost = totalTickets;
      placedAt = now;
    });
    #ok;
  };

  /// Contribute `amount` Lucky to `digit` at `position` (1-3).
  public func contributeCrowdfund(
    state : State.GameState,
    caller : Principal,
    position : Common.Position,
    digit : Common.Digit,
    amount : Common.Lucky,
  ) : Common.GameError {
    advance(state);
    let now = nowNs();
    if (state.roundStopped) { return #roundStopped };
    let phase = phaseOf(state, now);
    if (phase != #betting and phase != #crowdfunding) {
      return #phaseClosed({ current = phase; required = #crowdfunding });
    };
    if (position < 1 or position > 3 or digit > 9) {
      return #invalidPosition;
    };
    if (amount == 0) { return #invalidAmount({ step = 1 }) };
    if (amount > MAX_CROWDFUND) { return #amountTooLarge({ max = MAX_CROWDFUND }) };

    let account = getOrCreatePlayer(state, caller);
    switch (cooldownRemaining(account, now)) {
      case (?remainingMs) { return #rateLimited({ remainingMs }) };
      case null {};
    };
    if (account.luckyBalance < amount) {
      return #insufficientBalance({ required = amount; available = account.luckyBalance });
    };

    account.luckyBalance -= amount;
    account.lastActionAt := now;
    state.crowdfundTotal += amount;

    let fund = state.positions[position - 1];
    let digitFund = fund.digits[digit];
    digitFund.amount += amount;
    var lockedNow = false;
    if (digitFund.reachedAt == null and digitFund.amount >= THRESHOLD) {
      digitFund.reachedAt := ?now;
      if (fund.lockedDigit == null) {
        fund.lockedDigit := ?digit;
        lockedNow := true;
      };
    };
    recordCrowdfundBehaviour(state, account, position, amount, lockedNow);
    #ok;
  };
};
