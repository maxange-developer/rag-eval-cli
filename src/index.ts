import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
) as { version: string };

const program = new Command();

program
  .name('rag-eval')
  .description('Evaluate RAG pipelines: retrieval, faithfulness, correctness.')
  .version(pkg.version);

program
  .command('run')
  .description('Run evaluation against a RAG endpoint')
  .option('-c, --config <path>', 'config file path', 'rag-eval.config.json')
  .option('-q, --questions <path>', 'eval-set JSONL file')
  .option('-j, --judge <provider>', 'judge LLM provider: claude|openai', 'claude')
  .option('-o, --output <dir>', 'output directory for reports', './rag-eval-output')
  .option('--threshold <number>', 'min score to exit 0 (0-1)', '0.7')
  .action(async (opts) => {
    const { runCommand } = await import('./commands/run.js');
    const code = await runCommand(opts as Parameters<typeof runCommand>[0]);
    process.exit(code);
  });

program.parse();
