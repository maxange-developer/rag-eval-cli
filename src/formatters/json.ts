import type { QuestionResult, RunSummary } from '../config/schema.js';

export interface JSONReport {
  summary: {
    total: number;
    successful: number;
    failed: number;
    avgRetrievalPrecision: number;
    avgFaithfulness: number | null;
    avgCorrectness: number | null;
    avgOverallScore: number;
    passed: boolean;
    durationMs: number;
    timestamp: string;
  };
  results: Array<{
    id: string;
    question: string;
    expectedAnswer: string | undefined;
    ragAnswer: string | null;
    expectedSources: string[];
    retrievedSources: string[] | null;
    retrieval: { found: boolean; precision: number } | null;
    judge: { faithfulness: number | null; correctness: number | null; rationale: string } | null;
    overallScore: number;
    latencyMs: number | null;
    error: string | null;
  }>;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function numOrNull(v: number | undefined, formatter?: (n: number) => number): number | null {
  if (v === undefined) return null;
  if (isNaN(v)) return null;
  return formatter ? formatter(v) : v;
}

export function renderJSON(results: QuestionResult[], summary: RunSummary): JSONReport {
  return {
    summary: {
      total: summary.total,
      successful: summary.successful,
      failed: summary.failed,
      avgRetrievalPrecision: round4(summary.avgRetrievalPrecision),
      avgFaithfulness: numOrNull(summary.avgFaithfulness, round4),
      avgCorrectness: numOrNull(summary.avgCorrectness, round4),
      avgOverallScore: round4(summary.avgOverallScore),
      passed: summary.passed,
      durationMs: summary.durationMs,
      timestamp: new Date().toISOString(),
    },
    results: results.map((r) => ({
      id: r.entry.id,
      question: r.entry.question,
      expectedAnswer: r.entry.expected_answer,
      ragAnswer: r.response?.answer ?? null,
      expectedSources: Array.isArray(r.entry.expected_source)
        ? r.entry.expected_source
        : [r.entry.expected_source],
      retrievedSources: r.response?.sources ?? null,
      retrieval: r.retrieval
        ? { found: r.retrieval.found, precision: round4(r.retrieval.precision) }
        : null,
      judge: r.judge
        ? {
            faithfulness: numOrNull(r.judge.faithfulness, round4),
            correctness: numOrNull(r.judge.correctness, round4),
            rationale: r.judge.rationale ?? '',
          }
        : null,
      overallScore: round4(r.overallScore),
      latencyMs: r.response?.latencyMs ?? null,
      error: r.error,
    })),
  };
}
