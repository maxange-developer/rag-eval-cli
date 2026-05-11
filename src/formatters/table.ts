import Table from 'cli-table3';
import chalk from 'chalk';
import type { QuestionResult, RunSummary } from '../config/schema.js';

function scoreColor(score: number): (s: string) => string {
  if (score >= 0.8) return chalk.green;
  if (score >= 0.5) return chalk.yellow;
  return chalk.red;
}

export function renderTable(results: QuestionResult[]): string {
  const table = new Table({
    head: [
      chalk.bold('ID'),
      chalk.bold('Question'),
      chalk.bold('Retrieved'),
      chalk.bold('Precision'),
      chalk.bold('Latency'),
      chalk.bold('Status'),
    ],
    colWidths: [12, 40, 10, 12, 10, 30],
    wordWrap: true,
  });

  for (const r of results) {
    if (r.error) {
      table.push([
        r.entry.id,
        r.entry.question.slice(0, 38),
        chalk.gray('—'),
        chalk.gray('—'),
        chalk.gray('—'),
        chalk.red(r.error.slice(0, 28)),
      ]);
      continue;
    }

    const ret = r.retrieval!;
    const found = ret.found ? chalk.green('✓') : chalk.red('✗');
    const precColor = scoreColor(ret.precision);

    table.push([
      r.entry.id,
      r.entry.question.slice(0, 38),
      found,
      precColor(ret.precision.toFixed(2)),
      `${r.response!.latencyMs}ms`,
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
