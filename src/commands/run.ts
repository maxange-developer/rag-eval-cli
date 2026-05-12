import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { loadConfig, loadEvalSet, ConfigError } from '../config/loader.js';
import { runEval } from '../core/runner.js';
import { renderTable, renderSummary } from '../formatters/table.js';
import { renderCSV } from '../formatters/csv.js';
import { renderJSON } from '../formatters/json.js';

export interface RunCommandOptions {
  config: string;
  questions?: string;
  judge?: string | false;
  output: string;
  threshold: string;
  verbose?: boolean;
}

export async function runCommand(opts: RunCommandOptions): Promise<number> {
  try {
    const config = loadConfig(opts.config);
    const questionsPath = opts.questions ?? 'eval-set.jsonl';
    const entries = loadEvalSet(questionsPath);
    const threshold = parseFloat(opts.threshold);

    if (isNaN(threshold) || threshold < 0 || threshold > 1) {
      console.error(chalk.red(`Invalid threshold: ${opts.threshold} (must be 0-1)`));
      return 2;
    }

    const enableJudge = opts.judge !== false;
    if (enableJudge && typeof opts.judge === 'string' && config.judge) {
      if (opts.judge !== 'claude' && opts.judge !== 'openai') {
        console.error(chalk.red(`Invalid --judge value: "${opts.judge}" (use claude|openai)`));
        return 2;
      }
      config.judge = {
        provider: opts.judge,
        model: opts.judge === 'openai' ? 'gpt-4o-mini' : 'claude-sonnet-4-6',
      };
    }

    console.log(chalk.gray(`Loaded ${entries.length} questions from ${questionsPath}`));
    console.log(chalk.gray(`Endpoint: ${config.endpoint.url}`));
    if (enableJudge && config.judge) {
      console.log(chalk.gray(`Judge: ${config.judge.provider} (${config.judge.model})`));
    } else {
      console.log(chalk.gray('Judge: disabled (retrieval-only)'));
    }
    console.log('');

    const { results, summary } = await runEval({ config, entries, threshold, enableJudge });

    console.log(renderTable(results));
    console.log(renderSummary(summary, threshold));

    if (opts.verbose) {
      console.log('');
      console.log(chalk.bold('Verbose: judge rationales'));
      console.log(chalk.gray('─'.repeat(60)));

      for (const r of results) {
        if (r.error) {
          console.log(`\n${chalk.bold(r.entry.id)} — ${chalk.red('ERROR')}`);
          console.log(chalk.gray(r.error));
          continue;
        }

        console.log(
          `\n${chalk.bold(r.entry.id)} — ${chalk.gray(r.entry.question.slice(0, 60))}`,
        );

        if (r.judge) {
          if (r.judge.faithfulness !== undefined && !isNaN(r.judge.faithfulness)) {
            console.log(`  ${chalk.gray('faith:')} ${r.judge.faithfulness.toFixed(2)}`);
          }
          if (r.judge.correctness !== undefined && !isNaN(r.judge.correctness)) {
            console.log(`  ${chalk.gray('corr: ')} ${r.judge.correctness.toFixed(2)}`);
          }
          console.log(`  ${chalk.gray('rationale:')} ${r.judge.rationale ?? '(none)'}`);
        } else {
          console.log(chalk.gray('  (judge skipped or unavailable)'));
        }
      }
      console.log('');
    }

    try {
      mkdirSync(opts.output, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      const csvPath = join(opts.output, `eval-${timestamp}.csv`);
      writeFileSync(csvPath, renderCSV(results, summary));
      console.log(chalk.gray(`CSV report:  ${csvPath}`));

      const jsonPath = join(opts.output, `eval-${timestamp}.json`);
      writeFileSync(jsonPath, JSON.stringify(renderJSON(results, summary), null, 2));
      console.log(chalk.gray(`JSON report: ${jsonPath}`));
    } catch (e) {
      console.error(chalk.yellow(`Warning: failed to write reports: ${(e as Error).message}`));
    }

    return summary.passed ? 0 : 1;
  } catch (e) {
    if (e instanceof ConfigError) {
      console.error(chalk.red(e.message));
      return 2;
    }
    console.error(chalk.red(`Unexpected error: ${(e as Error).message}`));
    if (process.env['DEBUG']) {
      console.error((e as Error).stack);
    }
    return 3;
  }
}
