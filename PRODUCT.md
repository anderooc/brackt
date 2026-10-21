# Product

## Register

product

## Users

Three audiences share one app:

- **Hosts / organizers** run events end-to-end — divisions, registration, pools, brackets, court scheduling, live scoring. They are often mid-task, under game-day time pressure, on a laptop or phone courtside.
- **Teams / captains** register clubs, manage rosters and jersey numbers, and track application status.
- **Players & fans** browse public tournaments and follow live scores, frequently on mobile.

The job to be done: replace the tangle of spreadsheets and group chats that collegiate club volleyball currently runs on with one trustworthy hub.

## Product Purpose

brackt is a tournament hub for collegiate club volleyball. It exists to let a host run a real event from draft to finals without leaving the app, while giving teams and fans a clear public window into registration and live results. Success looks like an organizer confidently running game day on brackt, and a fan trusting the live score on screen.

## Brand Personality

Sporty but refined and trustworthy. Voice is confident and plain-spoken, never hype. Think a premium SaaS dashboard (Linear/Stripe-grade craft) wearing team colors — energy from the "Center Court" brand, discipline from the layout. The logo is a top-down court with a red net beside a heavy italic "brackt" wordmark (domain brack-t.com). Court blue (#315CA8) leads and carries every primary action; net red (#C92F45) is scarce — the logo's net and live play only. Brand art (`src/components/brand/`) is flat line work generated from the Figma exports; dense data screens stay calm.

## Anti-references

- Flashy gaming / esports sites: neon, aggressive gradients, heavy glassmorphism, motion for its own sake.
- Generic AI-SaaS slop: hero-metric template, identical icon-card grids, tiny tracked uppercase eyebrows on every section, gradient text used as decoration.
- Spreadsheet-grade utilitarian tools with no hierarchy or state design — the thing brackt replaces.

## Design Principles

1. **The tool disappears into the task.** Earned familiarity over novelty; standard affordances for standard jobs. Delight lives in moments (hero, empty states, the wordmark), not on dense data screens.
2. **State is the product.** Tournament and registration lifecycle states are first-class — one consistent, legible badge/color vocabulary everywhere they appear.
3. **Calm under density.** Generous spacing and clear hierarchy on data-heavy surfaces; brand texture and gradient reserved for accents (heroes, CTAs, empty states).
4. **Consistency screen-to-screen.** One elevation/border/radius language, one button vocabulary, one form-control set across the whole app.
5. **Trustworthy on every device and theme.** Full light/dark parity, mobile-first, accessible by default — never an afterthought.

## Accessibility & Inclusion

Target WCAG 2.1 AA. Body text ≥4.5:1, large text ≥3:1, in both light and dark themes. Status must never rely on color alone (label + color, optionally icon). Semantic HTML, visible `focus-visible` rings (tokens already defined), full keyboard navigation, and ARIA on interactive widgets (tabs, dialogs, menus from `@base-ui/react`). Honor `prefers-reduced-motion` on every animation.
