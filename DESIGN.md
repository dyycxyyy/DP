# Design Brief

## Direction

博弈终端 (Arena Terminal) — a live trading-floor terminal for a 10-minute multiplayer game-theory lottery where every number that decides the draw is public and player-driven. **Mobile-first**: the phone in one hand is the primary terminal, not a shrunken desktop.

## Tone

Casino-meets-trading-terminal: near-black, data-dense, high-contrast, tense. Precision over decoration — this is a competitive instrument, not a toy.

## Differentiation

Numbers are the hero: every live value (prize pool, crowdfunding total, countdown, 7-digit draw) renders in tabular monospace at display scale, so the interface reads like a scoreboard that players are actively fighting over. On mobile, the number *is* the button — crowdfunding digits are tapped directly.

## Color Palette

| Token       | OKLCH (dark)    | Role                                   |
| ----------- | --------------- | -------------------------------------- |
| background  | 0.135 0.014 258 | near-black slate canvas                |
| foreground  | 0.94 0.008 250  | primary text                           |
| card        | 0.175 0.016 258 | panel surface (1px cool border)        |
| primary     | 0.79 0.15 70    | hot amber — money, prize pool, actions |
| accent      | 0.84 0.13 195   | electric cyan — crowdfunding progress  |
| muted       | 0.225 0.018 258 | inert surfaces, secondary text         |
| success     | 0.72 0.17 150   | locked / won / drawing phase           |
| destructive | 0.62 0.21 22    | loss, invalid, warning states          |
| phase-bet   | 0.79 0.15 70    | 投注中 (amber)                          |
| phase-crowd | 0.84 0.13 195   | 众筹中 (cyan)                           |
| phase-draw  | 0.72 0.17 150   | 开奖中 (green)                          |
| phase-pay   | 0.68 0.2 330    | 派奖中 (magenta)                        |

Light theme inverts L (background 0.975) keeping C/H stable — same hues, paper-terminal feel.

## Typography

- Display: Space Grotesk — headings, round number, section titles, phase labels
- Body: DM Sans — UI labels, prose, both English and Chinese
- Mono: JetBrains Mono — ALL numbers: prize pool, crowdfunding, countdown, 7-digit draw, balances
- **Bilingual stacks**: Latin face first, then `PingFang SC → Hiragino Sans GB → Microsoft YaHei → Noto Sans SC`. Mono adds CJK fallbacks so mixed "12,480 Lucky / 幸运币" rows never fall back to a serif.
- **CJK vs Latin**: `:lang(zh-CN)` gets `letter-spacing 0.01em`, `line-height 1.7` (CJK needs looser leading than Latin at equal size); headings override to `letter-spacing 0` / `line-height 1.3`. Chinese labels must NOT be uppercased — `.label-caps` disables `text-transform` under `:lang(zh-CN)` and widens tracking to 0.14em instead.
- **Mobile scale**: hero `text-4xl sm:text-5xl md:text-7xl numeric-display font-bold`, h2 `text-xl sm:text-2xl md:text-3xl font-bold tracking-tight`, label `text-[11px] sm:text-xs font-semibold tracking-[0.2em] uppercase`, body `text-sm sm:text-base`. Inputs pinned to 16px to prevent iOS zoom.

## Elevation & Depth

Flat-by-default terminal depth: panels separated by 1px `border-border` and a one-step surface lift (`background` → `card` → `popover`). Single soft `shadow-terminal` on floating popovers, `shadow-sheet-lift` on the bottom sheet, `shadow-tabbar-lift` on the fixed tab bar — no glow, no blur except the sheet scrim's 6px backdrop blur.

## Structural Zones (mobile-first)

| Zone         | Background                 | Border     | Notes                                                                 |
| ------------ | -------------------------- | ---------- | --------------------------------------------------------------------- |
| Status strip | `bg-card` + `bg-grid`      | `border-b` | Sticky top: LIVE dot, round no., 4-phase stepper, wallet chip, 中/EN toggle |
| Content      | `bg-background`            | —          | Single full-width column; panels stack vertically, `space-y-3`        |
| Panels       | `bg-card`                  | `border`   | Every module is a bordered card with a small uppercase label          |
| Bottom sheet | `bg-popover` + `shadow-sheet-lift` | `border-t` | Crowdfunding amount dialog, slides up over blurred scrim        |
| Tab bar      | `bg-card` + `shadow-tabbar-lift` | `border-t` | Fixed bottom, 4 tabs (对局/众筹/排行/我的), safe-area padded      |
| Footer meta  | `bg-muted/40`              | `border-t` | Inline at column end: exchange rate, treasury, rules link             |

## Mobile Layout Rules

- **Breakpoints**: base = phone (<640px), `sm:` = large phone, `md:` = tablet 2-col, `lg:` = desktop 3-col (legacy). Base layout is the single column.
- **Touch targets**: every tap surface ≥ `--tap-min` (44px); primary actions ≥ `--tap-comfortable` (48px); crowdfunding digit cells `--tap-digit` (44px square).
- **Safe areas**: `.statusbar` pads top inset (notch), `.tabbar` pads bottom inset (home indicator), `.terminal-shell` clears tab bar height.
- **Dense digit grids**: crowdfunding 0-9 keypad wraps to a 5-col grid on phone; 7-digit draw rail scrolls horizontally via `.rail-x` rather than shrinking digits below legibility.
- **Thumb reach**: primary actions sit in the lower third; the amount sheet and tab bar are bottom-anchored.
- **Spacing**: `p-3` card padding on phone (→ `p-4` at `sm:`), `gap-2.5`/`gap-3` between modules.

## Component Patterns

- Buttons: `rounded-md`, amber `bg-primary` for money actions, cyan `bg-accent` for crowdfunding, ghost for secondary; hover lifts with `transition-smooth`, taps use `transition-snap`
- Cards: `rounded-lg border border-border bg-card`, no shadow at rest, `shadow-terminal` on popovers
- Badges: `rounded-sm` uppercase micro-labels; phase badges use the four phase tokens; identity badge (普通玩家/操纵者/合谋者) uses muted→warning→destructive escalation
- Digit cells: 7 equal `rounded-md border bg-background` cells, amber border + mono digit; crowdfunding grid is a 0-9 keypad of square cells with progress bar, lock icon, and cyan/green state
- **Language toggle**: segmented pill (中 | EN) in the status strip, active segment `bg-primary text-primary-foreground`, inactive muted; label swap animates `lang-swap` 200ms
- **Sign-in prompt**: amber-tinted `prompt-banner` strip (`--prompt-bg` / `--prompt-border`) with a short message and inline amber 登录 action, `prompt-in` 240ms; fires globally on any submit while unauthenticated
- **Crowdfunding amount sheet**: tapping a digit opens a bottom sheet — handle bar, bilingual title, large mono amount input, quick-pick chips (100/500/1000), full-width amber submit

## Motion

- Entrance: panels fade+rise 8px over 300ms, staggered 40ms per module
- Sheet: `sheet-up` 280ms cubic-bezier(0.2,0,0,1); scrim fades
- Hover/tap: `transition-smooth` 300ms on surfaces, `transition-snap` 160ms on taps
- Decorative: `pulse-live` (2s) on the active phase dot and on numbers that just changed; `countdown-tick` 1s ease on the countdown; no looping motion on static data

## Constraints

- All numbers MUST use `.numeric` / `.numeric-display` (tabular figures) so live updates never reflow
- Never hide a value that affects the draw — information symmetry is the product
- 3-second action cooldown must always show remaining seconds in mono
- Chinese text must render in the CJK fallback stack; never rely on Latin-only metrics or uppercase transforms
- Every interactive element ≥44px; dark is the primary experience; light must remain fully coherent
- No DAO governance UI and no match-data visualization charts in this build

## Signature Detail

The 7-digit draw display: seven individual bordered digit cells that lock one by one (green check) as crowdfunding thresholds are hit, turning an abstract draw into a visible, contested scoreboard — on phone it becomes a swipeable rail of digits you tap to fund.
