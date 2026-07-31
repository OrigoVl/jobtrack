import { useUi } from "../../shared/ui-state";
import { useCompanies, useSaveCompany } from "../../shared/queries";
import { Btn, Card, CardsSkeleton, EmptyState, PageHeader, Spinner } from "../../shared/ui";

/* ---------- Companies ---------- */
export function Companies() {
  const { data: companies = [], isLoading } = useCompanies();
  const saveCompanyMutation = useSaveCompany();
  const [name, setName] = useUi("companies.name", "");
  // One mutation hook serves both the "+ Add" button (no id — a new record) and each card's
  // onBlur autosave of notes/questions (with id) — scope isPending by variables so the
  // spinner doesn't flash everywhere at once.
  const isAdding = saveCompanyMutation.isPending && !saveCompanyMutation.variables?.id;
  const add = () => {
    if (!name) return;
    saveCompanyMutation.mutate({ name, notes: "", questions: [] });
    setName("");
  };
  if (isLoading) return <CardsSkeleton count={2} />;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Companies"
        subtitle="Keep notes on companies and a bank of 'what they asked here' questions — so you can prep with focus."
        actions={
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Company name"
              placeholder="Company name"
              className="bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
            />
            <Btn loading={isAdding} onClick={add}>
              + Add
            </Btn>
          </div>
        }
      />
      {companies.length === 0 ? (
        <Card>
          <EmptyState icon="🏢" title="No companies yet" hint="Add a company to keep notes and a bank of interview questions." />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {companies.map((c) => {
            const isSaving = saveCompanyMutation.isPending && saveCompanyMutation.variables?.id === c.id;
            return (
              <Card key={c.id}>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="font-semibold text-ink">{c.name}</div>
                  {isSaving && (
                    <span className="flex items-center gap-1 text-[11px] text-signal">
                      <Spinner className="h-3 w-3" /> saving…
                    </span>
                  )}
                </div>
                <textarea
                  defaultValue={c.notes}
                  onBlur={(e) => saveCompanyMutation.mutate({ ...c, notes: e.target.value })}
                  aria-label={`Notes about ${c.name}`}
                  placeholder="Notes (stack, people, salary, impressions)…"
                  className="w-full h-20 bg-surface-2 border border-grid rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
                />
                <textarea
                  defaultValue={c.questions.join("\n")}
                  onBlur={(e) => saveCompanyMutation.mutate({ ...c, questions: e.target.value.split("\n").filter(Boolean) })}
                  aria-label={`Questions asked at ${c.name}`}
                  placeholder="Questions they asked (one per line)…"
                  className="w-full h-20 mt-2 bg-surface-2 border border-grid rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
                />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
