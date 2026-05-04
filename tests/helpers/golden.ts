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

export async function runGolden(
  name: string,
  opts: { keepTmp?: boolean } = {}
): Promise<GoldenResult> {
  const dir = path.join(ROOT, 'tests/golden', name);
  const input = path.join(dir, 'input.md');
  const expectedPath = path.join(dir, 'expected.txt');
  const tmp = mkdtempSync(path.join(tmpdir(), `golden-${name}-`));
  const pdf = path.join(tmp, 'out.pdf');

  try {
    await render({ inputPath: input, outputPath: pdf, keepTmp: opts.keepTmp });
    const r = spawnSync('pdftotext', [pdf, '-'], { encoding: 'utf8' });
    if (r.error && (r.error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `pdftotext not found on PATH. Install poppler (e.g. \`brew install poppler\`).`
      );
    }
    if (r.status !== 0) {
      throw new Error(`pdftotext failed: ${r.stderr}`);
    }
    return {
      pdfText: r.stdout,
      expected: readFileSync(expectedPath, 'utf8'),
    };
  } finally {
    if (!opts.keepTmp) {
      rmSync(tmp, { recursive: true, force: true });
    } else {
      process.stderr.write(`[golden ${name}] kept tmp dir: ${tmp}\n`);
    }
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
