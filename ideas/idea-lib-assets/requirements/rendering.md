# Rendering & Runtime Requirements

## Export pipeline (PNG)
- Render React snippet server-side with fixed viewport size
- Use deterministic fonts and assets (no remote fetching)
- Capture output via headless browser screenshot
- Cache renders by asset version + props hash

## Interactive runtime
- Hydrate the same snippet on event pages
- Props must pass schema validation
- No access to global window APIs beyond approved subset

## Sandbox rules
- Disallow network access in snippet runtime
- Disallow direct DOM mutation outside React
- Restrict imports to approved internal packages

## Determinism controls
- Disable time-based animations for export mode
- Seed any randomness
- Normalize timezone/locale during render
