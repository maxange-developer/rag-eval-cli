import type { JudgeConfig } from '../config/schema.js';
import type { JudgeProvider, JudgeInput, JudgeOutput } from '../providers/types.js';

export async function getJudgeProvider(config: JudgeConfig): Promise<JudgeProvider> {
  if (config.provider === 'claude') {
    const { claudeJudge } = await import('../providers/claude.js');
    return claudeJudge;
  }
  if (config.provider === 'openai') {
    const { openaiJudge } = await import('../providers/openai.js');
    return openaiJudge;
  }
  throw new Error(`Unknown judge provider: ${String(config.provider)}`);
}

export async function runJudge(
  input: JudgeInput,
  config: JudgeConfig,
): Promise<JudgeOutput> {
  const provider = await getJudgeProvider(config);
  return provider.judge(input, config.model);
}
