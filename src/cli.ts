#!/usr/bin/env node
import { Command } from 'commander';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { render, PipelineError } from './render.js';

interface RenderOpts {
  output: string;
  assetDir?: string;
  pandoc?: string;
  tectonic?: string;
  keepTmp?: boolean;
  separate?: boolean;
  verbose?: boolean;
}

export function buildProgram(): Command {
  const program = new Command();

  program
    .name('lesson-press')
    .description('Render Pandoc-fenced-div Markdown lessons to PDF')
    .version('0.1.0-dev')
    .exitOverride();

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
    .action(async (inputs: string[], opts: RenderOpts) => {
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

  return program;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function main(argv: string[]): Promise<number> {
  const program = buildProgram();
  try {
    await program.parseAsync(argv);
    return 0;
  } catch (err) {
    if (err instanceof PipelineError) {
      process.stderr.write(`error: ${err.message}\n`);
      return 2;
    }
    // commander's exitOverride throws with `code` and `exitCode` props on
    // help/version. Treat its successful-exit codes as 0.
    const e = err as { code?: string; exitCode?: number; message?: string };
    if (e.code?.startsWith('commander.help') || e.code === 'commander.version') {
      return 0;
    }
    process.stderr.write(`error: ${e.message ?? String(err)}\n`);
    return typeof e.exitCode === 'number' ? e.exitCode : 1;
  }
}

// Only auto-run when invoked as the entry script (not when imported by tests).
const isEntry =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(fileURLToPath(import.meta.url)).href &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntry) {
  main(process.argv).then((code) => {
    process.exitCode = code;
  });
}
