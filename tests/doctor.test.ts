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
