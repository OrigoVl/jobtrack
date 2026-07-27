// Єдина djb2-подібна хеш-функція для ключів кешу (LLM-відповіді, персональна
// база знань, екстракція навичок/домену). Не для криптографії — лише щоб не
// платити LLM двічі за той самий вхід.
export function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = Math.trunc((hash * 33) ^ str.codePointAt(i)!);
  return String(hash >>> 0);
}
