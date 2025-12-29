# Snippet Template Guidelines (Social Sizes)

These guidelines keep templates readable on real devices (phone-sized viewing). They explain why seemingly large type values are required at 1080px canvases.

## Core Principle: Readability Wins

Most users see posts on a 6–7 inch screen. A 1080px canvas is downscaled by the app, so small text becomes illegible. Larger type sizes preserve legibility after scaling.

## Supported Instagram Formats

- 1:1 Square: 1080 × 1080
- 4:5 Portrait: 1080 × 1350
- 9:16 Story/Reel: 1080 × 1920 (keep UI safe zones)

## Type Scale Targets (1080px width)

Use these as starting points. Adjust up if the layout feels dense.

### Instagram 1:1 (1080 × 1080)
- Eyebrow (mono): 24–28px
- Headline (Lexend Exa): 88–104px
- Subheadline (Inter): 32–40px
- Details (date/time/location): 30–36px
- CTA line (uppercase): 26–32px

### Instagram 4:5 (1080 × 1350)
- Eyebrow (mono): 24–30px
- Headline (Lexend Exa): 96–112px
- Subheadline (Inter): 34–42px
- Details (date/time/location): 32–38px
- CTA line (uppercase): 26–32px

### Instagram Story (1080 × 1920)
- Eyebrow (mono): 26–32px
- Headline (Lexend Exa): 104–120px
- Subheadline (Inter): 36–44px
- Details (date/time): 36–42px
- CTA line (uppercase): 30–36px

## Logo Scale Targets

The logo must remain readable at feed scale.

- Mark size: 60–72px
- Wordmark size (Unbounded): 26–32px
- Gap between mark and wordmark: 10–12px

Why: the blue key and wordmark lose definition when smaller than ~60px/26px on 1080px canvases.

## Layout Density Rules

- Max 3 text blocks per canvas (eyebrow, headline, one supporting line).
- Combine details when possible (e.g., "Fri, Feb 14 / 19:00–02:00").
- Favor fewer, larger elements over more, smaller ones.
- Keep 1px borders only where they help separate sections.

## Safe Areas

- Story/Reel: keep critical text 100px away from top and bottom to avoid UI overlays.
- Leave extra bottom space for swipe/interaction affordances.

## Readability Check (Quick)

1. Zoom the preview to ~30% on desktop.
2. If you cannot read the smallest text at a glance, increase it.
3. Treat 24px as the minimum size for any meaningful text at 1080px width.

## Template Checklist

- [ ] Eyebrow and CTA are at least 24–26px.
- [ ] Headline is at least ~90px for 1080px width.
- [ ] Logo mark is 60px+; wordmark is 26px+.
- [ ] No more than three text blocks.
- [ ] Story content stays inside safe zones.

