import { spawnSync } from 'node:child_process';
import { resolveBinary, BinaryNotFoundError } from './resolveBinary.js';

export interface ProbeResult {
  found: boolean;
  path?: string;
  version?: string;
  error?: string;
}

export interface DoctorResult {
  ok: boolean;
  pandoc: ProbeResult;
  tectonic: ProbeResult;
}

const REQUIRED_PANDOC = [3, 1] as const;
const REQUIRED_TECTONIC = [0, 15] as const;

function probe(
  nameOrPath: string,
  versionArg: string,
  pattern: RegExp
): ProbeResult {
  let resolved: string;
  try {
    resolved = resolveBinary(nameOrPath);
  } catch (e) {
    if (e instanceof BinaryNotFoundError) {
      return { found: false, error: e.message };
    }
    throw e;
  }
  const r = spawnSync(resolved, [versionArg], { encoding: 'utf8' });
  if (r.status !== 0) {
    return { found: true, path: resolved, error: r.stderr.trim() };
  }
  const m = r.stdout.match(pattern);
  return {
    found: true,
    path: resolved,
    version: m ? m[1] : 'unknown',
  };
}

function meetsMinimum(version: string, [reqMaj, reqMin]: readonly [number, number]): boolean {
  const m = version.match(/^(\d+)\.(\d+)/);
  if (!m) return false;
  const maj = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (maj > reqMaj) return true;
  if (maj < reqMaj) return false;
  return min >= reqMin;
}

export async function runDoctor(opts: {
  pandocBin?: string;
  tectonicBin?: string;
}): Promise<DoctorResult> {
  const pandoc = probe(
    opts.pandocBin ?? 'pandoc',
    '--version',
    /pandoc\s+(\d+\.\d+(?:\.\d+)?)/i
  );
  const tectonic = probe(
    opts.tectonicBin ?? 'tectonic',
    '--version',
    /tectonic\s+(\d+\.\d+(?:\.\d+)?)/i
  );

  let ok = pandoc.found && tectonic.found;
  if (ok && pandoc.version && !meetsMinimum(pandoc.version, REQUIRED_PANDOC)) {
    ok = false;
    pandoc.error = `pandoc ${pandoc.version} is below required ${REQUIRED_PANDOC.join('.')}`;
  }
  if (ok && tectonic.version && !meetsMinimum(tectonic.version, REQUIRED_TECTONIC)) {
    ok = false;
    tectonic.error = `tectonic ${tectonic.version} is below required ${REQUIRED_TECTONIC.join('.')}`;
  }

  return { ok, pandoc, tectonic };
}
