import chalk from 'chalk';
import { loadConfig, loadEvalSet, ConfigError } from '../config/loader.js';
import { runEval } from '../core/runner.js';
import { renderTable, renderSummary } from '../formatters/table.js';

export interface RunCommandOptions {
  config: string;
  questions?: string;
  judge?: string;
  output: string;
  threshold: string;
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

    console.log(chalk.gray(`Loaded ${entries.length} questions from ${questionsPath}`));
    console.log(chalk.gray(`Endpoint: ${config.endpoint.url}`));
    console.log('');

    const { results, summary } = await runEval({ config, entries, threshold });

    console.log(renderTable(results));
    console.log(renderSummary(summary, threshold));

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
