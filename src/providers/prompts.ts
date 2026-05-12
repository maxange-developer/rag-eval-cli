/**
 * Judge prompts — shared between providers.
 */

export const JUDGE_SYSTEM_PROMPT = `You are a strict evaluator of RAG (retrieval-augmented generation) pipelines.

Your job: given a question, a RAG-generated answer, and the retrieved context the answer was supposed to be grounded in, score two dimensions:

1. FAITHFULNESS (0.0 to 1.0 or null): Is the answer supported by the retrieved context? Penalize claims that are not in the context. A score of 1.0 means every claim in the answer is grounded in the context. A score of 0.0 means the answer is entirely hallucinated. Return null if the context is uninterpretable (e.g., only opaque IDs, not readable text).

2. CORRECTNESS (0.0 to 1.0 or null): Does the answer match the expected answer in substance? Be lenient on phrasing, strict on facts. If no expected_answer is provided, return null for this field. A score of 1.0 means semantically equivalent. A score of 0.0 means contradictory or unrelated.

Return ONLY valid JSON in this exact shape, no markdown, no commentary:

{
  "faithfulness": <number 0.0-1.0 or null if context is uninterpretable>,
  "correctness": <number 0.0-1.0 or null>,
  "rationale": "<one or two sentences explaining the scores>"
}`;

export function buildJudgeUserPrompt(input: {
  question: string;
  answer: string;
  retrievedContext: string[];
  expectedAnswer?: string;
}): string {
  // Heuristic: short strings with no spaces are likely IDs, not readable chunks.
  const looksLikeIds =
    input.retrievedContext.length > 0 &&
    input.retrievedContext.every((c) => c.length < 80 && !c.includes(' '));

  const contextBlock =
    input.retrievedContext.length > 0
      ? input.retrievedContext.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')
      : '(no context retrieved)';

  const contextNote = looksLikeIds
    ? '\n\n(NOTE: The retrieved context appears to be document IDs, not full text. Faithfulness cannot be reliably assessed. Return null for faithfulness.)'
    : '';

  const expectedBlock = input.expectedAnswer
    ? `\n\nExpected answer (ground truth):\n${input.expectedAnswer}`
    : '\n\n(No expected_answer provided — return null for correctness.)';

  return `Question:
${input.question}

Retrieved context:
${contextBlock}${contextNote}

RAG-generated answer:
${input.answer}${expectedBlock}

Now score and return JSON.`;
}
