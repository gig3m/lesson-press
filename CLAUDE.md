# lesson-press — agent notes

Standalone TypeScript CLI that renders Pandoc-fenced-div Markdown lessons to print-quality PDF via pandoc + tectonic. Source-of-truth assets (Lua filter + LaTeX template) consumable by a CLI, an Obsidian plugin (deferred to v1.x), and embedding in other applications such as waymark (deferred).

## Architecture

| File | Role |
|------|------|
| `src/cli.ts` | commander-based CLI entry; exports `buildProgram()` and `main(argv)` so tests can import without auto-parsing argv. Dispatches `render` and `doctor` subcommands |
| `src/render.ts` | `render(opts)` — shells pandoc + tectonic with bundled assets. Throws typed `PipelineError` on toolchain failure (cli.ts maps to exit code 2) |
| `src/resolveBinary.ts` | pandoc/tectonic binary discovery (PATH → Homebrew/system fallbacks). Throws `BinaryNotFoundError` with actionable message |
| `src/frontmatter.ts` | YAML frontmatter parsing (gray-matter) + `<unit> · <curriculum>` author fallback per spec §4.2 |
| `src/doctor.ts` | toolchain version probe; checks pandoc ≥ 3.1, tectonic ≥ 0.15 |
| `src/assetPaths.ts` | resolves bundled assets relative to the running script via `import.meta.url`; works in both dev (`tsx src/cli.ts`) and dist (`node dist/cli.js`) layouts |
| `assets/template.latex` | Pandoc LaTeX template (lifted byte-identical from waymark) |
| `assets/filters/fenced-divs.lua` | Lua filter mapping eleven fenced-div classes → tcolorbox envs (lifted byte-identical from waymark); also rewrites italic-only paragraphs in `:::discussion` OL items to `\answerparagraph` |

The Node layer is intentionally thin. All visual decisions live in the LaTeX template; all class-to-env mapping in the Lua filter. No JS-side AST manipulation. The renderer also injects `--metadata titlepage=true` when frontmatter omits it, since pandoc's `$if(titlepage)$` returns false on undefined and the spec defaults it to true.

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

35 tests across 6 files (vitest). Unit tests cover `resolveBinary`, `frontmatter`, `doctor`, and the lua filter (per-class via spawned pandoc). Integration tests cover the CLI (`tests/cli.test.ts` — file input, stdin, `--separate`, multi-input rejection) and the end-to-end pipeline via four goldens (`tests/render.test.ts`).

Goldens live at `tests/golden/<name>/{input.md,expected.txt}` (and `images/` where used). Each test renders the input and asserts every non-empty line of `expected.txt` appears in the resulting PDF's `pdftotext` output (whitespace-tolerant, order-independent within a single line — pdftotext layout ordering is unstable). Pass `runGolden(name, { keepTmp: true })` to preserve the work dir for debugging.

The `npm test` script builds first (`tsc`) and then runs vitest, because the CLI integration tests spawn `node dist/cli.js`. CI runs the same.

## Design and plan

- Design: `docs/superpowers/specs/2026-05-04-lesson-press-design.md`
- Plan: `docs/superpowers/plans/2026-05-04-lesson-press.md`

Both reflect v0.1.0 scope. Multi-file packet composition, theme overrides, an Obsidian plugin, and the waymark migration are explicitly deferred.

## Sibling projects (local)

- `~/Projects/obsidian-fenced-divs` — Obsidian preview plugin for the same fenced-div syntax. Authoring side; lesson-press is the export side.
- `~/herd/waymark` — Laravel/Supabase curriculum app. Currently bundles its own copies of the template + filter at `resources/pdf/`; will eventually depend on lesson-press.
