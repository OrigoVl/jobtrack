import { useUi } from "../../shared/ui-state";
import { useCompanies, useSaveCompany } from "../../shared/queries";
import { Btn, Card, CardsSkeleton, EmptyState, PageHeader } from "../../shared/ui";

/* ---------- Companies ---------- */
export function Companies() {
  const { data: companies = [], isLoading } = useCompanies();
  const saveCompanyMutation = useSaveCompany();
  const [name, setName] = useUi("companies.name", "");
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
            <Btn onClick={add}>+ Додати</Btn>
          </div>
        }
      />
      {companies.length === 0 ? (
        <Card>
          <EmptyState icon="🏢" title="Ще немає компаній" hint="Додай компанію, щоб вести нотатки й банк питань зі співбесід." />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {companies.map((c) => (
            <Card key={c.id}>
              <div className="font-semibold mb-2 text-slate-800">{c.name}</div>
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
          ))}
        </div>
      )}
    </div>
  );
}
