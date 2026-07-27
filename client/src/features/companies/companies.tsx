import { useUi } from "../../shared/ui-state";
import { useCompanies, useSaveCompany } from "../../shared/queries";
import { Btn, Card, CardsSkeleton, EmptyState, PageHeader, Spinner } from "../../shared/ui";

/* ---------- Companies ---------- */
export function Companies() {
  const { data: companies = [], isLoading } = useCompanies();
  const saveCompanyMutation = useSaveCompany();
  const [name, setName] = useUi("companies.name", "");
  // Один mutation-хук обслуговує і кнопку "+ Додати" (без id — новий запис), і onBlur-автозбереження
  // нотаток/питань кожної картки (з id) — скоупимо isPending за variables, щоб не блимати спінером
  // одразу всюди.
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
        title="Компанії"
        subtitle="Веди нотатки про компанії та банк питань «що спитали тут» — щоб готуватись прицільно."
        actions={
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Назва компанії"
              placeholder="Назва компанії"
              className="bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <Btn loading={isAdding} onClick={add}>
              + Додати
            </Btn>
          </div>
        }
      />
      {companies.length === 0 ? (
        <Card>
          <EmptyState icon="🏢" title="Ще немає компаній" hint="Додай компанію, щоб вести нотатки й банк питань зі співбесід." />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {companies.map((c) => {
            const isSaving = saveCompanyMutation.isPending && saveCompanyMutation.variables?.id === c.id;
            return (
              <Card key={c.id}>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="font-semibold text-slate-800">{c.name}</div>
                  {isSaving && (
                    <span className="flex items-center gap-1 text-[11px] text-indigo-500">
                      <Spinner className="h-3 w-3" /> зберігаю…
                    </span>
                  )}
                </div>
                <textarea
                  defaultValue={c.notes}
                  onBlur={(e) => saveCompanyMutation.mutate({ ...c, notes: e.target.value })}
                  aria-label={`Нотатки про ${c.name}`}
                  placeholder="Нотатки (стек, люди, зарплата, враження)…"
                  className="w-full h-20 bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <textarea
                  defaultValue={c.questions.join("\n")}
                  onBlur={(e) => saveCompanyMutation.mutate({ ...c, questions: e.target.value.split("\n").filter(Boolean) })}
                  aria-label={`Питання, що ставили в ${c.name}`}
                  placeholder="Питання, що ставили (по одному на рядок)…"
                  className="w-full h-20 mt-2 bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
