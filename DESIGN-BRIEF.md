# Design pass prompt — paste this into Claude Code from ~/projects/brc-gate-wait

---

You are doing a **visual-only** pass on this Next.js app (Gate Watch, a live
Burning Man gate-wait dashboard, deployed at brc-gate-watch.vercel.app). Read
`app/globals.css`, `app/Dashboard.tsx`, `app/components/*.tsx` first.

**Do not change any data logic, API routes, parsing, or copy meaning.** You may
rewrite markup structure and all styling. If you touch a `lib/` file, you have
gone too far.

## The problem

It currently reads as *generic AI dark mode*: rounded rectangles on near-black,
one orange accent, a monospace label on every card, evenly-weighted panels
stacked down the page. Competent, anonymous, could be a crypto dashboard. It
looks like software about Burning Man rather than an object from it.

## What it should feel like

Black Rock City's real visual language is **not** neon-on-black cyberpunk. It is:

- **Playa daylight** — bleached alkali white, dust haze, sun-faded signage. The
  most Burning Man colour is not orange, it is *dust*: warm grey-beige, low
  saturation, everything slightly washed out as if photographed at 2pm through
  particulate.
- **Hand-made and utilitarian** — hand-painted street signs, stencilled letters
  on plywood, gaffer tape, Sharpie on duct tape, laser-cut steel, rebar. Things
  built to survive wind, labelled so a stranger can read them at 3am.
- **The city grid itself** — BRC is a clock face. Radial streets 2:00–10:00,
  concentric arcs A through L. Time and geometry *are* the identity.
- **Survival-guide typography** — the Survival Guide, the ticket, the WhatWhereWhen
  book: condensed sans, heavy caps, big numerals, high contrast, dense information
  laid out to be read fast in bad light.

## Concrete direction

1. **Invert the palette assumption.** Try a dusty light theme as the primary —
   warm off-white paper (#EDE4D3-ish), ink-black type, with the wait-time colour
   ramp doing the only saturated work. Keep a genuine dark variant for night
   driving (this thing gets read at 2am in a car) and honour
   `prefers-color-scheme`. If light truly does not work, commit hard to a *warm*
   dark — dust and rust, not black and cyan.
2. **Make the wait number monumental.** The current travel time should read like
   a highway sign or a burn-night countdown: enormous condensed numerals, tight
   tracking, filling the width. It is the one thing someone checks at 70mph.
3. **Steal the clock geometry.** The 24-hour heatmap is begging to be a radial
   dial rather than a grid — hours around the face like BRC's streets, days as
   concentric rings. Only do this if it stays *readable on a phone*; a beautiful
   unreadable chart is a failure. If radial loses legibility, keep the grid but
   make it feel stencilled.
4. **Section headers as signage**, not as tiny mono labels. Think stencilled
   caps, a rule line, a number — the way camps label things.
5. **Texture, sparingly.** A subtle dust grain or paper tooth over the background
   (CSS gradients/SVG noise only, no image files, must not hurt contrast). One
   texture, not three.
6. **Kill the sameness.** Right now every section is an identical rounded card.
   Vary the rhythm: let the hero bleed full-bleed, let the chart sit on the page
   without a container, use rules and whitespace instead of borders in places.

## Hard constraints

- **Mobile first, one-handed, in a car, in daylight.** Test at 390px. Touch
  targets ≥44px. Nothing may require horizontal page scroll (wide charts scroll
  inside their own container).
- **Legible in bright sun** — contrast ratios must actually pass AA, and do not
  put critical numbers in low-contrast dust tones.
- Keep `prefers-reduced-motion` handling. Any new animation must be optional.
- Fonts: you may swap, but only from Google Fonts, and keep the load to two
  families. A condensed grotesque plus one mono would suit.
- **Do not invent data or change any number, and do not remove the honesty
  affordances**: source-status chips, "unverified" tags on social chatter, the
  stale-camera warning, the note that historical years are separate scenarios.
  Those are the point of the thing.
- Run `npm run build` and fix any type errors before you finish. Screenshot at
  390px and 1200px and show me both.

Start by proposing the palette and type scale as a short spec, then implement.
