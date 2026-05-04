import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

export class BinaryNotFoundError extends Error {
  constructor(name: string) {
    super(
      `Could not locate '${name}' binary. ` +
        `Either install it (e.g. \`brew install ${name}\`), put it on PATH, ` +
        `or pass an absolute path via --${name}.`
    );
    this.name = 'BinaryNotFoundError';
  }
}

const FALLBACKS = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];

function isExecutable(p: string): boolean {
  try {
    if (!existsSync(p)) return false;
    const st = statSync(p);
    return st.isFile() && (st.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

export function resolveBinary(nameOrPath: string): string {
  if (path.isAbsolute(nameOrPath)) {
    if (isExecutable(nameOrPath)) return nameOrPath;
    throw new BinaryNotFoundError(nameOrPath);
  }

  try {
    const out = execFileSync('/usr/bin/env', ['which', nameOrPath], {
      encoding: 'utf8',
    }).trim();
    if (out && isExecutable(out)) return out;
  } catch {
    // fall through to fallbacks
  }

  for (const dir of FALLBACKS) {
    const candidate = path.join(dir, nameOrPath);
    if (isExecutable(candidate)) return candidate;
  }

  throw new BinaryNotFoundError(nameOrPath);
}
