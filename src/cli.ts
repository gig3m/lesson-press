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
