# lesson-press

Render Pandoc-fenced-div Markdown lessons to print-quality PDF.

`lesson-press` is the source-of-truth renderer for curriculum authored
in Markdown with [Pandoc fenced divs](https://pandoc.org/MANUAL.html#extension-fenced_divs)
(`::: name … :::`). It produces lesson packets via Pandoc + tectonic
using a bundled LaTeX template and Lua filter. The same assets are
designed to be embedded in other consumers (e.g., a Laravel app
rendering on demand) so a lesson written once renders identically
everywhere.

## Status

v0.1.0 — the CLI, asset pipeline, and three goldens (`hello`,
`all-classes`, `image-sidecar`) are stable. Multi-file packet
composition, theme overrides, and an Obsidian plugin are deferred.

## Requirements

- Node ≥ 20
- `pandoc` ≥ 3.1 on PATH
- `tectonic` ≥ 0.15 on PATH
- `pdftotext` (poppler) — only needed if running the test suite

macOS install:

```bash
brew install pandoc tectonic poppler
```

## Install

```bash
npm install -g lesson-press
# or, from a clone:
npm install && npm run build && npm link
```

## Usage

```bash
lesson-press doctor
lesson-press render lesson.md -o lesson.pdf
lesson-press render - -o lesson.pdf < lesson.md
lesson-press render lessons/*.md --separate -o out/
```

## Authoring

See [`docs/contract.md`](docs/contract.md) for the input contract.
[`docs/examples/lesson-1.md`](docs/examples/lesson-1.md) is a complete
worked example exercising every major block class.

## Embedding

The `assets/` directory (Lua filter + LaTeX template) is the same in
every consumer. To embed lesson-press in another application, point
its renderer at this directory:

```
assets/
├── filters/fenced-divs.lua
└── template.latex
```

The CLI's `--asset-dir` flag overrides the bundled location for
development.

## Design

[`docs/superpowers/specs/2026-05-04-lesson-press-design.md`](docs/superpowers/specs/2026-05-04-lesson-press-design.md)
contains the v1 design spec. The implementation plan is at
[`docs/superpowers/plans/2026-05-04-lesson-press.md`](docs/superpowers/plans/2026-05-04-lesson-press.md).

## License

MIT.
