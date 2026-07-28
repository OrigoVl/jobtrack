// Approximate cost estimation for admin cost-visibility (Phase 5). Prices are list prices at the
// time this was written (USD per 1M tokens) — providers change these without notice, and this
// table has no mechanism to detect that. It's an estimate for trend/relative-cost visibility in
// the admin panel, not a billing-accurate figure; reconcile against the provider's own dashboard
// for anything that needs to be exact. An unrecognized model returns null (NOT 0) — a real
// `$0.00` in the admin UI would misleadingly read as "this call was free".
interface ModelPrice {
  inputPer1M: number;
  outputPer1M: number;
}

const PRICES: Record<string, ModelPrice> = {
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10 },
  "text-embedding-3-small": { inputPer1M: 0.02, outputPer1M: 0 },
  "claude-haiku-4-5-20251001": { inputPer1M: 1, outputPer1M: 5 },
  "claude-sonnet-4-5-20250929": { inputPer1M: 3, outputPer1M: 15 },
};

/** Estimated USD cost of a call, or null if `model` isn't in the price table above. */
export function estimateCostUsd(model: string | null, inputTokens: number, outputTokens: number): number | null {
  if (!model) return null;
  const price = PRICES[model];
  if (!price) return null;
  return (inputTokens / 1_000_000) * price.inputPer1M + (outputTokens / 1_000_000) * price.outputPer1M;
}
