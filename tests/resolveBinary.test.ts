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
