# Portfolio Website — Design Spec

Date: 2026-09-30 · Owner: Zenolitee · Status: draft for review

## 1. Goal

A personal-showcase portfolio in the spirit of yuyoshimuta.com — quiet, typographic,
mostly text — but in dark mode, with a live ASCII black hole as the home-page centerpiece
and a dedicated, image-led Projects showcase.

Success looks like:
- Home page reads instantly as "that black hole site"; it runs smoothly on a laptop and a phone.
- Inner pages feel as calm and clean as the reference's About page.
- Adding a project or note is copy-a-template, no tooling.
- The same black hole appears (pre-rendered) on the GitHub profile README.

Reference visual: `docs/mockups/mock.html` (throwaway; the real code is rewritten, but its
look and the black-hole behaviour are the target).

## 2. Constraints and decisions

| Decision | Choice |
|---|---|
| Stack | Plain HTML / CSS / JS. No framework, no build step for the site. |
| Hosting | GitHub Pages, deployed from `main` (repo root). Repo `Zenolitee/portfolio-zen` (currently private — Pages on a free account needs it public). |
| Fonts | System stacks only (no web-font downloads). |
| Workflow | Implementation on a feature branch, merged to `main` through a PR. |
| Content | Placeholders clearly marked (`Your Name`, bio, links); owner fills in later. |

## 3. Site structure

```
index.html              Home: black hole hero only
about.html              Intro paragraphs + key/value list
projects/index.html     Image-grid showcase
projects/<slug>.html    One detail page per project
notes.html              Dated index of notes
notes/<slug>.html       One page per note
contact.html            Email / GitHub / LinkedIn
css/style.css           Tokens, layout, typography (shared)
js/blackhole.js         Black hole: pure renderer core + DOM mount
assets/projects/<slug>/ Screenshots / GIFs per project
_templates/             project.html, note.html to copy
tools/render-readme-svg.mjs   Generates the README animation (§7)
404.html                Minimal not-found page with the nav row
```

Plain multi-page site: every page is a real HTML file, so links, back button, sharing and
GitHub Pages all work with no router.

## 4. Pages

**Home (`index.html`)** — full-viewport hero, nothing to scroll.
- `<pre>` black hole filling the viewport behind everything.
- Four corner links: ABOUT ↗ (top-left), PROJECTS ↗ (top-right), NOTES ↗ (bottom-left),
  CONTACT ↗ (bottom-right). Name top-centre in spaced monospace caps; `© 2026 Name · City`
  bottom-centre.
- A visually hidden `<h1>` + description for screen readers / SEO; the `<pre>` is
  `aria-hidden`.

**Inner pages** share one shell:
- Top nav row: `← Home  About  Projects  Notes  Contact` (monospace, 11px, 0.12em tracking,
  current page highlighted), thin rule below.
- Single column, `width: min(100% - 40px, 860px)`.
- Section title in small caps (13px, 0.14em); footer `© year name` in 9px mono.

**About** — 2–3 large lead paragraphs (18–24px), then a `dl` of Based / Focus / Working on.

**Projects (`projects/index.html`)** — the showcase.
- Grid: 2 columns desktop, 1 column ≤ 620px; gap 44px × 28px.
- Card = 16:10 image (thin 1px border, no shadow) → title + year (mono) → one-line summary.
- Hover: image lifts 3px, border brightens, title turns accent. Whole card is the link.
- Images: `loading="lazy"`, explicit `width`/`height` to avoid layout shift.
- Seed projects: NW-Helper, Packet Tracer MCP (placeholders until real screenshots).

**Project detail (`projects/<slug>.html`)**
- Large title, one-line summary, `dl` (Year, Role, Stack, Links), hero image/GIF (16:9),
  write-up with `h2` sub-sections, optional 2-up image pairs, `← All projects` link.

**Notes** — dated list (date · title · one-liner), each linking to `notes/<slug>.html`,
styled like the reference's notes.

**Contact** — `dl` of Email, GitHub, LinkedIn.

## 5. Visual tokens

```
--bg: #0b0b0c   --ink: #e8e6e1   --muted: #807d75   --line: #26262a   --accent: #f0a45a
--mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace
--sans: "Helvetica Neue", Helvetica, Arial, sans-serif
```
Body 15px / 1.6. Links underline with 3px offset. Accent used only for hover/focus.
Visible focus rings (1px outline, 8px offset on corner links). Dark only.

## 6. Black hole renderer (`js/blackhole.js`)

ES module with a pure core (no DOM) so the site and the README generator share it:

```js
export function createBlackHole(opts)      // -> { shade(x, y, t), charFor(v) }
export function renderFrame(bh, grid, t)   // -> string of rows (pure)
export function mount(preEl, opts)         // DOM: sizing, loop, pause/resume
```

### 6.1 Model (screen space, units of shadow radius R)
- **Shadow**: black disc r < 1.
- **Photon ring**: thin gaussian at r ≈ 1.035.
- **Flat disk**: seen nearly edge-on, `TILT = 0.12`; inner edge 1.4, outer 4.3 (+0.6 fade);
  far half hidden inside the shadow; outer part fades into wisps
  (`1 − 0.55·smooth(2.0, 4.3, ρ)`).
- **Lensed far disk (top arc)**: maps screen radius to disk radius
  `ρ = 1.4 + (r − 1.04)·4.2`, reaching ≈ 1.8 R; sampled at the true far-side angle
  `atan2(y, x)` so it flows opposite the front band (one continuous rotation).
- **Thin lower image**: same mapping with factor 6.0, weak.
- **Doppler beaming**: left side (approaching) brighter: `1 + 0.6·(−x/ρ)`.
- **Stars**: sparse, faint, twinkling; added after gain so they stay dots.

### 6.2 Motion (lessons from the mockup — these are requirements)
- Material moves toward −φ: **front band left→right, top arc right→left**.
- **Disk texture rotates rigidly** (angular speed of radius 2.0). No per-radius shear in the
  texture: shear makes slanted streaks that read as motion *across* the orbit (barber-pole),
  which made the edge-on sides appear to spread outward.
- **Keplerian speed only in the hot spots** (4 round blobs, ω ∝ ρ^−1.5), which show
  inner-faster-than-outer without streaking.
- Texture = periodic value noise in (ρ, orbit angle), clump aspect ≈ 1.3 : 1 so motion is
  visible; seamless around the orbit.

### 6.3 Performance (requirements)
- Grid capped at **260 columns**; beyond that the font size grows instead (zoom-out and
  large screens cost the same as a laptop).
- Cells outside the bounding box (|x| < 5.0, |y| < 2.0) skip the physics.
- Target ≤ 10 ms per frame at 260×90, 30 fps cap.
- Pause when off-screen (IntersectionObserver) or tab hidden (`visibilitychange`).
- `prefers-reduced-motion: reduce` → render one still frame, no loop.
- Phones (< 620px): black hole scaled up so the disk may run off the sides; grid still capped.
- Resize handled with ResizeObserver, debounced.

## 7. GitHub profile README animation

GitHub READMEs can't run JavaScript, so the README gets a **pre-rendered animated SVG**.

- `tools/render-readme-svg.mjs` (Node, no deps) imports the core from `js/blackhole.js`,
  renders N frames on a ~110×40 grid, and writes `assets/readme/blackhole.svg`.
- SVG: monospace `<text>` rows per frame; frames stepped with a CSS `@keyframes` animation
  (`steps`), transparent background, warm off-white text that reads on GitHub's light and dark
  themes.
- **Seamless loop**: loop length L = one texture revolution; hot-spot speeds rounded to whole
  turns per L in README mode so the last frame flows into the first.
- Budget: ≤ ~600 KB SVG (≈ 72 frames). If over budget, reduce frames or grid.
- Delivery: copy the SVG into the profile repo `Zenolitee/Zenolitee` (`assets/blackhole.svg`)
  and add it to its README via a **separate PR on that repo** — confirmed with the owner
  before pushing.
- Risk: GitHub's image proxy must keep CSS animations in SVGs (it does for the existing
  typing SVG). Verify on the PR preview; fallback is an animated GIF from the same frames.

## 8. Repository and delivery

1. Repo `Zenolitee/portfolio-zen` (created by owner); push `main` (mockup + this spec).
2. Build on branch `feat/site`; open a PR into `main`.
3. Enable GitHub Pages (source: `main`, root) after merge; site at
   `https://zenolitee.github.io/portfolio-zen/` (custom domain optional, later).
   All internal links relative so the sub-path works.
4. README animation: follow-up branch/PR in the profile repo (§7).

## 9. Testing / verification

- **Unit-level (Node, `node --test`)** on the pure core:
  - direction: pattern at φ reappears at φ − ωΔt (front band → right, top arc → left);
  - no shear: texture phase independent of radius (guards the barber-pole regression);
  - bounding box: `shade` is 0 outside the box and never clips (edge values ≈ 0);
  - README loop: frame N equals frame 0.
- **Browser (headless Playwright)**: screenshots of every page at 1440×900 and 390×844; no
  console errors; no horizontal scroll; frame time ≤ 10 ms at 260×90 and unchanged at 3×
  viewport; reduced-motion renders a still frame.
- **Accessibility**: landmarks, visible focus, links keyboard reachable; `--muted` on `--bg`
  is 4.79:1 (≥ 4.5:1 for body text) — keep it at or above that if tokens change.
- **Links**: every internal link resolves (simple crawl script against the local server).

## 10. Out of scope

Light mode, CMS/Markdown pipeline, analytics, contact form, blog RSS, custom domain setup,
real content (owner supplies), mouse-reactive black hole.
