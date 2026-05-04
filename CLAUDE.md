# lesson-press — agent notes

Standalone TypeScript CLI that renders Pandoc-fenced-div Markdown lessons to print-quality PDF via pandoc + tectonic. Source-of-truth assets (Lua filter + LaTeX template) consumable by a CLI, an Obsidian plugin (deferred to v1.x), and embedding in other applications such as waymark (deferred).

## Architecture

| File | Role |
|------|------|
| `src/cli.ts` | commander-based CLI entry; dispatches `render` and `doctor` subcommands |
| `src/render.ts` | `render(opts)` — shells pandoc + tectonic with bundled assets |
| `src/resolveBinary.ts` | pandoc/tectonic binary discovery (PATH → Homebrew/system fallbacks) |
| `src/frontmatter.ts` | YAML frontmatter parsing + `<unit> · <curriculum>` author fallback |
| `src/doctor.ts` | toolchain version probe |
| `src/assetPaths.ts` | resolves bundled assets relative to the running script |
| `assets/template.latex` | Pandoc LaTeX template (lifted from waymark) |
| `assets/filters/fenced-divs.lua` | Lua filter mapping eleven fenced-div classes → tcolorbox envs |

The Node layer is intentionally thin. All visual decisions live in the LaTeX template; all class-to-env mapping in the Lua filter. No JS-side AST manipulation.

## Commands

```
npm install
npm run build              # tsc → dist/
npm test                   # builds first, then runs vitest
npm run typecheck          # tsc --noEmit
npm link                   # makes `lesson-press` callable globally
lesson-press doctor
lesson-press render <md> -o <pdf>
```

## External dependencies (not bundled)

- pandoc ≥ 3.1
- tectonic ≥ 0.15
- pdftotext (poppler) — only for the test suite

macOS: `brew install pandoc tectonic poppler`.

## Input contract

See `docs/contract.md`. One `.md` = one PDF. Frontmatter on top, body uses CommonMark plus the eleven fenced-div classes (`read`, `scripture`, `say`, `ask`, `prayer`, `discussion`, `question`, `key-truth`, `note`, `transition`, `materials`) inherited from waymark.

## Testing

Goldens at `tests/golden/<name>/{input.md,expected.txt}` (and `images/` where used). Each test renders the input and asserts every non-empty line of `expected.txt` appears in the resulting PDF's `pdftotext` output (whitespace-tolerant, order-independent within a single line — pdftotext layout ordering is unstable).

## Design and plan

- Design: `docs/superpowers/specs/2026-05-04-lesson-press-design.md`
- Plan: `docs/superpowers/plans/2026-05-04-lesson-press.md`

Both reflect v0.1.0 scope. Multi-file packet composition, theme overrides, an Obsidian plugin, and the waymark migration are explicitly deferred.

## Sibling projects (local)

- `~/Projects/obsidian-fenced-divs` — Obsidian preview plugin for the same fenced-div syntax. Authoring side; lesson-press is the export side.
- `~/herd/waymark` — Laravel/Supabase curriculum app. Currently bundles its own copies of the template + filter at `resources/pdf/`; will eventually depend on lesson-press.
