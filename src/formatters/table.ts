import Table from 'cli-table3';
import chalk from 'chalk';
import type { QuestionResult, RunSummary } from '../config/schema.js';

function scoreColor(score: number): (s: string) => string {
  if (score >= 0.8) return chalk.green;
  if (score >= 0.5) return chalk.yellow;
  return chalk.red;
}

function fmtScore(s: number | undefined): string {
  if (s === undefined || isNaN(s)) return chalk.gray('—');
  return scoreColor(s)(s.toFixed(2));
}

export function renderTable(results: QuestionResult[]): string {
  const table = new Table({
    head: [
      chalk.bold('ID'),
      chalk.bold('Question'),
      chalk.bold('Retr'),
      chalk.bold('Faith'),
      chalk.bold('Corr'),
      chalk.bold('Score'),
      chalk.bold('Status'),
    ],
    colWidths: [10, 32, 8, 8, 8, 8, 20],
    wordWrap: true,
  });

  for (const r of results) {
    if (r.error) {
      table.push([
        r.entry.id,
        r.entry.question.slice(0, 30),
        chalk.gray('—'),
        chalk.gray('—'),
        chalk.gray('—'),
        chalk.gray('—'),
        chalk.red(r.error.slice(0, 18)),
      ]);
      continue;
    }

    const ret = r.retrieval!;
    const j = r.judge;

    table.push([
      r.entry.id,
      r.entry.question.slice(0, 30),
      ret.found ? chalk.green('✓') : chalk.red('✗'),
      fmtScore(j?.faithfulness),
      fmtScore(j?.correctness),
      scoreColor(r.overallScore)(r.overallScore.toFixed(2)),
      chalk.green('ok'),
    ]);
  }

  return table.toString();
}

export function renderSummary(summary: RunSummary, threshold: number): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.bold('Summary'));
  lines.push(chalk.gray('─'.repeat(60)));
  lines.push(`Total questions:         ${summary.total}`);
  lines.push(`Successful:              ${chalk.green(String(summary.successful))}`);
  if (summary.failed > 0) {
    lines.push(`Failed:                  ${chalk.red(String(summary.failed))}`);
  }
  lines.push(
    `Avg retrieval precision: ${scoreColor(summary.avgRetrievalPrecision)(summary.avgRetrievalPrecision.toFixed(3))}`,
  );
  lines.push(`Avg faithfulness:        ${fmtScore(summary.avgFaithfulness)}`);
  lines.push(`Avg correctness:         ${fmtScore(summary.avgCorrectness)}`);
  lines.push(
    `Avg overall score:       ${scoreColor(summary.avgOverallScore)(summary.avgOverallScore.toFixed(3))}`,
  );
  lines.push(`Threshold:               ${threshold.toFixed(2)}`);
  lines.push(`Duration:                ${(summary.durationMs / 1000).toFixed(1)}s`);
  lines.push(chalk.gray('─'.repeat(60)));
  lines.push(
    summary.passed
      ? chalk.green.bold('✓ PASSED')
      : chalk.red.bold('✗ FAILED — below threshold'),
  );
  lines.push('');
  return lines.join('\n');
}
