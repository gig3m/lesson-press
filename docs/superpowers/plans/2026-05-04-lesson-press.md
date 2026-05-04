# Lesson Press v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship lesson-press v1 — a TypeScript CLI that renders fenced-div Markdown to print-quality PDF via Pandoc + tectonic, with a Lua filter and a LaTeX template lifted from waymark's working pipeline.

**Architecture:** Thin Node CLI (commander + gray-matter) shells out to `pandoc --pdf-engine=tectonic` with bundled asset paths (Lua filter + LaTeX template). Authoring contract = one `.md` file with YAML frontmatter; one `.md` → one PDF. No JS-side AST manipulation — all rendering decisions live in the assets.

**Tech Stack:** TypeScript 5.x · Node ≥ 20 (ESM) · Vitest · commander · gray-matter · tsc (no bundler in v1) · GitHub Actions CI · external: pandoc ≥ 3.1, tectonic ≥ 0.15

**Spec:** `docs/superpowers/specs/2026-05-04-lesson-press-design.md`

**Worktree note:** This plan executes in `~/Projects/lesson-press/` directly — the repo is brand new (created during brainstorming, with `git init` and the spec already committed at `8265ab1`). No worktree needed because the project is itself isolated.

**Prerequisites for the engineer:**
- `pandoc --version` ≥ 3.1 reachable on PATH
- `tectonic --version` ≥ 0.15 reachable on PATH
- `pdftotext --version` (poppler) reachable on PATH (used by golden tests)
- Node ≥ 20

If any are missing, install via Homebrew: `brew install pandoc tectonic poppler`.

**Reference files in waymark (read-only — do not modify):**
- `~/herd/waymark/resources/pdf/lesson.latex` (LaTeX template, 278 lines)
- `~/herd/waymark/resources/pdf/filters/fenced-divs.lua` (Lua filter, 69 lines)
- `~/herd/waymark/app/Services/LessonPdfRenderer.php` (binary resolution pattern)

---

### Task 1: Initialize Node project skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `README.md`
- Create: `src/.gitkeep`, `tests/.gitkeep`, `assets/filters/.gitkeep`, `bin/.gitkeep`, `docs/examples/.gitkeep`, `tests/golden/.gitkeep`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "lesson-press",
  "version": "0.1.0-dev",
  "description": "Render Pandoc-fenced-div Markdown lessons to print-quality PDF.",
  "type": "module",
  "bin": {
    "lesson-press": "dist/cli.js"
  },
  "files": ["dist/", "assets/"],
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "gray-matter": "^4.0.3"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
  },
});
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
*.tsbuildinfo
.DS_Store

# golden test artifacts
tests/golden/**/actual.pdf
tests/golden/**/actual.txt
tests/tmp/
```

- [ ] **Step 5: Create `README.md`**

```markdown
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
```

- [ ] **Step 6: Create empty placeholder files for empty dirs**

```bash
touch src/.gitkeep tests/.gitkeep assets/filters/.gitkeep bin/.gitkeep docs/examples/.gitkeep tests/golden/.gitkeep
```

- [ ] **Step 7: Install dependencies**

```bash
cd ~/Projects/lesson-press
npm install
```

Expected: creates `node_modules/` and `package-lock.json` without errors.

- [ ] **Step 8: Verify TypeScript and Vitest are wired**

```bash
npm run typecheck
npm test
```

Expected: typecheck passes (no source files yet, so it's a no-op); vitest reports "No test files found" and exits 0 (or 1 — that's fine for now).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore README.md src/.gitkeep tests/.gitkeep assets/filters/.gitkeep bin/.gitkeep docs/examples/.gitkeep tests/golden/.gitkeep
git commit -m "chore: initialize Node project skeleton"
```

---

### Task 2: Implement `resolveBinary` helper with tests

Locates `pandoc` and `tectonic` binaries the same way waymark does — explicit override → PATH → Homebrew/system fallback chain.

**Files:**
- Create: `src/resolveBinary.ts`
- Create: `tests/resolveBinary.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/resolveBinary.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveBinary, BinaryNotFoundError } from '../src/resolveBinary.js';
import { existsSync } from 'node:fs';

describe('resolveBinary', () => {
  it('returns absolute path as-is if it exists and is executable', () => {
    // /bin/sh is on every POSIX system
    expect(resolveBinary('/bin/sh')).toBe('/bin/sh');
  });

  it('finds pandoc on PATH (prerequisite for the rest of the suite)', () => {
    const p = resolveBinary('pandoc');
    expect(p).toMatch(/pandoc$/);
    expect(existsSync(p)).toBe(true);
  });

  it('throws BinaryNotFoundError with actionable message for unknown bin', () => {
    expect(() => resolveBinary('definitely-not-a-real-binary-xyz')).toThrow(
      BinaryNotFoundError
    );
  });

  it('error message includes the missing binary name and search guidance', () => {
    try {
      resolveBinary('definitely-not-a-real-binary-xyz');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain('definitely-not-a-real-binary-xyz');
      expect(msg).toMatch(/install|PATH/i);
    }
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npm test -- resolveBinary
```

Expected: FAIL — `Cannot find module '../src/resolveBinary.js'`.

- [ ] **Step 3: Implement `resolveBinary`**

`src/resolveBinary.ts`:

```ts
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

export class BinaryNotFoundError extends Error {
  constructor(name: string) {
    super(
      `Could not locate '${name}' binary. ` +
        `Either install it (e.g. \`brew install ${name}\`), put it on PATH, ` +
        `or pass an absolute path via --${name}.`
    );
    this.name = 'BinaryNotFoundError';
  }
}

const FALLBACKS = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];

function isExecutable(p: string): boolean {
  try {
    if (!existsSync(p)) return false;
    const st = statSync(p);
    return st.isFile() && (st.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

export function resolveBinary(nameOrPath: string): string {
  if (path.isAbsolute(nameOrPath)) {
    if (isExecutable(nameOrPath)) return nameOrPath;
    throw new BinaryNotFoundError(nameOrPath);
  }

  try {
    const out = execFileSync('/usr/bin/env', ['which', nameOrPath], {
      encoding: 'utf8',
    }).trim();
    if (out && isExecutable(out)) return out;
  } catch {
    // fall through to fallbacks
  }

  for (const dir of FALLBACKS) {
    const candidate = path.join(dir, nameOrPath);
    if (isExecutable(candidate)) return candidate;
  }

  throw new BinaryNotFoundError(nameOrPath);
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
npm test -- resolveBinary
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/resolveBinary.ts tests/resolveBinary.test.ts
git commit -m "feat: add resolveBinary helper for pandoc/tectonic discovery"
```

---

### Task 3: Implement frontmatter normalization with tests

Parses YAML frontmatter and computes the `author` fallback (`<unit> · <curriculum>`) per spec §4.2.

**Files:**
- Create: `src/frontmatter.ts`
- Create: `tests/frontmatter.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/frontmatter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseFrontmatter, normalizeAuthor } from '../src/frontmatter.js';

describe('parseFrontmatter', () => {
  it('extracts YAML frontmatter and body from markdown source', () => {
    const src = `---\ntitle: Hello\nweek: 1\n---\n\nbody text\n`;
    const { data, content } = parseFrontmatter(src);
    expect(data.title).toBe('Hello');
    expect(data.week).toBe(1);
    expect(content.trim()).toBe('body text');
  });

  it('returns empty data when no frontmatter is present', () => {
    const { data, content } = parseFrontmatter('just body\n');
    expect(data).toEqual({});
    expect(content).toBe('just body\n');
  });
});

describe('normalizeAuthor', () => {
  it('preserves explicit author when set', () => {
    expect(normalizeAuthor({ author: 'Jane Doe', unit: 'A', curriculum: 'B' }))
      .toBe('Jane Doe');
  });

  it('joins unit and curriculum with " · " when both present and author missing', () => {
    expect(normalizeAuthor({ unit: 'Genesis', curriculum: 'High School' }))
      .toBe('Genesis · High School');
  });

  it('uses unit alone when only unit set', () => {
    expect(normalizeAuthor({ unit: 'Genesis' })).toBe('Genesis');
  });

  it('uses curriculum alone when only curriculum set', () => {
    expect(normalizeAuthor({ curriculum: 'High School' })).toBe('High School');
  });

  it('returns undefined when no author/unit/curriculum present', () => {
    expect(normalizeAuthor({ title: 'x' })).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npm test -- frontmatter
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `frontmatter.ts`**

`src/frontmatter.ts`:

```ts
import matter from 'gray-matter';

export type Frontmatter = Record<string, unknown>;

export function parseFrontmatter(source: string): {
  data: Frontmatter;
  content: string;
} {
  const parsed = matter(source);
  return { data: parsed.data, content: parsed.content };
}

export function normalizeAuthor(data: Frontmatter): string | undefined {
  if (typeof data.author === 'string' && data.author.trim() !== '') {
    return data.author;
  }
  const unit = typeof data.unit === 'string' ? data.unit : undefined;
  const curriculum =
    typeof data.curriculum === 'string' ? data.curriculum : undefined;

  if (unit && curriculum) return `${unit} · ${curriculum}`;
  if (unit) return unit;
  if (curriculum) return curriculum;
  return undefined;
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
npm test -- frontmatter
```

Expected: 7 tests pass (2 + 5).

- [ ] **Step 5: Commit**

```bash
git add src/frontmatter.ts tests/frontmatter.test.ts
git commit -m "feat: add frontmatter parsing and author normalization"
```

---

### Task 4: Lift Lua filter from waymark + filter unit tests

Copies `fenced-divs.lua` from waymark verbatim and verifies it transforms each of the eleven classes correctly via `pandoc -t latex`.

**Files:**
- Create: `assets/filters/fenced-divs.lua`
- Create: `tests/luaFilter.test.ts`

- [ ] **Step 1: Copy filter from waymark**

```bash
cp ~/herd/waymark/resources/pdf/filters/fenced-divs.lua assets/filters/fenced-divs.lua
```

Verify: `wc -l assets/filters/fenced-divs.lua` should print `69`.

- [ ] **Step 2: Write the failing test**

`tests/luaFilter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILTER = path.join(ROOT, 'assets/filters/fenced-divs.lua');

function runFilter(markdown: string): string {
  const r = spawnSync(
    'pandoc',
    ['-f', 'markdown', '-t', 'latex', '--lua-filter', FILTER],
    { input: markdown, encoding: 'utf8' }
  );
  if (r.status !== 0) {
    throw new Error(`pandoc failed: ${r.stderr}`);
  }
  return r.stdout;
}

describe('fenced-divs.lua', () => {
  const cases: Array<[string, string]> = [
    ['read', 'readpill'],
    ['scripture', 'scripturebox'],
    ['say', 'saybox'],
    ['ask', 'askbox'],
    ['prayer', 'prayerbox'],
    ['discussion', 'discussionbox'],
    ['question', 'questionbox'],
    ['key-truth', 'keytruthbox'],
    ['note', 'notebox'],
    ['transition', 'transitionbox'],
    ['materials', 'materialsbox'],
  ];

  for (const [cls, env] of cases) {
    it(`wraps :::${cls} in ${env}`, () => {
      const out = runFilter(`:::${cls}\nhi\n:::\n`);
      expect(out).toContain(`\\begin{${env}}`);
      expect(out).toContain(`\\end{${env}}`);
    });
  }

  it('passes unknown classes through untouched', () => {
    const out = runFilter(`:::unknown-class\nhi\n:::\n`);
    expect(out).not.toContain('\\begin{unknown-class}');
    expect(out).toContain('hi');
  });

  it('rewrites italic-only paragraph in :::discussion OL item to \\answerparagraph', () => {
    const md =
      ':::discussion\n1. What is X?\n\n   *An answer.*\n\n:::\n';
    const out = runFilter(md);
    expect(out).toContain('\\answerparagraph{');
  });
});
```

- [ ] **Step 3: Run tests, verify they pass**

```bash
npm test -- luaFilter
```

Expected: 13 tests pass (11 class mappings + 1 unknown + 1 answer-paragraph). If any class fails, the lua filter copy is incomplete — re-run Step 1.

- [ ] **Step 4: Commit**

```bash
git add assets/filters/fenced-divs.lua tests/luaFilter.test.ts
git commit -m "feat: lift Lua filter from waymark + add per-class tests"
```

---

### Task 5: Lift LaTeX template from waymark

Copies `lesson.latex` from waymark verbatim. Identifies waymark-specific elements to revisit; defers slimming to Task 7 (after we have an end-to-end test to validate against).

**Files:**
- Create: `assets/template.latex`

- [ ] **Step 1: Copy template from waymark**

```bash
cp ~/herd/waymark/resources/pdf/lesson.latex assets/template.latex
```

Verify: `wc -l assets/template.latex` should print `278`.

- [ ] **Step 2: Inventory waymark-specific elements (read-only audit)**

Open `assets/template.latex` and skim. Note (do NOT edit yet) which lines reference:
- waymark-specific colors (e.g. `wmslate`, `wmgold` — these are fine as branded defaults; document later).
- `Scripture · $scripture_text$`, `Memory · $memory_verse$`, `$big_idea$` titlepage labels — fine, match our contract.

No edits in this task — we keep waymark's working template as the baseline. Slimming, if any, comes after the end-to-end test in Task 7 reveals what (if anything) is broken.

- [ ] **Step 3: Commit**

```bash
git add assets/template.latex
git commit -m "feat: lift LaTeX template from waymark verbatim"
```

---

### Task 6: Implement `render()` core

A single function that runs the full pandoc + tectonic pipeline against an input file path. CLI surface comes in Task 8; this task is testable in isolation via direct function call.

**Files:**
- Create: `src/assetPaths.ts`
- Create: `src/render.ts`

- [ ] **Step 1: Implement asset path resolution**

`src/assetPaths.ts`:

```ts
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Resolves the bundled assets directory.
 *
 * In dev (running tsx src/cli.ts) the script lives at <repo>/src/cli.ts
 * and assets are at <repo>/assets/. In published form the script lives
 * at <pkg>/dist/cli.js and assets are at <pkg>/assets/. Both reduce to
 * "two levels up from this file, then /assets".
 */
export function defaultAssetDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // Walk up until we find a sibling `assets/template.latex`.
  // dev:  src/assetPaths.ts -> ../assets
  // dist: dist/assetPaths.js -> ../assets
  return path.resolve(here, '..', 'assets');
}

export function validateAssetDir(dir: string): void {
  const required = [
    path.join(dir, 'template.latex'),
    path.join(dir, 'filters/fenced-divs.lua'),
  ];
  for (const p of required) {
    if (!existsSync(p)) {
      throw new Error(
        `Asset directory missing required file: ${p}. ` +
          `Pass --asset-dir to override or rebuild the package.`
      );
    }
  }
}
```

- [ ] **Step 2: Implement `render()`**

`src/render.ts`:

```ts
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveBinary } from './resolveBinary.js';
import { parseFrontmatter, normalizeAuthor } from './frontmatter.js';
import { defaultAssetDir, validateAssetDir } from './assetPaths.js';

export interface RenderOptions {
  inputPath: string;            // absolute path or '-' for stdin
  outputPath: string;
  assetDir?: string;
  pandocBin?: string;
  tectonicBin?: string;
  keepTmp?: boolean;
  verbose?: boolean;
  /** When inputPath === '-', stdinContent must be provided. */
  stdinContent?: string;
}

export async function render(opts: RenderOptions): Promise<void> {
  const assetDir = opts.assetDir ?? defaultAssetDir();
  validateAssetDir(assetDir);

  const pandoc = resolveBinary(opts.pandocBin ?? 'pandoc');
  const tectonic = resolveBinary(opts.tectonicBin ?? 'tectonic');

  // Resolve source: either read from disk or use stdinContent.
  const isStdin = opts.inputPath === '-';
  if (isStdin && opts.stdinContent === undefined) {
    throw new Error('inputPath="-" requires stdinContent to be provided');
  }
  const source = isStdin
    ? (opts.stdinContent as string)
    : readFileSync(opts.inputPath, 'utf8');

  // Compute author fallback. Pandoc's --metadata overrides YAML.
  const { data } = parseFrontmatter(source);
  const author = normalizeAuthor(data);

  // Image search path: input file's directory (or cwd for stdin).
  const inputDir = isStdin ? process.cwd() : path.dirname(path.resolve(opts.inputPath));

  const workDir = mkdtempSync(path.join(tmpdir(), 'lesson-press-'));
  const workInput = path.join(workDir, 'input.md');
  const workOutput = path.join(workDir, 'out.pdf');

  try {
    // Write source into workdir so pandoc has a stable cwd-relative path.
    if (isStdin) {
      writeFileSync(workInput, source, 'utf8');
    } else {
      copyFileSync(opts.inputPath, workInput);
    }

    const args = [
      '--from', 'markdown',
      '--template', path.join(assetDir, 'template.latex'),
      '--lua-filter', path.join(assetDir, 'filters/fenced-divs.lua'),
      '--pdf-engine', tectonic,
      '--pdf-engine-opt=-Z',
      `--pdf-engine-opt=search-path=${workDir}`,
      `--pdf-engine-opt=search-path=${inputDir}`,
      '-o', workOutput,
      workInput,
    ];
    if (author !== undefined) {
      args.push('--metadata', `author=${author}`);
    }

    if (opts.verbose) {
      // Print to stderr so stdout stays clean for piped use cases.
      process.stderr.write(`pandoc ${args.map(a => JSON.stringify(a)).join(' ')}\n`);
    }

    const r = spawnSync(pandoc, args, { encoding: 'utf8' });
    if (r.status !== 0) {
      throw new Error(
        `pandoc/tectonic failed (exit ${r.status}):\n${r.stderr}`
      );
    }

    copyFileSync(workOutput, opts.outputPath);
  } finally {
    if (!opts.keepTmp) {
      rmSync(workDir, { recursive: true, force: true });
    }
  }
}
```

- [ ] **Step 3: Build to verify TypeScript compiles**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/assetPaths.ts src/render.ts
git commit -m "feat: implement render() core (pandoc + tectonic pipeline)"
```

---

### Task 7: First end-to-end golden test (smoke)

Renders a minimal lesson with no fenced divs, asserts the PDF generates and `pdftotext` extracts the title and body text. This is the first real proof the pipeline works end-to-end.

**Files:**
- Create: `tests/golden/hello/input.md`
- Create: `tests/golden/hello/expected.txt`
- Create: `tests/render.test.ts`
- Create: `tests/helpers/golden.ts`

- [ ] **Step 1: Write the fixture**

`tests/golden/hello/input.md`:

```markdown
---
title: "Hello, World"
subtitle: "A smoke-test lesson"
unit: "Test Unit"
curriculum: "Test Curriculum"
---

This is the body of the lesson.

It has a paragraph and *some emphasis*.

## A Subheading

And a closing paragraph.
```

`tests/golden/hello/expected.txt`:

```
Hello, World
A smoke-test lesson
This is the body of the lesson.
It has a paragraph and some emphasis.
A Subheading
And a closing paragraph.
```

- [ ] **Step 2: Implement the golden helper**

`tests/helpers/golden.ts`:

```ts
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '../../src/render.js';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);

export interface GoldenResult {
  pdfText: string;
  expected: string;
}

export async function runGolden(name: string): Promise<GoldenResult> {
  const dir = path.join(ROOT, 'tests/golden', name);
  const input = path.join(dir, 'input.md');
  const expectedPath = path.join(dir, 'expected.txt');
  const tmp = mkdtempSync(path.join(tmpdir(), `golden-${name}-`));
  const pdf = path.join(tmp, 'out.pdf');

  try {
    await render({ inputPath: input, outputPath: pdf });
    const r = spawnSync('pdftotext', [pdf, '-'], { encoding: 'utf8' });
    if (r.status !== 0) {
      throw new Error(`pdftotext failed: ${r.stderr}`);
    }
    return {
      pdfText: r.stdout,
      expected: readFileSync(expectedPath, 'utf8'),
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Asserts every non-empty line of `expected` appears somewhere in `pdfText`.
 * Whitespace-tolerant; order-independent within a single line.
 *
 * pdftotext output ordering depends on PDF layout, so we don't do strict
 * sequence matching — substring presence per expected line is enough.
 */
export function expectGoldenContains(pdfText: string, expected: string): void {
  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
  const haystack = normalize(pdfText);
  const lines = expected
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  for (const line of lines) {
    const needle = normalize(line);
    if (!haystack.includes(needle)) {
      throw new Error(
        `Golden mismatch: expected line not found in PDF text:\n` +
          `  expected: ${needle}\n` +
          `  pdftotext: ${haystack.slice(0, 200)}…`
      );
    }
  }
}
```

- [ ] **Step 3: Write the test**

`tests/render.test.ts`:

```ts
import { describe, it } from 'vitest';
import { runGolden, expectGoldenContains } from './helpers/golden.js';

describe('render golden: hello', () => {
  it('renders a minimal lesson and pdftotext finds the expected lines', async () => {
    const { pdfText, expected } = await runGolden('hello');
    expectGoldenContains(pdfText, expected);
  });
});
```

- [ ] **Step 4: Run the test**

```bash
npm test -- render
```

Expected: PASS. If FAIL: read the error message. Most likely culprits — (a) pandoc/tectonic not on PATH (run `lesson-press doctor` once Task 9 is done; for now, check `which pandoc tectonic pdftotext`), (b) the lifted template references something we haven't accounted for. If template is the issue, capture the pandoc stderr from the error and adjust `assets/template.latex` minimally to fix.

- [ ] **Step 5: Commit**

```bash
git add tests/golden/hello/input.md tests/golden/hello/expected.txt tests/helpers/golden.ts tests/render.test.ts
git commit -m "test: add hello golden — minimal end-to-end render"
```

---

### Task 8: All-eleven-classes golden test

Validates every fenced-div class compiles cleanly through the real pipeline.

**Files:**
- Create: `tests/golden/all-classes/input.md`
- Create: `tests/golden/all-classes/expected.txt`
- Modify: `tests/render.test.ts`

- [ ] **Step 1: Write the fixture**

`tests/golden/all-classes/input.md`:

```markdown
---
title: "All Classes"
subtitle: "Smoke test for every block"
unit: "Test"
curriculum: "Suite"
scripture_text: "Genesis 1:1"
big_idea: "Test every block."
memory_verse: "John 1:1"
---

:::read
Genesis 1:1
:::

:::scripture
John 1:1

In the beginning was the Word.
:::

:::say
Welcome to class.
:::

:::ask
What do you remember from last week?
:::

:::prayer
Lord, open our hearts.
:::

:::discussion
1. What is creation?

   *Everything God made.*

2. Why does it matter?
:::

:::question
What stands out to you?
:::

:::key-truth
God is the source of life.
:::

:::note
Use a globe if available.
:::

:::transition
Now turn to your neighbor.
:::

:::materials
- Bibles
- Globe
- Markers
:::
```

`tests/golden/all-classes/expected.txt`:

```
All Classes
Smoke test for every block
Genesis 1:1
In the beginning was the Word.
Welcome to class.
What do you remember from last week?
Lord, open our hearts.
What is creation?
Everything God made.
Why does it matter?
What stands out to you?
God is the source of life.
Use a globe if available.
Now turn to your neighbor.
Bibles
Globe
Markers
```

- [ ] **Step 2: Add the test case**

Append to `tests/render.test.ts`:

```ts
describe('render golden: all-classes', () => {
  it('renders every fenced-div class without error', async () => {
    const { pdfText, expected } = await runGolden('all-classes');
    expectGoldenContains(pdfText, expected);
  });
});
```

- [ ] **Step 3: Run the test**

```bash
npm test -- render
```

Expected: PASS for both `hello` and `all-classes`. If FAIL on a specific class, the LaTeX env for that class is the issue — inspect the pandoc stderr and adjust `assets/template.latex`.

- [ ] **Step 4: Commit**

```bash
git add tests/golden/all-classes/ tests/render.test.ts
git commit -m "test: add all-classes golden — every fenced div compiles"
```

---

### Task 9: Image sidecar golden test

Validates `![](images/foo.png)` resolves relative to the input file.

**Files:**
- Create: `tests/golden/image-sidecar/input.md`
- Create: `tests/golden/image-sidecar/expected.txt`
- Create: `tests/golden/image-sidecar/images/test.png` (1x1 transparent PNG)
- Modify: `tests/render.test.ts`

- [ ] **Step 1: Create the test PNG (1x1 transparent)**

```bash
# This 70-byte transparent PNG is widely used as a test fixture.
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xfc\xcf\xc0P\x0f\x00\x04\x85\x01\x80\x84\xa6\xa6\x83\x00\x00\x00\x00IEND\xaeB`\x82' > tests/golden/image-sidecar/images/test.png
```

Verify: `file tests/golden/image-sidecar/images/test.png` reports `PNG image data, 1 x 1`.

- [ ] **Step 2: Write the fixture**

`tests/golden/image-sidecar/input.md`:

```markdown
---
title: "Image Sidecar"
unit: "Test"
curriculum: "Suite"
---

Body before image.

![Transparent test image](images/test.png)

Body after image.
```

`tests/golden/image-sidecar/expected.txt`:

```
Image Sidecar
Body before image.
Body after image.
```

(`pdftotext` does not extract image alt text reliably; we just confirm the PDF compiled with surrounding text intact.)

- [ ] **Step 3: Add the test case**

Append to `tests/render.test.ts`:

```ts
describe('render golden: image-sidecar', () => {
  it('resolves images relative to the input file', async () => {
    const { pdfText, expected } = await runGolden('image-sidecar');
    expectGoldenContains(pdfText, expected);
  });
});
```

- [ ] **Step 4: Run the test**

```bash
npm test -- render
```

Expected: PASS on all three goldens. If image resolution fails, inspect pandoc stderr — likely fix is in the `--pdf-engine-opt=search-path=...` arguments in `src/render.ts`.

- [ ] **Step 5: Commit**

```bash
git add tests/golden/image-sidecar/ tests/render.test.ts
git commit -m "test: add image-sidecar golden — relative image resolution"
```

---

### Task 10: CLI `render` subcommand from file path

Wires `bin/lesson-press` to `src/cli.ts`; implements `render <input.md> -o <output.pdf>` for the file-input case.

**Files:**
- Create: `src/cli.ts`
- Create: `bin/lesson-press`
- Modify: `package.json` (add postbuild step to make bin executable)
- Create: `tests/cli.test.ts`

- [ ] **Step 1: Implement `cli.ts`**

`src/cli.ts`:

```ts
#!/usr/bin/env node
import { Command } from 'commander';
import path from 'node:path';
import { render } from './render.js';

const program = new Command();

program
  .name('lesson-press')
  .description('Render Pandoc-fenced-div Markdown lessons to PDF')
  .version('0.1.0-dev');

program
  .command('render')
  .description('Render one or more lesson Markdown files to PDF')
  .argument('<inputs...>', 'input .md path(s), or "-" for stdin')
  .requiredOption('-o, --output <path>', 'output PDF path (or directory with --separate)')
  .option('--asset-dir <path>', 'override bundled asset directory')
  .option('--pandoc <bin>', 'override pandoc binary')
  .option('--tectonic <bin>', 'override tectonic binary')
  .option('--keep-tmp', 'keep intermediate work directory for debugging')
  .option('--separate', 'render each input to its own PDF in <output> dir')
  .option('--verbose', 'show pandoc invocation')
  .action(async (inputs: string[], opts) => {
    if (!opts.separate && inputs.length > 1) {
      throw new Error(
        'Multiple inputs require --separate (single-PDF composition is v1.x).'
      );
    }
    if (opts.separate) {
      throw new Error('--separate is implemented in a later task');
    }

    const input = inputs[0];
    const inputPath = input === '-' ? '-' : path.resolve(input);
    const outputPath = path.resolve(opts.output);

    let stdinContent: string | undefined;
    if (input === '-') {
      stdinContent = await readStdin();
    }

    await render({
      inputPath,
      outputPath,
      assetDir: opts.assetDir,
      pandocBin: opts.pandoc,
      tectonicBin: opts.tectonic,
      keepTmp: opts.keepTmp,
      verbose: opts.verbose,
      stdinContent,
    });
  });

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

program.parseAsync().catch((err: Error) => {
  process.stderr.write(`error: ${err.message}\n`);
  process.exit(err.message.includes('pandoc/tectonic') ? 2 : 1);
});
```

- [ ] **Step 2: Create the bin shim**

`bin/lesson-press`:

```bash
#!/usr/bin/env node
import('../dist/cli.js');
```

Then make it executable:

```bash
chmod +x bin/lesson-press
```

Note: the `bin` field in `package.json` already points at `dist/cli.js`, so installed/linked usage runs `dist/cli.js` directly via its own shebang. The `bin/lesson-press` file is a fallback / dev convenience for callers that prefer `node bin/lesson-press` style invocation.

- [ ] **Step 3: Build and link**

```bash
npm run build
npm link
```

Expected: `lesson-press --version` prints `0.1.0-dev`.

- [ ] **Step 4: Smoke-test the CLI manually**

```bash
lesson-press render tests/golden/hello/input.md -o /tmp/hello.pdf
ls -la /tmp/hello.pdf
```

Expected: `/tmp/hello.pdf` exists, > 0 bytes. Open it (`open /tmp/hello.pdf` on macOS) to eyeball.

- [ ] **Step 5: Write CLI integration test**

`tests/cli.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'dist/cli.js');

describe('lesson-press CLI', () => {
  it('renders a file to PDF and exits 0', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'cli-test-'));
    const out = path.join(tmp, 'out.pdf');
    try {
      const r = spawnSync(
        process.execPath,
        [CLI, 'render', path.join(ROOT, 'tests/golden/hello/input.md'), '-o', out],
        { encoding: 'utf8' }
      );
      expect(r.status).toBe(0);
      expect(existsSync(out)).toBe(true);
      expect(statSync(out).size).toBeGreaterThan(1000);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('exits 1 with multiple inputs and no --separate', () => {
    const r = spawnSync(
      process.execPath,
      [
        CLI,
        'render',
        path.join(ROOT, 'tests/golden/hello/input.md'),
        path.join(ROOT, 'tests/golden/hello/input.md'),
        '-o',
        '/tmp/x.pdf',
      ],
      { encoding: 'utf8' }
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/--separate/);
  });
});
```

- [ ] **Step 6: Update package.json so `npm test` builds first**

Edit `package.json` `scripts.test`:

```json
"test": "npm run build && vitest run",
"test:watch": "vitest",
```

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: all golden + filter + frontmatter + resolveBinary + CLI tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/cli.ts bin/lesson-press tests/cli.test.ts package.json
git commit -m "feat: implement CLI render subcommand for file inputs"
```

---

### Task 11: CLI stdin input mode

`lesson-press render - -o foo.pdf` reads from stdin.

**Files:**
- Modify: `tests/cli.test.ts` (add stdin case)

The `cli.ts` already handles `-` from Task 10 — we just need a test to lock it in.

- [ ] **Step 1: Add stdin test case**

Append to `tests/cli.test.ts`:

```ts
describe('lesson-press CLI stdin', () => {
  it('reads markdown from stdin when input is "-"', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'cli-stdin-'));
    const out = path.join(tmp, 'out.pdf');
    const md = `---\ntitle: "Stdin Test"\nunit: "U"\ncurriculum: "C"\n---\n\nFrom stdin.\n`;
    try {
      const r = spawnSync(
        process.execPath,
        [CLI, 'render', '-', '-o', out],
        { input: md, encoding: 'utf8' }
      );
      expect(r.status).toBe(0);
      expect(existsSync(out)).toBe(true);

      const txt = spawnSync('pdftotext', [out, '-'], { encoding: 'utf8' });
      expect(txt.stdout).toContain('Stdin Test');
      expect(txt.stdout).toContain('From stdin');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test -- cli
```

Expected: stdin test passes alongside the file-input tests.

- [ ] **Step 3: Commit**

```bash
git add tests/cli.test.ts
git commit -m "test: lock in CLI stdin input mode"
```

---

### Task 12: CLI `--separate` batch mode

Renders N input files to N PDFs in a target directory.

**Files:**
- Modify: `src/cli.ts`
- Modify: `tests/cli.test.ts`

- [ ] **Step 1: Add a failing test**

Append to `tests/cli.test.ts`:

```ts
describe('lesson-press CLI --separate', () => {
  it('renders multiple inputs to separate PDFs in a directory', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'cli-sep-'));
    try {
      const r = spawnSync(
        process.execPath,
        [
          CLI,
          'render',
          path.join(ROOT, 'tests/golden/hello/input.md'),
          path.join(ROOT, 'tests/golden/all-classes/input.md'),
          '--separate',
          '-o',
          tmp,
        ],
        { encoding: 'utf8' }
      );
      expect(r.status).toBe(0);
      expect(existsSync(path.join(tmp, 'input.pdf'))).toBe(true);
      // basenames collide ("input.md" appears twice); CLI must
      // disambiguate by parent dir name → "hello.pdf" / "all-classes.pdf"
      expect(existsSync(path.join(tmp, 'hello.pdf'))).toBe(true);
      expect(existsSync(path.join(tmp, 'all-classes.pdf'))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
```

The "collision → use parent dir" rule means we should derive the output filename from the parent dir when basenames are not unique within a single batch. For v1, simpler rule: always use the parent dir name when the basename is `input.md`, otherwise the basename (without extension). The test reflects that.

- [ ] **Step 2: Run test, verify it fails**

```bash
npm run build && npm test -- cli
```

Expected: `--separate is implemented in a later task` error.

- [ ] **Step 3: Implement `--separate` in `cli.ts`**

Replace the `if (opts.separate) { throw … }` branch (and the surrounding logic) with:

```ts
if (opts.separate) {
  const outDir = path.resolve(opts.output);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  } else if (!statSync(outDir).isDirectory()) {
    throw new Error(`--separate output ${outDir} must be a directory`);
  }

  for (const input of inputs) {
    if (input === '-') {
      throw new Error('--separate does not support stdin input');
    }
    const inputPath = path.resolve(input);
    const base = path.basename(inputPath, path.extname(inputPath));
    const stem = base === 'input'
      ? path.basename(path.dirname(inputPath))
      : base;
    const outputPath = path.join(outDir, `${stem}.pdf`);

    await render({
      inputPath,
      outputPath,
      assetDir: opts.assetDir,
      pandocBin: opts.pandoc,
      tectonicBin: opts.tectonic,
      keepTmp: opts.keepTmp,
      verbose: opts.verbose,
    });
  }
  return;
}
```

Add the new imports at the top of `src/cli.ts`:

```ts
import { existsSync, mkdirSync, statSync } from 'node:fs';
```

- [ ] **Step 4: Build and run tests**

```bash
npm test -- cli
```

Expected: `--separate` test passes alongside earlier CLI tests.

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts tests/cli.test.ts
git commit -m "feat: implement CLI --separate batch mode"
```

---

### Task 13: CLI `doctor` subcommand

Probes pandoc and tectonic versions; gives an actionable error if they're missing or below the required version.

**Files:**
- Modify: `src/cli.ts`
- Create: `src/doctor.ts`
- Create: `tests/doctor.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/doctor.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { runDoctor } from '../src/doctor.js';

describe('doctor', () => {
  it('reports pandoc and tectonic versions when both present', async () => {
    const r = await runDoctor({});
    expect(r.ok).toBe(true);
    expect(r.pandoc.found).toBe(true);
    expect(r.pandoc.version).toMatch(/^\d+\.\d+/);
    expect(r.tectonic.found).toBe(true);
    expect(r.tectonic.version).toMatch(/^\d+\.\d+/);
  });

  it('reports a tool as missing with actionable message', async () => {
    const r = await runDoctor({ pandocBin: 'definitely-not-pandoc-xyz' });
    expect(r.ok).toBe(false);
    expect(r.pandoc.found).toBe(false);
    expect(r.pandoc.error).toMatch(/install|PATH/i);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npm test -- doctor
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `doctor.ts`**

`src/doctor.ts`:

```ts
import { spawnSync } from 'node:child_process';
import { resolveBinary, BinaryNotFoundError } from './resolveBinary.js';

export interface ProbeResult {
  found: boolean;
  path?: string;
  version?: string;
  error?: string;
}

export interface DoctorResult {
  ok: boolean;
  pandoc: ProbeResult;
  tectonic: ProbeResult;
}

const REQUIRED_PANDOC = [3, 1] as const;
const REQUIRED_TECTONIC = [0, 15] as const;

function probe(
  nameOrPath: string,
  versionArg: string,
  pattern: RegExp
): ProbeResult {
  let resolved: string;
  try {
    resolved = resolveBinary(nameOrPath);
  } catch (e) {
    if (e instanceof BinaryNotFoundError) {
      return { found: false, error: e.message };
    }
    throw e;
  }
  const r = spawnSync(resolved, [versionArg], { encoding: 'utf8' });
  if (r.status !== 0) {
    return { found: true, path: resolved, error: r.stderr.trim() };
  }
  const m = r.stdout.match(pattern);
  return {
    found: true,
    path: resolved,
    version: m ? m[1] : 'unknown',
  };
}

function meetsMinimum(version: string, [reqMaj, reqMin]: readonly [number, number]): boolean {
  const m = version.match(/^(\d+)\.(\d+)/);
  if (!m) return false;
  const maj = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (maj > reqMaj) return true;
  if (maj < reqMaj) return false;
  return min >= reqMin;
}

export async function runDoctor(opts: {
  pandocBin?: string;
  tectonicBin?: string;
}): Promise<DoctorResult> {
  const pandoc = probe(
    opts.pandocBin ?? 'pandoc',
    '--version',
    /pandoc\s+(\d+\.\d+(?:\.\d+)?)/
  );
  const tectonic = probe(
    opts.tectonicBin ?? 'tectonic',
    '--version',
    /tectonic\s+(\d+\.\d+(?:\.\d+)?)/
  );

  let ok = pandoc.found && tectonic.found;
  if (ok && pandoc.version && !meetsMinimum(pandoc.version, REQUIRED_PANDOC)) {
    ok = false;
    pandoc.error = `pandoc ${pandoc.version} is below required ${REQUIRED_PANDOC.join('.')}`;
  }
  if (ok && tectonic.version && !meetsMinimum(tectonic.version, REQUIRED_TECTONIC)) {
    ok = false;
    tectonic.error = `tectonic ${tectonic.version} is below required ${REQUIRED_TECTONIC.join('.')}`;
  }

  return { ok, pandoc, tectonic };
}
```

- [ ] **Step 4: Run unit tests, verify they pass**

```bash
npm test -- doctor
```

Expected: 2 tests pass.

- [ ] **Step 5: Wire `doctor` into the CLI**

Add to `src/cli.ts` (above `program.parseAsync()`):

```ts
program
  .command('doctor')
  .description('Check that pandoc and tectonic are present and up to date')
  .option('--pandoc <bin>', 'override pandoc binary')
  .option('--tectonic <bin>', 'override tectonic binary')
  .action(async (opts) => {
    const { runDoctor } = await import('./doctor.js');
    const r = await runDoctor({ pandocBin: opts.pandoc, tectonicBin: opts.tectonic });
    process.stdout.write(`pandoc:   ${formatProbe(r.pandoc)}\n`);
    process.stdout.write(`tectonic: ${formatProbe(r.tectonic)}\n`);
    if (!r.ok) {
      process.exit(2);
    }
  });

function formatProbe(p: { found: boolean; path?: string; version?: string; error?: string }): string {
  if (!p.found) return `MISSING (${p.error})`;
  if (p.error) return `${p.path} (error: ${p.error})`;
  return `${p.path} v${p.version}`;
}
```

- [ ] **Step 6: Build and smoke-test**

```bash
npm run build
lesson-press doctor
```

Expected: prints something like:

```
pandoc:   /opt/homebrew/bin/pandoc v3.1.x
tectonic: /opt/homebrew/bin/tectonic v0.15.x
```

- [ ] **Step 7: Commit**

```bash
git add src/cli.ts src/doctor.ts tests/doctor.test.ts
git commit -m "feat: add doctor subcommand for toolchain version probes"
```

---

### Task 14: Write contract doc and worked example

User-facing reference for the input contract. Also satisfies success criterion §13.4 (worked example exists in the repo).

**Files:**
- Create: `docs/contract.md`
- Create: `docs/examples/lesson-1.md`

- [ ] **Step 1: Write `docs/contract.md`**

Content (full file — copy verbatim):

```markdown
# Lesson Press — Input Contract

This document is the canonical reference for what `lesson-press` accepts
as input. The renderer assumes inputs follow this contract exactly.

## File shape

- One `.md` file = one PDF.
- Files start with a YAML frontmatter block (`---` fenced).
- The body is standard CommonMark plus Pandoc fenced divs.
- One markdown file per lesson; image sidecars in adjacent files.

## Frontmatter keys

| Key | Type | Required | Behavior |
|---|---|---|---|
| `title` | string | yes | Titlepage title; running header |
| `subtitle` | string | no | Below title on titlepage |
| `author` | string | no | Defaults to `<unit> · <curriculum>` if both set |
| `week` | int | no | Decorative; rendered on titlepage |
| `unit` | string | no | |
| `curriculum` | string | no | |
| `scripture_text` | string | no | Titlepage block under gold rule |
| `big_idea` | string | no | Titlepage block |
| `memory_verse` | string | no | Titlepage block |
| `toc` | bool | no | Show TOC after titlepage; default `false` |
| `titlepage` | bool | no | Emit titlepage at all; default `true` |

Unknown keys are silently ignored. Missing optional metadata never errors.

## Block vocabulary

Eleven fenced-div classes, each rendered as a styled callout.

| Class | Purpose |
|---|---|
| `:::read` | Scripture reference pill |
| `:::scripture` | Passage block (reference + optional text) |
| `:::say` | Teacher script (spoken) |
| `:::ask` | Teacher question to the class |
| `:::prayer` | Prayer script |
| `:::discussion` | Group of numbered discussion questions |
| `:::question` | Single standalone question |
| `:::key-truth` | Lesson's central takeaway |
| `:::note` | Teacher aside |
| `:::transition` | Pedagogical bridge |
| `:::materials` | Supplies / materials checklist |

### Discussion answers

Inside `:::discussion`, an italic-only paragraph as the last child of an
ordered-list item renders as the anticipated answer:

```markdown
:::discussion
1. What is X?

   *An expected answer.*

2. Why does it matter?
:::
```

### Unknown classes

Fenced divs with classes outside this vocabulary pass through untouched
— Pandoc emits the inner content with no callout decoration. This makes
vocabulary expansion safe (additive in future versions).

## Image sidecars

Reference images with plain Markdown, relative to the input file:

```markdown
![A diagram](images/seven-days.png)
```

Supported formats: PNG, JPEG, PDF (vector). SVG requires Inkscape on
host (not a default dependency). Obsidian's `![[wikilink-image.png]]`
syntax is **not** supported in v1.

## Worked example

See [`docs/examples/lesson-1.md`](examples/lesson-1.md) for a complete
lesson exercising the full contract.
```

- [ ] **Step 2: Write `docs/examples/lesson-1.md`**

```markdown
---
title: "The Beginning of Everything"
subtitle: "Sunday Plan"
week: 1
unit: "Genesis"
curriculum: "High School"
scripture_text: "Genesis 1–2"
big_idea: "God is the source of life, order, and meaning."
memory_verse: "Genesis 2:8–9"
toc: false
---

## Opening

:::say
Welcome back, everyone. Last week we talked about why we read the
Bible at all. Today we're going to start at the very beginning.
:::

:::read
Genesis 1:1–5
:::

:::scripture
Genesis 1:1–2

In the beginning, God created the heavens and the earth. The earth
was without form and void, and darkness was over the face of the
deep. And the Spirit of God was hovering over the face of the waters.
:::

## Teaching Points

:::key-truth
Creation is God's first self-revelation. Before words, before law,
before prophecy — God shows us who he is by what he makes.
:::

:::note
If students are unfamiliar with Genesis, briefly orient them: this is
the first book of the Bible, attributed to Moses, structured as
narrative.
:::

## Discussion

:::discussion
1. What would a world that is "formless and void" actually be like?

   *A world without shape, purpose, or light — primordial chaos.*

2. What does God's Spirit hovering tell you about God's character?

   *God is intentional, active, and prepared to bring order.*
:::

:::transition
Now that we've seen what creation begins as, let's see what God does
with it.
:::

## Closing

:::prayer
Father, thank you for being a God of order and life. Help us see your
creativity in the world around us this week.
:::

:::materials
- Bibles
- Whiteboard
- Markers
:::
```

- [ ] **Step 3: Smoke-test the example renders cleanly**

```bash
lesson-press render docs/examples/lesson-1.md -o /tmp/lesson-1.pdf && open /tmp/lesson-1.pdf
```

Expected: PDF opens. Eyeball: titlepage looks right; all fenced divs are styled.

- [ ] **Step 4: Commit**

```bash
git add docs/contract.md docs/examples/lesson-1.md
git commit -m "docs: add input contract and worked example"
```

---

### Task 15: GitHub Actions CI

Runs goldens on every PR. Requires pandoc + tectonic + poppler to be installable on `ubuntu-latest`.

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install pandoc + tectonic + poppler
        run: |
          sudo apt-get update
          sudo apt-get install -y pandoc poppler-utils
          # tectonic is not in apt; use the official install script
          curl --proto '=https' --tlsv1.2 -fsSL https://drop-sh.fullyjustified.net | sh
          sudo mv tectonic /usr/local/bin/

      - name: Verify toolchain
        run: |
          pandoc --version | head -1
          tectonic --version
          pdftotext -v

      - run: npm ci
      - run: npm run typecheck
      - run: npm test
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run typecheck and goldens on push and PR"
```

(CI will run once the repo is pushed to GitHub. Pushing the repo is a
separate step the user controls; this plan does not push.)

---

### Task 16: README polish and v0.1.0 tag

**Files:**
- Modify: `README.md`
- Modify: `package.json` (bump version to `0.1.0`)

- [ ] **Step 1: Replace `README.md` with the full version**

```markdown
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
worked example exercising every block class.

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
```

- [ ] **Step 2: Bump version**

Edit `package.json`:

```json
"version": "0.1.0",
```

Also bump the version string in `src/cli.ts`:

```ts
.version('0.1.0');
```

- [ ] **Step 3: Final test sweep**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit and tag**

```bash
git add README.md package.json src/cli.ts
git commit -m "chore: release v0.1.0"
git tag v0.1.0
```

(Pushing the tag is a separate step the user controls; this plan does
not push to a remote.)

---

## Self-review checklist (run before handing off)

- ✅ **Spec coverage:** Each spec section maps to a task.
  - §1 Purpose → covered by overall plan
  - §2 Non-goals → respected (no multi-format, no HTTP service, no
    multi-file composition in v1)
  - §3 Architecture → Tasks 1–6 produce the directory layout
  - §4 Input contract (frontmatter + classes + images) → Tasks 3, 4, 9, 14
  - §5 CLI surface → Tasks 10, 11, 12, 13
  - §6 Renderer internals → Task 6
  - §7 Asset resolution → Task 6 (`assetPaths.ts`)
  - §8 Waymark migration → out of scope (deferred per spec)
  - §9 Obsidian plugin → out of scope (deferred per spec)
  - §10 Testing → Tasks 4, 7, 8, 9, 10–13, 15
  - §11 Open questions → image-sidecar question validated by Task 9
  - §12 Files touched → matches plan output
  - §13 Success criteria → criteria 1, 2, 3 hit by Tasks 7–9, 14, 15;
    criterion 4 is deferred (Waymark migration); criterion 5 is
    deferred (Obsidian plugin)

- ✅ **Type consistency:**
  - `RenderOptions` fields used in cli.ts Task 10 match Task 6
  - `runDoctor()` return type used in cli.ts Task 13 matches Task 13
    definition
  - `parseFrontmatter()` / `normalizeAuthor()` used in render.ts Task
    6 match Task 3 definitions
  - `resolveBinary()` / `BinaryNotFoundError` used across Tasks 6 and
    13 match Task 2

- ✅ **No placeholders:** every step has actual code or actual commands.
