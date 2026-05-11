import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigSchema, EvalEntrySchema, type Config, type EvalEntry } from './schema.js';

export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly source: string,
  ) {
    super(`[config:${source}] ${message}`);
    this.name = 'ConfigError';
  }
}

export function loadConfig(path: string): Config {
  const absPath = resolve(process.cwd(), path);
  let raw: string;
  try {
    raw = readFileSync(absPath, 'utf-8');
  } catch {
    throw new ConfigError(`Could not read config file: ${absPath}`, 'load');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new ConfigError(
      `Config is not valid JSON: ${(e as Error).message}`,
      'parse',
    );
  }

  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new ConfigError(`Config validation failed:\n${issues}`, 'validate');
  }

  return result.data;
}

export function loadEvalSet(path: string): EvalEntry[] {
  const absPath = resolve(process.cwd(), path);
  let raw: string;
  try {
    raw = readFileSync(absPath, 'utf-8');
  } catch {
    throw new ConfigError(`Could not read eval-set: ${absPath}`, 'load-evalset');
  }

  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    throw new ConfigError(`Eval-set is empty: ${absPath}`, 'evalset-empty');
  }

  const entries: EvalEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(lines[i]);
    } catch (e) {
      throw new ConfigError(
        `Line ${i + 1} is not valid JSON: ${(e as Error).message}`,
        'evalset-parse',
      );
    }
    const result = EvalEntrySchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
        .join(', ');
      throw new ConfigError(`Line ${i + 1} invalid: ${issues}`, 'evalset-validate');
    }
    entries.push(result.data);
  }

  return entries;
}
