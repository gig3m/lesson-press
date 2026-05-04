import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Resolves the bundled assets directory.
 *
 * In dev (running tsx src/cli.ts) the script lives at <repo>/src/cli.ts
 * and assets are at <repo>/assets/. In published form the script lives
 * at <pkg>/dist/cli.js and assets are at <pkg>/assets/. Both reduce to
 * "two levels up from this file, then /assets".
 */
export function defaultAssetDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // dev:  src/assetPaths.ts -> ../assets
  // dist: dist/assetPaths.js -> ../assets
  return path.resolve(here, '..', 'assets');
}

export function validateAssetDir(dir: string): void {
  if (!existsSync(dir)) {
    throw new Error(
      `Asset directory does not exist: ${dir}. ` +
        `Pass --asset-dir to override or rebuild the package.`
    );
  }
  const required = [
    path.join(dir, 'template.latex'),
    path.join(dir, 'filters/fenced-divs.lua'),
  ];
  for (const p of required) {
    if (!existsSync(p)) {
      throw new Error(
        `Asset directory missing required file: ${p}. ` +
          `Pass --asset-dir to override or rebuild the package.`
      );
    }
  }
}
