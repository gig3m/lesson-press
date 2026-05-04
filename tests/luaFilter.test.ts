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
