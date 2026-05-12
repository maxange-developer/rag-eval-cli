import type { QuestionResult, RunSummary } from '../config/schema.js';

function escape(value: string | number | boolean | undefined | null): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') return isNaN(value) ? '' : String(value);
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

export function renderCSV(results: QuestionResult[], summary: RunSummary): string {
  const lines: string[] = [];

  lines.push(
    [
      'id',
      'question',
      'expected_answer',
      'rag_answer',
      'expected_sources',
      'retrieved_sources',
      'retrieval_found',
      'retrieval_precision',
      'faithfulness',
      'correctness',
      'overall_score',
      'judge_rationale',
      'latency_ms',
      'error',
    ]
      .map(escape)
      .join(','),
  );

  for (const r of results) {
    lines.push(
      [
        escape(r.entry.id),
        escape(r.entry.question),
        escape(r.entry.expected_answer),
        escape(r.response?.answer),
        escape(
          Array.isArray(r.entry.expected_source)
            ? r.entry.expected_source.join('|')
            : r.entry.expected_source,
        ),
        escape(r.response?.sources.join('|')),
        escape(r.retrieval ? (r.retrieval.found ? 'true' : 'false') : undefined),
        escape(r.retrieval?.precision),
        escape(r.judge?.faithfulness),
        escape(r.judge?.correctness),
        escape(r.overallScore),
        escape(r.judge?.rationale),
        escape(r.response?.latencyMs),
        escape(r.error ?? undefined),
      ].join(','),
    );
  }

  lines.push('');
  lines.push(
    `# summary,total=${summary.total},successful=${summary.successful},failed=${summary.failed}`,
  );
  lines.push(`# summary,avg_retrieval_precision=${summary.avgRetrievalPrecision.toFixed(4)}`);
  lines.push(
    `# summary,avg_faithfulness=${isNaN(summary.avgFaithfulness) ? 'n/a' : summary.avgFaithfulness.toFixed(4)}`,
  );
  lines.push(
    `# summary,avg_correctness=${isNaN(summary.avgCorrectness) ? 'n/a' : summary.avgCorrectness.toFixed(4)}`,
  );
  lines.push(`# summary,avg_overall_score=${summary.avgOverallScore.toFixed(4)}`);
  lines.push(`# summary,passed=${summary.passed}`);
  lines.push(`# summary,duration_ms=${summary.durationMs}`);

  return lines.join('\n');
}
