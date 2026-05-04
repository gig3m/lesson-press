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
