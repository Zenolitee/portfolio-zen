# portfolio-zen

Personal portfolio — dark, typographic, with a live ASCII black hole on the home page.
Live at https://zenolitee.github.io/portfolio-zen/

![ASCII black hole](assets/readme/blackhole.svg)

## Run locally

ES modules need a server (not `file://`):

```sh
python -m http.server 8765
# open http://localhost:8765/
```

## Checks

```sh
npm test              # renderer, link checker and README-SVG tests (Node 22+, no dependencies)
npm run check-links   # every internal link resolves
```

## Add a project

1. Copy `_templates/project.html` to `projects/<slug>.html` and fill in the UPPERCASE placeholders.
2. Put `poster.jpg` (1280×720 still) and `preview.mp4` (short silent clip, 16:9) in `assets/projects/<slug>/`.
   Encode clips small and web-safe: `ffmpeg -i in.mp4 -vf scale=960:540,fps=25,format=yuv420p -c:v libx264 -crf 28 -an -movflags +faststart preview.mp4`
3. Copy a `<li class="show-row">` block in `projects/index.html` (the clip plays on hover), then run `npm test`.

Notes work the same way with `_templates/note.html` and `notes.html`.

## Black hole

- `js/blackhole.js` — the home page's 3D black hole: light traced through Schwarzschild geometry,
  drag (or arrow keys) to orbit, Home or double-click to reset. Also renders the README SVG.
- `js/blackhole-core.js` — the pieces it builds on (disk texture, stars, layout), no DOM.
- `npm run readme-svg` — regenerates `assets/readme/blackhole.svg` for the GitHub profile.

Design notes: `docs/superpowers/specs/2026-09-30-portfolio-design.md`.
