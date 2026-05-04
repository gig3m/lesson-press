import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveBinary } from './resolveBinary.js';
import { parseFrontmatter, normalizeAuthor } from './frontmatter.js';
import { defaultAssetDir, validateAssetDir } from './assetPaths.js';

export interface RenderOptions {
  inputPath: string;            // absolute path or '-' for stdin
  outputPath: string;
  assetDir?: string;
  pandocBin?: string;
  tectonicBin?: string;
  keepTmp?: boolean;
  verbose?: boolean;
  /** When inputPath === '-', stdinContent must be provided. */
  stdinContent?: string;
}

export async function render(opts: RenderOptions): Promise<void> {
  const assetDir = opts.assetDir ?? defaultAssetDir();
  validateAssetDir(assetDir);

  const pandoc = resolveBinary(opts.pandocBin ?? 'pandoc');
  const tectonic = resolveBinary(opts.tectonicBin ?? 'tectonic');

  // Resolve source: either read from disk or use stdinContent.
  const isStdin = opts.inputPath === '-';
  if (isStdin && opts.stdinContent === undefined) {
    throw new Error('inputPath="-" requires stdinContent to be provided');
  }
  const source = isStdin
    ? (opts.stdinContent as string)
    : readFileSync(opts.inputPath, 'utf8');

  // Compute author fallback. Pandoc's --metadata overrides YAML.
  // Collapse whitespace so YAML block scalars (`>` / `|`) can't smuggle
  // newlines into the argv-level --metadata key=value.
  const { data } = parseFrontmatter(source);
  const author = normalizeAuthor(data)?.replace(/\s+/g, ' ').trim();

  // Image search path: input file's directory (or cwd for stdin).
  const inputDir = isStdin ? process.cwd() : path.dirname(path.resolve(opts.inputPath));

  const workDir = mkdtempSync(path.join(tmpdir(), 'lesson-press-'));
  const workInput = path.join(workDir, 'input.md');
  const workOutput = path.join(workDir, 'out.pdf');

  try {
    // Write source into workdir so pandoc has a stable cwd-relative path.
    if (isStdin) {
      writeFileSync(workInput, source, 'utf8');
    } else {
      copyFileSync(opts.inputPath, workInput);
    }

    const args = [
      '--from', 'markdown',
      '--template', path.join(assetDir, 'template.latex'),
      '--lua-filter', path.join(assetDir, 'filters/fenced-divs.lua'),
      '--pdf-engine', tectonic,
      '--pdf-engine-opt=-Z',
      `--pdf-engine-opt=search-path=${workDir}`,
      `--pdf-engine-opt=search-path=${inputDir}`,
      '-o', workOutput,
      workInput,
    ];
    if (author !== undefined) {
      args.push('--metadata', `author=${author}`);
    }

    if (opts.verbose) {
      // Print to stderr so stdout stays clean for piped use cases.
      process.stderr.write(`pandoc ${args.map(a => JSON.stringify(a)).join(' ')}\n`);
    }

    const r = spawnSync(pandoc, args, { encoding: 'utf8' });
    if (r.status !== 0) {
      throw new Error(
        `pandoc/tectonic failed (exit ${r.status}):\n${r.stderr}`
      );
    }

    mkdirSync(path.dirname(path.resolve(opts.outputPath)), { recursive: true });
    copyFileSync(workOutput, opts.outputPath);
  } finally {
    if (!opts.keepTmp) {
      rmSync(workDir, { recursive: true, force: true });
    }
  }
}
