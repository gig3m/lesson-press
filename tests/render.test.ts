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

describe('render golden: image-sidecar', () => {
  it('resolves images relative to the input file', async () => {
    const { pdfText, expected } = await runGolden('image-sidecar');
    expectGoldenContains(pdfText, expected);
  });
});

describe('render golden: wide-table', () => {
  it('renders a 4-column table without crashing on pandoc calc syntax', async () => {
    const { pdfText, expected } = await runGolden('wide-table');
    expectGoldenContains(pdfText, expected);
  });
});

describe('render golden: cover-video', () => {
  it('surfaces optional_video title and short_url on the cover', async () => {
    const { pdfText, expected } = await runGolden('cover-video');
    expectGoldenContains(pdfText, expected);
  });
});
