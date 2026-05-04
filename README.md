# lesson-press

Render Pandoc-fenced-div Markdown lessons to print-quality PDF.

> Status: pre-release (v0.1.0-dev). See
> [`docs/superpowers/specs/2026-05-04-lesson-press-design.md`](docs/superpowers/specs/2026-05-04-lesson-press-design.md)
> for the full design.

## Requirements

- Node ≥ 20
- `pandoc` ≥ 3.1 on PATH
- `tectonic` ≥ 0.15 on PATH

## Install (development)

```bash
npm install
npm run build
npm link    # makes `lesson-press` globally callable
```

## Usage

```bash
lesson-press render lesson.md -o lesson.pdf
lesson-press doctor
```

See [`docs/contract.md`](docs/contract.md) for the input contract.
