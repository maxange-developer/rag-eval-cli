import { z } from 'zod';

export const EvalEntrySchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  expected_source: z.union([z.string(), z.array(z.string())]),
  expected_answer: z.string().optional(),
});
export type EvalEntry = z.infer<typeof EvalEntrySchema>;

export const EndpointConfigSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST']).default('POST'),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.record(z.string(), z.unknown()).optional(),
  responsePaths: z.object({
    answer: z.string(),
    sources: z.string(),
  }),
  timeoutMs: z.number().int().positive().default(30000),
});
export type EndpointConfig = z.infer<typeof EndpointConfigSchema>;

export const JudgeConfigSchema = z.object({
  provider: z.enum(['claude', 'openai']).default('claude'),
  model: z.string().default('claude-sonnet-4-6'),
  apiKeyEnv: z.string().default('ANTHROPIC_API_KEY'),
});
export type JudgeConfig = z.infer<typeof JudgeConfigSchema>;

export const ScoringConfigSchema = z.object({
  retrievalK: z.number().int().positive().default(5),
  weights: z
    .object({
      retrieval: z.number().min(0).max(1).default(0.4),
      faithfulness: z.number().min(0).max(1).default(0.3),
      correctness: z.number().min(0).max(1).default(0.3),
    })
    .refine(
      (w) => Math.abs(w.retrieval + w.faithfulness + w.correctness - 1) < 0.01,
      { message: 'Scoring weights must sum to 1.0' },
    ),
});
export type ScoringConfig = z.infer<typeof ScoringConfigSchema>;

export const ConfigSchema = z.object({
  endpoint: EndpointConfigSchema,
  judge: JudgeConfigSchema.optional(),
  scoring: ScoringConfigSchema.default({
    retrievalK: 5,
    weights: { retrieval: 0.4, faithfulness: 0.3, correctness: 0.3 },
  }),
});
export type Config = z.infer<typeof ConfigSchema>;

export interface EndpointResponse {
  answer: string;
  sources: string[];
  raw: unknown;
  latencyMs: number;
}

export interface RetrievalScore {
  precision: number;
  found: boolean;
  topKSources: string[];
  expectedSources: string[];
}

export interface JudgeResult {
  faithfulness?: number;
  correctness?: number;
  rationale?: string;
}

export interface QuestionResult {
  entry: EvalEntry;
  response: EndpointResponse | null;
  error: string | null;
  retrieval: RetrievalScore | null;
  judge: JudgeResult | null;
  overallScore: number;
}

export interface RunSummary {
  total: number;
  successful: number;
  failed: number;
  avgRetrievalPrecision: number;
  avgOverallScore: number;
  passed: boolean;
  durationMs: number;
}
