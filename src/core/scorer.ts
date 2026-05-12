import type {
  EvalEntry,
  EndpointResponse,
  RetrievalScore,
  ScoringConfig,
  JudgeResult,
} from '../config/schema.js';

export function scoreRetrieval(
  entry: EvalEntry,
  response: EndpointResponse,
  k: number,
): RetrievalScore {
  const expected = Array.isArray(entry.expected_source)
    ? entry.expected_source
    : [entry.expected_source];

  const topK = response.sources.slice(0, k);

  let hits = 0;
  for (const src of topK) {
    if (expected.includes(src)) hits++;
  }
  const precision = topK.length > 0 ? hits / topK.length : 0;
  const found = expected.some((e) => topK.includes(e));

  return {
    precision,
    found,
    topKSources: topK,
    expectedSources: expected,
  };
}

function isValidScore(n: number | undefined): n is number {
  return typeof n === 'number' && !isNaN(n);
}

export function computeOverallScore(
  retrieval: RetrievalScore | null,
  judge: JudgeResult | null,
  weights: ScoringConfig['weights'],
): number {
  const r = retrieval ? (retrieval.found ? 1 : retrieval.precision) : 0;

  if (!judge) return r;

  const hasFaith = isValidScore(judge.faithfulness);
  const hasCorr = isValidScore(judge.correctness);

  if (!hasFaith && !hasCorr) return r;

  // Re-normalize weights to skip NaN dimensions
  let totalWeight = weights.retrieval;
  let weightedSum = r * weights.retrieval;

  if (hasFaith) {
    weightedSum += (judge.faithfulness as number) * weights.faithfulness;
    totalWeight += weights.faithfulness;
  }
  if (hasCorr) {
    weightedSum += (judge.correctness as number) * weights.correctness;
    totalWeight += weights.correctness;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : r;
}
