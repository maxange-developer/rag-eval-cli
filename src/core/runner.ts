import ora from 'ora';
import { callEndpoint, EndpointError } from '../adapters/endpoint.js';
import { scoreRetrieval, computeOverallScore } from './scorer.js';
import { runJudge } from './judge.js';
import type {
  Config,
  EvalEntry,
  JudgeResult,
  QuestionResult,
  RunSummary,
} from '../config/schema.js';

export interface RunOptions {
  config: Config;
  entries: EvalEntry[];
  threshold: number;
  enableJudge: boolean;
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

      let judge: JudgeResult | null = null;
      if (opts.enableJudge && opts.config.judge) {
        spinner.text = `[${i + 1}/${opts.entries.length}] ${entry.id} — judging...`;
        try {
          const k = opts.config.scoring.retrievalK;
          const retrievedContext =
            response.sourceContents && response.sourceContents.length > 0
              ? response.sourceContents.slice(0, k)
              : response.sources.slice(0, k);
          const judgeOut = await runJudge(
            {
              question: entry.question,
              answer: response.answer,
              retrievedContext,
              expectedAnswer: entry.expected_answer,
            },
            opts.config.judge,
          );
          judge = {
            faithfulness: judgeOut.faithfulness,
            correctness: judgeOut.correctness,
            rationale: judgeOut.rationale,
          };
        } catch (e) {
          judge = {
            faithfulness: NaN,
            correctness: NaN,
            rationale: `Judge error: ${(e as Error).message}`,
          };
        }
      }

      const overallScore = computeOverallScore(retrieval, judge, opts.config.scoring.weights);

      result = {
        entry,
        response,
        error: null,
        retrieval,
        judge,
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

  const faithScores = results
    .map((r) => r.judge?.faithfulness)
    .filter((n): n is number => typeof n === 'number' && !isNaN(n));
  const corrScores = results
    .map((r) => r.judge?.correctness)
    .filter((n): n is number => typeof n === 'number' && !isNaN(n));
  const avgFaithfulness =
    faithScores.length > 0 ? faithScores.reduce((s, n) => s + n, 0) / faithScores.length : NaN;
  const avgCorrectness =
    corrScores.length > 0 ? corrScores.reduce((s, n) => s + n, 0) / corrScores.length : NaN;

  const avgOverallScore =
    results.reduce((s, r) => s + r.overallScore, 0) / results.length;

  const summary: RunSummary = {
    total: results.length,
    successful,
    failed,
    avgRetrievalPrecision,
    avgFaithfulness,
    avgCorrectness,
    avgOverallScore,
    passed: avgOverallScore >= opts.threshold,
    durationMs: Date.now() - startTime,
  };

  return { results, summary };
}
