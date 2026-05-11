import ora from 'ora';
import { callEndpoint, EndpointError } from '../adapters/endpoint.js';
import { scoreRetrieval, computeOverallScore } from './scorer.js';
import type { Config, EvalEntry, QuestionResult, RunSummary } from '../config/schema.js';

export interface RunOptions {
  config: Config;
  entries: EvalEntry[];
  threshold: number;
}

export async function runEval(opts: RunOptions): Promise<{
  results: QuestionResult[];
  summary: RunSummary;
}> {
  const startTime = Date.now();
  const results: QuestionResult[] = [];

  const spinner = ora({ text: 'Starting evaluation...', spinner: 'dots' }).start();

  for (let i = 0; i < opts.entries.length; i++) {
    const entry = opts.entries[i];
    spinner.text = `[${i + 1}/${opts.entries.length}] ${entry.id} — ${entry.question.slice(0, 50)}...`;

    let result: QuestionResult;
    try {
      const response = await callEndpoint(opts.config.endpoint, entry);
      const retrieval = scoreRetrieval(entry, response, opts.config.scoring.retrievalK);
      const overallScore = computeOverallScore(retrieval, null, opts.config.scoring.weights);

      result = {
        entry,
        response,
        error: null,
        retrieval,
        judge: null,
        overallScore,
      };
    } catch (e) {
      const message =
        e instanceof EndpointError
          ? e.message
          : `Unexpected error: ${(e as Error).message}`;
      result = {
        entry,
        response: null,
        error: message,
        retrieval: null,
        judge: null,
        overallScore: 0,
      };
    }

    results.push(result);
  }

  spinner.stop();

  const successful = results.filter((r) => r.error === null).length;
  const failed = results.length - successful;
  const successResults = results.filter((r) => r.retrieval !== null);
  const avgRetrievalPrecision =
    successResults.length > 0
      ? successResults.reduce((s, r) => s + r.retrieval!.precision, 0) /
        successResults.length
      : 0;
  const avgOverallScore =
    results.reduce((s, r) => s + r.overallScore, 0) / results.length;

  const summary: RunSummary = {
    total: results.length,
    successful,
    failed,
    avgRetrievalPrecision,
    avgOverallScore,
    passed: avgOverallScore >= opts.threshold,
    durationMs: Date.now() - startTime,
  };

  return { results, summary };
}
