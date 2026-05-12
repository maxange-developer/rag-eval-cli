import OpenAI from 'openai';
import { JUDGE_SYSTEM_PROMPT, buildJudgeUserPrompt } from './prompts.js';
import { JudgeOutputJSONSchema } from '../config/schema.js';
import {
  type JudgeProvider,
  type JudgeInput,
  type JudgeOutput,
  JudgeError,
} from './types.js';

function getClient(): OpenAI {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    throw new JudgeError(
      'OPENAI_API_KEY not set in environment',
      'auth',
      'openai',
    );
  }
  return new OpenAI({ apiKey });
}

function mapError(e: unknown): JudgeError {
  if (e instanceof JudgeError) return e;
  const err = e as { status?: number; message?: string };
  if (err.status === 401 || err.status === 403) {
    return new JudgeError('Authentication failed', 'auth', 'openai', e);
  }
  if (err.status === 429) {
    return new JudgeError('Rate limit exceeded', 'rate_limit', 'openai', e);
  }
  if (err.status && err.status >= 500) {
    return new JudgeError('Provider server error', 'server', 'openai', e);
  }
  if (err.status && err.status >= 400) {
    return new JudgeError(err.message ?? 'Invalid request', 'invalid', 'openai', e);
  }
  return new JudgeError(err.message ?? 'Network error', 'network', 'openai', e);
}

const OPENAI_JSON_SCHEMA = {
  type: 'object',
  properties: {
    faithfulness: {
      type: ['number', 'null'],
      description: 'How well the answer is supported by retrieved context, null if context is uninterpretable (e.g., only IDs not text)',
    },
    correctness: {
      type: ['number', 'null'],
      description: 'How well the answer matches expected_answer, null if not provided',
    },
    rationale: {
      type: 'string',
      description: 'One or two sentences explaining the scores',
    },
  },
  required: ['faithfulness', 'correctness', 'rationale'],
  additionalProperties: false,
} as const;

export const openaiJudge: JudgeProvider = {
  name: 'openai',

  async judge(input: JudgeInput, model: string): Promise<JudgeOutput> {
    const client = getClient();
    const userPrompt = buildJudgeUserPrompt(input);

    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await client.chat.completions.create({
        model,
        temperature: 0,
        max_tokens: 600,
        messages: [
          { role: 'system', content: JUDGE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'judge_output',
            strict: true,
            schema: OPENAI_JSON_SCHEMA,
          },
        },
      });
    } catch (e) {
      throw mapError(e);
    }

    const text = response.choices[0]?.message?.content ?? '';
    if (!text) {
      throw new JudgeError('Empty response from judge', 'parse', 'openai');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new JudgeError(
        `Judge response was not valid JSON: ${text.slice(0, 200)}`,
        'parse',
        'openai',
        e,
      );
    }

    const result = JudgeOutputJSONSchema.safeParse(parsed);
    if (!result.success) {
      throw new JudgeError(
        `Judge JSON failed schema validation: ${result.error.message}`,
        'parse',
        'openai',
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
