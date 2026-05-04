# Lesson Press — Design Spec

**Status:** Draft · 2026-05-04
**Project name:** `lesson-press`

## 1. Purpose

A standalone, source-of-truth renderer that turns canonical
Pandoc-fenced-div Markdown files into print-quality PDF lesson
packets. Three consumer contexts share the same renderer:

1. **CLI** — author runs `lesson-press render lesson.md -o lesson.pdf`
   from a terminal. v1.
2. **Obsidian plugin** — separate sibling plugin shells out to the
   CLI for a one-click "Export current note." v1.x, deferred but
   designed for.
3. **Embedding** — Waymark (and any future Laravel/web app) replaces
   its bundled `resources/pdf/` template + filter with this package
   as the single source of truth. Migration deferred but contract-
   compatible.

The rendering layer that exists in Waymark today
(`resources/pdf/lesson.latex` + `resources/pdf/filters/fenced-divs.lua`)
is the seed for this package. Waymark eventually depends on the
package instead of carrying its own copies.

## 2. Non-goals

- Authoring UI. Obsidian + the existing `obsidian-fenced-divs`
  preview plugin already cover that.
- Multi-format output beyond PDF in v1. Pandoc supports HTML / EPUB /
  DOCX writers, but each needs its own template; defer.
- Replacing Waymark's content storage or import pipeline. This
  package owns the *render* step only.
- HTTP service mode. Shell-execable assets + a thin CLI is enough.
- Multi-file → single-PDF composition (e.g. "Week 1 packet =
  Sunday + Wednesday"). v1.x feature; v1 is single file in, single
  PDF out, with `--separate` allowing N files → N PDFs.

## 3. Architecture

```
lesson-press/                            ← NEW repo, ~/Projects/lesson-press/
├── assets/
│   ├── template.latex                   ← Pandoc template, slimmed from waymark
│   └── filters/
│       └── fenced-divs.lua              ← lifted unchanged from waymark
├── bin/lesson-press                     ← Node CLI shim
├── src/render.ts                        ← thin pandoc + tectonic wrapper
├── docs/
│   ├── contract.md                      ← canonical contract (frontmatter + class vocab)
│   ├── examples/lesson-1.md
│   └── superpowers/{specs,plans}/
├── tests/
│   └── golden/                          ← input.md → expected pdftotext snapshot
├── package.json
└── README.md
```

External dependencies (host-installed, **not bundled**): `pandoc ≥ 3.1`,
`tectonic ≥ 0.15`. The package itself is pure assets plus ~150 lines
of TypeScript.

## 4. Input contract

### 4.1 File shape

**One Markdown file = one PDF.** No internal section / page-break
convention; if you want a multi-day packet, that's batch composition
(out of v1 scope). Each file is a self-contained lesson unit.

```markdown
---
title: "The Beginning of Everything"
week: 1
unit: "Genesis"
curriculum: "High School"
scripture_text: "Genesis 1–2"
big_idea: "God is the source of life…"
memory_verse: "Genesis 2:8–9"
toc: false
---

:::read
Genesis 1:1–5
:::

## Teaching Points

…
```

### 4.2 Frontmatter keys

All optional except `title`. Unknown keys ignored. Missing optional
metadata never errors — the renderer just drops the corresponding
titlepage element.

| Key | Type | Behavior |
|---|---|---|
| `title` | string (req) | Titlepage title; running header |
| `subtitle` | string | Below title on titlepage |
| `author` | string | Defaults to `"<unit> · <curriculum>"` if both set |
| `week` | int | Decorative; rendered on titlepage |
| `unit` | string | |
| `curriculum` | string | |
| `scripture_text` | string | Titlepage block under gold rule |
| `big_idea` | string | Titlepage block |
| `memory_verse` | string | Titlepage block |
| `toc` | bool | Show TOC after titlepage; default `false` |
| `titlepage` | bool | Emit titlepage at all; default `true` |

### 4.3 Block vocabulary

v1 ships waymark's eleven classes verbatim:

| Class | LaTeX env |
|---|---|
| `:::read` | `readpill` |
| `:::scripture` | `scripturebox` |
| `:::say` | `saybox` |
| `:::ask` | `askbox` |
| `:::prayer` | `prayerbox` |
| `:::discussion` | `discussionbox` |
| `:::question` | `questionbox` |
| `:::key-truth` | `keytruthbox` |
| `:::note` | `notebox` |
| `:::transition` | `transitionbox` |
| `:::materials` | `materialsbox` |

Plus the discussion-answer convention: an italic-only paragraph as
the last child of an OL item inside `:::discussion` becomes
`\answerparagraph{…}` (lifted from waymark's filter).

Vocabulary expansion in future versions is **additive** — register a
new class in the Lua filter's `envs` table and add the matching
`tcolorbox` env in `template.latex`. No breaking change to consumers.

Unknown classes pass through untouched: Pandoc emits the inner
content with no decoration.

### 4.4 Image sidecars

Authors reference images with plain Markdown:

```markdown
![Diagram of the seven days](images/seven-days.png)
```

Paths resolve **relative to the input `.md` file**. The renderer adds
the input file's directory to tectonic's search path so relative
references work without copying files into the work dir. Obsidian's
`![[wikilink-image.png]]` syntax is **not supported** in v1 — authors
use plain Markdown image syntax. (A preprocessor for `![[…]]` is a
v2 candidate.)

Supported formats: PNG, JPEG, PDF (vector). SVG requires Inkscape
on host; not a v1 dependency.

## 5. CLI surface

```
lesson-press render <input.md> -o <output.pdf>
  --asset-dir <path>    Override bundled asset dir (dev/override)
  --pandoc <bin>        Override pandoc binary (default: PATH)
  --tectonic <bin>      Override tectonic binary (default: PATH)
  --keep-tmp            Don't delete intermediate work dir
  --verbose             Show full pandoc invocation

lesson-press render - -o <output.pdf>
  Reads the source Markdown from stdin. Frontmatter still
  required. Image sidecars resolved relative to the current
  working directory. (Used by the Obsidian plugin.)

lesson-press render <input1.md> <input2.md> [...] --separate -o <output-dir>
  Renders each input to its own PDF in <output-dir>. Filename
  derived from each input's basename.

lesson-press doctor
  Checks pandoc + tectonic versions; exits non-zero with an
  actionable message if missing or below required version.
```

In v1, omitting `--separate` with multiple file inputs is an error.
Single file (or `-` for stdin) + `-o <file.pdf>` is the canonical
happy path.

Exit codes: `0` success, `1` user error (bad markdown, missing input,
bad CLI args), `2` toolchain error (pandoc / tectonic missing or
crashed).

## 6. Renderer internals

`src/render.ts` exposes one function:

```ts
async function render(opts: {
  inputPath: string;
  outputPath: string;
  assetDir?: string;
  pandocBin?: string;
  tectonicBin?: string;
  keepTmp?: boolean;
  verbose?: boolean;
}): Promise<void>
```

Steps:

1. Resolve `pandoc` and `tectonic` binaries. Order: explicit
   `--pandoc` / `--tectonic` flag → `PATH` lookup via `which` →
   fallback chain `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`,
   `/bin`. Throws actionable error if not found. (Same approach as
   waymark's `LessonPdfRenderer::resolveBinary()`.)
2. Create a tmp work dir under `os.tmpdir()`. Auto-cleaned in
   `finally` unless `keepTmp`.
3. Run pandoc:
   ```
   pandoc \
     --from markdown \
     --template <assetDir>/template.latex \
     --lua-filter <assetDir>/filters/fenced-divs.lua \
     --pdf-engine <tectonicBin> \
     --pdf-engine-opt=-Z \
     --pdf-engine-opt=search-path=<workDir> \
     --pdf-engine-opt=search-path=<inputDir> \
     -o <workDir>/out.pdf \
     <inputPath>
   ```
   The two `search-path` options give tectonic both the workdir
   (intermediates) and the input file's directory (image sidecars).
4. Move `<workDir>/out.pdf` to `outputPath`.

The Node wrapper is intentionally thin; all real work lives in
pandoc + the LaTeX template + the Lua filter. No JS-side AST
manipulation.

## 7. Asset resolution

Default `assetDir` is the package's bundled `assets/` directory,
discovered relative to the running script via `import.meta.url`. The
`--asset-dir` flag overrides this for development (point at a working
copy of the assets without rebuilding the CLI) and for embedding
(Waymark points at its vendored copy).

Asset directory must contain:
- `template.latex` (Pandoc template)
- `filters/fenced-divs.lua` (Lua filter)

The renderer fails fast at startup if either is missing.

## 8. Waymark migration (deferred, contract guaranteed)

Future, non-blocking: Waymark's `app/Services/LessonPdfRenderer.php`
keeps its current shape but resolves asset paths via:

```php
$assetDir = config('lesson-press.asset_dir',
                   base_path('vendor/lesson-press/assets'));
$templatePath = $assetDir . '/template.latex';
$luaFilterPath = $assetDir . '/filters/fenced-divs.lua';
```

How `vendor/lesson-press/` arrives is open: composer package, git
submodule, or `make vendor` curl-ing a tagged release. This design
only requires the assets to be discoverable at a configurable path.

## 9. Obsidian plugin (v1.x, deferred)

A separate `obsidian-lesson-press` repo (sibling to
`obsidian-fenced-divs`):

- Adds an "Export current note to PDF" command palette entry.
- Looks up `lesson-press` on `PATH`; helpful error if missing.
- Pipes the active note's content via stdin:
  `lesson-press render - -o <vault>/exports/<filename>.pdf`.
- Reveals the PDF in Finder on success.

Stdin support (`-` as the input arg) is part of v1's CLI surface so
the v1.x plugin is a < 200-line wrapper.

## 10. Testing

- **Golden:** `tests/golden/*.md` fixtures, expected output checked
  via `pdftotext` page-1 text comparison. Binary-PDF byte-comparison
  flakes on font hashes and build dates.
- **Smoke:** one fixture per fenced-div class confirms each `tcolorbox`
  env compiles cleanly.
- **CI:** GitHub Actions installs pandoc + tectonic via apt/brew on
  PR runs and executes goldens.
- No unit tests on `src/render.ts` — there is no logic worth
  unit-testing; everything is shelling out.

## 11. Open questions

1. **Image sidecar resolution edge case.** Pandoc resolves images
   relative to its working directory by default; tectonic resolves
   from search-path. Need to verify the two-search-path setup
   covers all ordering quirks. Validate during initial implementation.
2. **Theme / palette overrides.** Authors outside Waymark's brand
   will want different colors. v2: ship a `theme.latex` the template
   `\input`s with definable color macros and font choices. Out of v1
   scope — v1 ships waymark's slate/gold/teaching-manual aesthetic.
3. **Multi-file batch composition.** Reserved for v1.x. Likely
   approach: a manifest file (`unit.yaml`) listing inputs in order
   and providing a packet-level titlepage; renderer concatenates
   with `\newpage` and emits one PDF.

## 12. Files touched (summary)

- `lesson-press/` — new repo at `~/Projects/lesson-press/`.
- `lesson-press/assets/template.latex` — derived from waymark's
  `resources/pdf/lesson.latex`. Strips Waymark-specific titlepage
  YAML wiring (`$scripture_text$` etc.) into a more general
  frontmatter contract per §4.2.
- `lesson-press/assets/filters/fenced-divs.lua` — copy of waymark's,
  unchanged. Same eleven classes, same answer-paragraph rewriter.
- `lesson-press/src/render.ts`, `lesson-press/bin/lesson-press` —
  new TypeScript CLI.
- `lesson-press/docs/contract.md` — promoted from waymark's
  `docs/waymark-content-contract.md`, scrubbed of Waymark-specific
  examples.

## 13. Success criteria for v1

1. From `~/Vaults/Curriculum Vault/`, an author runs
   `lesson-press render path/to/lesson.md -o lesson.pdf` and gets a
   PDF visually equivalent to waymark's current output.
2. Image sidecars referenced via plain Markdown `![](images/foo.png)`
   render in the PDF without manual copying.
3. CI runs the golden suite on every PR; one fixture per fenced-div
   class compiles cleanly.
4. Waymark's `LessonPdfRenderer`, when repointed at lesson-press's
   asset directory, produces the same PDF as it does today (modulo
   intentional template improvements).
5. The deferred Obsidian plugin, when built, is a < 200-line wrapper
   around the CLI's stdin mode and does no LaTeX or pandoc work
   itself.
