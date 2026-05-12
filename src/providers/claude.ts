import Anthropic from '@anthropic-ai/sdk';
import { JUDGE_SYSTEM_PROMPT, buildJudgeUserPrompt } from './prompts.js';
import { JudgeOutputJSONSchema } from '../config/schema.js';
import {
  type JudgeProvider,
  type JudgeInput,
  type JudgeOutput,
  JudgeError,
} from './types.js';

function getClient(): Anthropic {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    throw new JudgeError(
      'ANTHROPIC_API_KEY not set in environment',
      'auth',
      'claude',
    );
  }
  return new Anthropic({ apiKey });
}

function mapError(e: unknown): JudgeError {
  if (e instanceof JudgeError) return e;
  const err = e as { status?: number; message?: string };
  if (err.status === 401 || err.status === 403) {
    return new JudgeError('Authentication failed', 'auth', 'claude', e);
  }
  if (err.status === 429) {
    return new JudgeError('Rate limit exceeded', 'rate_limit', 'claude', e);
  }
  if (err.status && err.status >= 500) {
    return new JudgeError('Provider server error', 'server', 'claude', e);
  }
  if (err.status && err.status >= 400) {
    return new JudgeError(err.message ?? 'Invalid request', 'invalid', 'claude', e);
  }
  return new JudgeError(err.message ?? 'Network error', 'network', 'claude', e);
}

function extractJSON(text: string): unknown {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

export const claudeJudge: JudgeProvider = {
  name: 'claude',

  async judge(input: JudgeInput, model: string): Promise<JudgeOutput> {
    const client = getClient();
    const userPrompt = buildJudgeUserPrompt(input);

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model,
        max_tokens: 600,
        temperature: 0,
        system: JUDGE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });
    } catch (e) {
      throw mapError(e);
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    let parsed: unknown;
    try {
      parsed = extractJSON(text);
    } catch (e) {
      throw new JudgeError(
        `Judge response was not valid JSON: ${text.slice(0, 200)}...`,
        'parse',
        'claude',
        e,
      );
    }

    const result = JudgeOutputJSONSchema.safeParse(parsed);
    if (!result.success) {
      throw new JudgeError(
        `Judge JSON failed schema validation: ${result.error.message}`,
        'parse',
        'claude',
      );
    }

    return {
      faithfulness: result.data.faithfulness ?? NaN,
      correctness: result.data.correctness ?? NaN,
      rationale: result.data.rationale,
      rawResponse: response,
    };
  },
};
