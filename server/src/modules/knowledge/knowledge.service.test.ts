// Contract-тест офлайн-фолбеку на рівні сервісу (не лише LLM-клієнта): коли llmAvailable()
// повертає false, getDynamicKnowledge() має прозоро віддати статичний контент з
// knowledge-base.ts (source: "static", focus: null) і НЕ чіпати ні kv-кеш, ні chat().
//
// І db/index.js, і llm/index.js мокнуті цілком — тест ізольований від реального
// node:sqlite (яке vitest не вміє трансформувати транзитивно) і від мережі, та перевіряє
// лише власну логіку гілкування knowledge.service.ts за прапорцем llmAvailable().
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db/index.js", () => ({
  getKvJson: vi.fn(() => null),
  setKvJson: vi.fn(),
}));
vi.mock("../../llm/index.js", () => ({
  llmAvailable: vi.fn(() => false),
  chat: vi.fn(),
}));

import { getDynamicKnowledge } from "./knowledge.service.js";
import { getKvJson } from "../../db/index.js";
import { chat } from "../../llm/index.js";

describe("getDynamicKnowledge() offline fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns static knowledge-base content without touching kv cache or chat()", async () => {
    const result = await getDynamicKnowledge("React", {
      profile: { skills: ["JavaScript"], domain: "Frontend" },
      demand: { React: 5 },
    });

    expect(result.source).toBe("static");
    expect(result.focus).toBeNull();
    expect(result.learn.length).toBeGreaterThan(0);
    expect(getKvJson).not.toHaveBeenCalled();
    expect(chat).not.toHaveBeenCalled();
  });
});
