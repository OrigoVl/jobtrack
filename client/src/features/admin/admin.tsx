import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardsSkeleton, Chip, EmptyState, PageHeader, Segmented } from "../../shared/ui";
import { useUi } from "../../shared/ui-state";
import { useAdminLlmUsage, useAdminOverview, useAdminProductEvents, useAdminUsers } from "../../shared/queries";

const AXIS = "#64748b";
const TOOLTIP = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  boxShadow: "0 8px 24px -12px rgba(16,24,40,0.25)",
  color: "#0f172a",
} as const;

const DAY_RANGES = [
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
];

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="text-2xl font-extrabold text-slate-900 mt-1">{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-0.5">{hint}</div>}
    </Card>
  );
}

function money(v: number): string {
  return v < 0.01 && v > 0 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
}

function OverviewTab({ days }: { days: number }) {
  const { data, isLoading } = useAdminOverview(days);
  if (isLoading) return <CardsSkeleton count={2} />;
  if (!data) return null;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard label="Total users" value={String(data.totalUsers)} />
      <StatCard label="Total vacancies" value={String(data.totalVacancies)} />
      <StatCard label={`LLM cost (${days}d)`} value={money(data.llmCostUsd)} hint="estimated, see LLM cost tab" />
      <StatCard label={`LLM calls (${days}d)`} value={String(data.llmCalls)} />
    </div>
  );
}

function UsersTab() {
  const { data, isLoading } = useAdminUsers(50, 0);
  if (isLoading) return <CardsSkeleton count={1} />;
  if (!data || data.users.length === 0) return <EmptyState icon="👥" title="No users yet" />;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="text-left text-xs font-semibold text-slate-500 border-b border-slate-200">
            <th className="py-2 pr-3">Name</th>
            <th className="py-2 pr-3">Email</th>
            <th className="py-2 pr-3">Role</th>
            <th className="py-2 pr-3">Joined</th>
            <th className="py-2 pr-3 text-right">Vacancies</th>
            <th className="py-2 text-right">LLM calls (recent)</th>
          </tr>
        </thead>
        <tbody>
          {data.users.map((u) => (
            <tr key={u.id} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-3 font-medium text-slate-800">{u.name || "—"}</td>
              <td className="py-2 pr-3 text-slate-600">{u.email}</td>
              <td className="py-2 pr-3">
                {u.role === "admin" ? <Chip tone="indigo">admin</Chip> : <Chip>user</Chip>}
                {u.banned && (
                  <Chip tone="rose" key="banned">
                    banned
                  </Chip>
                )}
              </td>
              <td className="py-2 pr-3 text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
              <td className="py-2 pr-3 text-right">{u.vacancyCount}</td>
              <td className="py-2 text-right">{u.llmCallsRecent}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs text-slate-400 mt-2">
        Showing {data.users.length} of {data.total}.
      </div>
    </Card>
  );
}

function LlmCostTab({ days }: { days: number }) {
  const { data, isLoading } = useAdminLlmUsage(days);
  if (isLoading) return <CardsSkeleton count={2} />;
  if (!data) return null;
  if (data.totalCalls === 0) {
    return (
      <Card>
        <EmptyState icon="🤖" title="No LLM usage yet" hint="Calls will show up here once users start using AI features." />
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <StatCard label={`Total cost (${days}d)`} value={money(data.totalCostUsd)} hint="estimated — see llm/pricing.ts" />
        <StatCard label={`Total calls (${days}d)`} value={String(data.totalCalls)} />
      </div>
      <Card>
        <div className="text-sm font-semibold mb-3 text-slate-700">Cost by feature</div>
        <div style={{ height: Math.max(160, data.byFeature.length * 40) }}>
          <ResponsiveContainer>
            <BarChart data={data.byFeature} layout="vertical">
              <XAxis type="number" tick={{ fill: AXIS }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
              <YAxis type="category" dataKey="feature" width={140} tick={{ fill: AXIS, fontSize: 11 }} />
              <Tooltip cursor={{ fill: "rgba(99,102,241,0.06)" }} contentStyle={TOOLTIP} formatter={(v: unknown) => money(Number(v))} />
              <Bar dataKey="costUsd" radius={[0, 6, 6, 0]}>
                {data.byFeature.map((_, i) => (
                  <Cell key={i} fill="#6366f1" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <div className="text-sm font-semibold mb-3 text-slate-700">Cost by day</div>
        <div style={{ height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={data.byDay}>
              <XAxis dataKey="day" tick={{ fill: AXIS, fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: AXIS }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
              <Tooltip contentStyle={TOOLTIP} formatter={(v: unknown) => money(Number(v))} />
              <Bar dataKey="costUsd" radius={[4, 4, 0, 0]} fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function ProductAnalyticsTab({ days }: { days: number }) {
  const { data, isLoading } = useAdminProductEvents(days);
  if (isLoading) return <CardsSkeleton count={2} />;
  if (!data) return null;
  if (data.byName.length === 0) {
    return (
      <Card>
        <EmptyState icon="📈" title="No product events yet" hint="Job searches and other tracked actions will show up here." />
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <Card>
        <div className="text-sm font-semibold mb-3 text-slate-700">Events by type</div>
        <div className="flex flex-wrap gap-2">
          {data.byName.map((n) => (
            <Chip key={n.name} tone="indigo">
              {n.name}: {n.count}
            </Chip>
          ))}
        </div>
      </Card>
      {data.searchesByDay.length > 0 && (
        <Card>
          <div className="text-sm font-semibold mb-3 text-slate-700">Job searches by day</div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={data.searchesByDay}>
                <XAxis dataKey="day" tick={{ fill: AXIS, fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: AXIS }} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
      {data.topSearchQueries.length > 0 && (
        <Card>
          <div className="text-sm font-semibold mb-3 text-slate-700">Top search queries</div>
          <div className="space-y-1.5">
            {data.topSearchQueries.map((q) => (
              <div key={q.query} className="flex items-center gap-3 text-sm">
                <div className="flex-1 truncate text-slate-700">{q.query}</div>
                <div className="text-slate-400 font-medium">{q.count}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function LogsTab({ logsDashboardUrl }: { logsDashboardUrl: string | null | undefined }) {
  return (
    <Card>
      <EmptyState
        icon="🪵"
        title="Logs & errors live in the external tracker"
        hint="Not duplicated in this panel — see the README for why (retention/cost/PII reasons). Configure LOGS_DASHBOARD_URL to link it here."
        action={
          logsDashboardUrl ? (
            <a
              href={logsDashboardUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Open dashboard ↗
            </a>
          ) : undefined
        }
      />
    </Card>
  );
}

type Tab = "overview" | "users" | "llm" | "product" | "logs";
const TABS: { value: Tab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "users", label: "Users" },
  { value: "llm", label: "LLM cost" },
  { value: "product", label: "Product" },
  { value: "logs", label: "Logs & errors" },
];

export function Admin() {
  const [tab, setTab] = useUi<Tab>("admin.tab", "overview");
  const [days, setDays] = useUi<number>("admin.days", 30);
  const { data: overview } = useAdminOverview(days);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Admin"
        subtitle="Users & activity, LLM cost, and product analytics — aggregates only, no CV text or per-user search history."
        actions={tab !== "users" && tab !== "logs" ? <Segmented value={days} onChange={setDays} options={DAY_RANGES} /> : undefined}
      />
      <Segmented value={tab} onChange={setTab} options={TABS} />
      {tab === "overview" && <OverviewTab days={days} />}
      {tab === "users" && <UsersTab />}
      {tab === "llm" && <LlmCostTab days={days} />}
      {tab === "product" && <ProductAnalyticsTab days={days} />}
      {tab === "logs" && <LogsTab logsDashboardUrl={overview?.logsDashboardUrl} />}
    </div>
  );
}
