import { describe, it } from 'vitest';
import { runGolden, expectGoldenContains } from './helpers/golden.js';

describe('render golden: hello', () => {
  it('renders a minimal lesson and pdftotext finds the expected lines', async () => {
    const { pdfText, expected } = await runGolden('hello');
    expectGoldenContains(pdfText, expected);
  });
});

describe('render golden: all-classes', () => {
  it('renders every fenced-div class without error', async () => {
    const { pdfText, expected } = await runGolden('all-classes');
    expectGoldenContains(pdfText, expected);
  });
});
