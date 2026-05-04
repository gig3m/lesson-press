import { describe, it } from 'vitest';
import { runGolden, expectGoldenContains } from './helpers/golden.js';

describe('render golden: hello', () => {
  it('renders a minimal lesson and pdftotext finds the expected lines', async () => {
    const { pdfText, expected } = await runGolden('hello');
    expectGoldenContains(pdfText, expected);
  });
});
