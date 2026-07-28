// A single djb2-like hash function for cache keys (LLM responses, personal
// knowledge base, skill/domain extraction). Not for cryptography — just to avoid
// paying the LLM twice for the same input.
export function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = Math.trunc((hash * 33) ^ str.codePointAt(i)!);
  return String(hash >>> 0);
}
