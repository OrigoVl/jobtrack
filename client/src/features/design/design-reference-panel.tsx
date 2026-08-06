import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Btn, Card } from "../../shared/ui";
import { layoutReference } from "../../shared/design-layout";
import { DesignCanvas } from "./design-canvas";
import type { DesignReferenceEdge, DesignReferenceNode } from "../../shared/types";

const NOOP = () => {};

/** Reveal-on-demand (don't spoil the reference solution before the candidate submits) read-only
 * view of the AI's suggested reference diagram — only rendered by the caller when
 * grade.referenceNodes is non-empty (a real AI grade; the offline heuristic never populates it). */
export function DesignReferencePanel({ nodes, edges }: { nodes: DesignReferenceNode[]; edges: DesignReferenceEdge[] }) {
  const { t } = useTranslation("design");
  const [shown, setShown] = useState(false);
  const diagram = useMemo(() => layoutReference(nodes, edges), [nodes, edges]);

  if (!shown) {
    return (
      <Card>
        <Btn size="sm" variant="ghost" onClick={() => setShown(true)}>
          {t("reference.reveal")}
        </Btn>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-ink">{t("reference.heading")}</span>
        <Btn size="sm" variant="ghost" onClick={() => setShown(false)}>
          {t("reference.hide")}
        </Btn>
      </div>
      <DesignCanvas initialDiagram={diagram} onChange={NOOP} heightClass="h-[40vh]" readOnly />
    </Card>
  );
}
