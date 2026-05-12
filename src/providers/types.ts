/**
 * Judge provider interface — agnostic to underlying LLM SDK.
 *
 * The judge takes a question + RAG answer + retrieved context
 * and returns structured scores. Implementations live in
 * ./claude.ts and ./openai.ts.
 */

export interface JudgeInput {
  question: string;
  answer: string;
  retrievedContext: string[];
  expectedAnswer?: string;
}

export interface JudgeOutput {
  faithfulness: number;
  correctness: number;
  rationale: string;
  rawResponse?: unknown;
}

export interface JudgeProvider {
  name: 'claude' | 'openai';
  judge(input: JudgeInput, model: string): Promise<JudgeOutput>;
}

export class JudgeError extends Error {
  constructor(
    message: string,
    public readonly code: 'auth' | 'rate_limit' | 'parse' | 'server' | 'invalid' | 'network',
    public readonly provider: string,
    public readonly cause?: unknown,
  ) {
    super(`[judge:${provider}:${code}] ${message}`);
    this.name = 'JudgeError';
  }
}
