import type { EndpointConfig, EvalEntry, EndpointResponse } from '../config/schema.js';

export class EndpointError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'EndpointError';
  }
}

function substitutePlaceholders(template: unknown, entry: EvalEntry): unknown {
  if (typeof template === 'string') {
    return template.replaceAll('{{question}}', entry.question).replaceAll('{{id}}', entry.id);
  }
  if (Array.isArray(template)) {
    return template.map((item) => substitutePlaceholders(item, entry));
  }
  if (template && typeof template === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(template)) {
      out[k] = substitutePlaceholders(v, entry);
    }
    return out;
  }
  return template;
}

function getPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (current === null || current === undefined) return undefined;
    // Matches "key[]" — array spread, remaining path applied to each element
    const arrayMatch = part.match(/^(.+?)\[\]$/);
    if (arrayMatch) {
      const arr = (current as Record<string, unknown>)[arrayMatch[1]];
      if (!Array.isArray(arr)) return undefined;
      const remainingPath = parts.slice(i + 1).join('.');
      if (!remainingPath) return arr;
      return arr.map((item) => getPath(item, remainingPath));
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export async function callEndpoint(
  config: EndpointConfig,
  entry: EvalEntry,
): Promise<EndpointResponse> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  let response: Response;
  try {
    const init: RequestInit = {
      method: config.method,
      headers: config.headers as HeadersInit | undefined,
      signal: controller.signal,
    };
    if (config.method === 'POST' && config.body) {
      const body = substitutePlaceholders(config.body, entry);
      init.body = JSON.stringify(body);
    }
    response = await fetch(config.url, init);
  } catch (e) {
    clearTimeout(timeout);
    if ((e as Error).name === 'AbortError') {
      throw new EndpointError(`Request timed out after ${config.timeoutMs}ms`);
    }
    throw new EndpointError(`Network error: ${(e as Error).message}`);
  }
  clearTimeout(timeout);

  if (!response.ok) {
    throw new EndpointError(
      `Endpoint returned ${response.status}: ${response.statusText}`,
      response.status,
    );
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new EndpointError(`Endpoint response is not valid JSON`);
  }

  const answerRaw = getPath(raw, config.responsePaths.answer);
  const sourcesRaw = getPath(raw, config.responsePaths.sources);

  if (typeof answerRaw !== 'string') {
    throw new EndpointError(
      `Response path "${config.responsePaths.answer}" did not resolve to a string`,
    );
  }

  let sources: string[] = [];
  if (Array.isArray(sourcesRaw)) {
    sources = sourcesRaw.map((s) => String(s));
  } else if (typeof sourcesRaw === 'string') {
    sources = [sourcesRaw];
  } else if (sourcesRaw !== undefined && sourcesRaw !== null) {
    throw new EndpointError(
      `Response path "${config.responsePaths.sources}" did not resolve to array or string`,
    );
  }

  let sourceContents: string[] | undefined;
  if (config.responsePaths.sourceContents) {
    const contentsRaw = getPath(raw, config.responsePaths.sourceContents);
    if (Array.isArray(contentsRaw)) {
      sourceContents = contentsRaw.map((c) => String(c));
    } else if (typeof contentsRaw === 'string') {
      sourceContents = [contentsRaw];
    } else if (contentsRaw !== undefined && contentsRaw !== null) {
      throw new EndpointError(
        `Response path "${config.responsePaths.sourceContents}" did not resolve to array or string`,
      );
    }
  }

  return {
    answer: answerRaw,
    sources,
    sourceContents,
    raw,
    latencyMs: Date.now() - start,
  };
}
