import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../shared/api";
import { Btn, Card } from "../../shared/ui";
import { Markdown } from "../../shared/markdown";
import type { DesignDiagram, DesignTask } from "../../shared/types";

// One-shot "ask AI" — question in, answer out. Not a TanStack mutation: nothing to invalidate in
// the cache, same convention as study.tsx's drillHint / mock.tsx's evaluate.
export function DesignHelpPanel({ task, diagram, llm }: { task: DesignTask; diagram: DesignDiagram; llm: boolean }) {
  const { t } = useTranslation("design");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const ask = async () => {
    if (!question.trim()) return;
    setAsking(true);
    try {
      const res = await api.designHelp(task, diagram, question.trim());
      setAnswer(res.offline ? t("help.offline") : res.answer || t("help.failed"));
    } catch {
      setAnswer(t("help.failed"));
    } finally {
      setAsking(false);
    }
  };

  return (
    <Card>
      <div className="text-sm font-semibold text-ink">{t("help.heading")}</div>
      <div className="mt-2 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ask();
          }}
          placeholder={t("help.placeholder")}
          className="flex-1 bg-surface-2 border border-grid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
        />
        <Btn size="sm" onClick={ask} loading={asking} disabled={!question.trim() || !llm} title={llm ? "" : t("help.offline")}>
          {t("help.ask")}
        </Btn>
      </div>
      {answer && (
        <div className="mt-3 text-sm text-ink bg-surface-2 border border-grid rounded-lg p-2.5">
          <Markdown text={answer} inline />
        </div>
      )}
    </Card>
  );
}
