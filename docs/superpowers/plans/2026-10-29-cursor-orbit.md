# Custom cursor + idle orbit — plan (2026-10-29)

## Decisions
- Cursor style: **B. Event horizon** — small solid dot + thin ring that lags behind, stretches with speed, and expands to wrap links.
- Scope: **whole site** (every page loads it). Idle orbit: **homepage only**.
- Orbit shape: **tilted ellipse** matching the accretion disk's inclination; dims while behind the hole.

## Constraints
- Browsers can't move the real pointer, so the orbit animates our drawn cursor; the system cursor is hidden with `cursor: none`.
- Off for touch-only devices (`hover: none`) and `prefers-reduced-motion: reduce` — normal cursor stays.
- Keyboard focus outlines unchanged; links/buttons still get the native click target.

## Files
- `js/cursor.js` — new module. Pure helpers exported for tests:
  - `follow(pos, target, k)` — eased lag for the ring.
  - `orbitPoint(t, center, r, tilt)` — point on the tilted ellipse at angle t; returns `{x, y, behind}`.
  - `inspiral(progress, r0, r1)` — radius shrinking from start distance to orbit radius; angular speed ∝ r^-1.5.
- `css/style.css` — `.cursor-dot`, `.cursor-ring`, `.cursor-ring.is-link`, `.cursor.is-behind`, `html.has-cursor { cursor: none }` (links too).
- Every page: add `<script type="module" src="…/js/cursor.js"></script>` (index, about, notes, contact, 404, projects/*, `_templates/*`).
- `tests/cursor.test.mjs` — asserts on the pure helpers (ellipse bounds, behind flag on the far half, inspiral reaches r1 and angular speed increases).

## Idle orbit behaviour (homepage, `[data-trail]` landing only)
1. No pointer movement for 5 s, page visible, pointer inside the landing.
2. Wait until blackhole.js's own 4 s idle view-reset has finished (start orbit at ≥ 5 s, after it).
3. Inspiral from the cursor's position to the orbit radius (just outside the shadow) over ~2.5 s, speeding up as r shrinks.
4. Steady orbit on the tilted ellipse; on the far half (`behind`) fade to ~25% opacity; stretch the dot along its velocity.
5. Any `pointermove` / `pointerdown` / `keydown`: snap cursor back to the real pointer (~120 ms ease), reset the idle timer.
6. Hole centre = centre of `#blackhole`; recompute on resize.

## Out of scope (for now)
- Bento projects page (user picked mockup #3; implement later on request).
- Trail blocks along the orbit path.

## Verify
- `npm test` passes (existing + new cursor test).
- Browser: cursor follows, ring wraps corner links, orbit starts after 5 s idle, behind-dimming visible, movement snaps back; touch emulation + reduced-motion show the normal cursor.
