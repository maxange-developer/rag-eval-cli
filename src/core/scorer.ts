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

export function computeOverallScore(
  retrieval: RetrievalScore | null,
  judge: JudgeResult | null,
  weights: ScoringConfig['weights'],
): number {
  if (!judge || (judge.faithfulness === undefined && judge.correctness === undefined)) {
    return retrieval ? (retrieval.found ? 1 : retrieval.precision) : 0;
  }

  const r = retrieval ? (retrieval.found ? 1 : retrieval.precision) : 0;
  const f = judge.faithfulness ?? 0;
  const c = judge.correctness ?? 0;

  return r * weights.retrieval + f * weights.faithfulness + c * weights.correctness;
}
