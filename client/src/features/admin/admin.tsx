import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import { Btn, Card, CardsSkeleton, Chip, EmptyState, PageHeader, Segmented } from "../../shared/ui";
import { useUi } from "../../shared/ui-state";
import { money } from "../../shared/format";
import { useAdminLlmUsage, useAdminOverview, useAdminProductEvents, useAdminUsers, useBanUser, useUnbanUser } from "../../shared/queries";
import { useConfirm } from "../../shared/use-confirm";
import { useSession } from "../../shared/auth-client";

const AXIS = "#4c5f56"; // --ink-dim
const TOOLTIP = {
  background: "#ffffff", // --surface
  border: "1px solid #d4e0d8", // --grid
  borderRadius: 12,
  boxShadow: "0 8px 24px -12px rgba(14,22,19,0.25)",
  color: "#0e1613", // --ink
} as const;

const DAY_RANGE_VALUES = [7, 30, 90];

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-semibold text-ink-dim">{label}</div>
      <div className="text-2xl font-extrabold text-ink mt-1">{value}</div>
      {hint && <div className="text-xs text-ink-dim mt-0.5">{hint}</div>}
    </Card>
  );
}

function OverviewTab({ days }: { days: number }) {
  const { t } = useTranslation(["admin", "common"]);
  const { data, isLoading } = useAdminOverview(days);
  if (isLoading) return <CardsSkeleton count={2} />;
  if (!data) return null;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard label={t("overview.totalUsers")} value={String(data.totalUsers)} />
      <StatCard label={t("overview.totalVacancies")} value={String(data.totalVacancies)} />
      <StatCard label={t("overview.llmCostLabel", { days })} value={money(data.llmCostUsd)} hint={t("overview.llmCostHint")} />
      <StatCard label={t("overview.llmCallsLabel", { days })} value={String(data.llmCalls)} />
    </div>
  );
}

function UsersTab() {
  const { t, i18n } = useTranslation(["admin", "common"]);
  const confirm = useConfirm();
  const { data: session } = useSession();
  const { data, isLoading } = useAdminUsers(50, 0);
  const banMutation = useBanUser();
  const unbanMutation = useUnbanUser();
  if (isLoading) return <CardsSkeleton count={1} />;
  if (!data || data.users.length === 0) return <EmptyState icon="👥" title={t("users.empty.title")} />;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="text-left text-xs font-semibold text-ink-dim border-b border-grid">
            <th className="py-2 pr-3">{t("users.table.name")}</th>
            <th className="py-2 pr-3">{t("users.table.email")}</th>
            <th className="py-2 pr-3">{t("users.table.role")}</th>
            <th className="py-2 pr-3">{t("users.table.joined")}</th>
            <th className="py-2 pr-3 text-right">{t("users.table.vacancies")}</th>
            <th className="py-2 pr-3 text-right">{t("users.table.llmCallsRecent")}</th>
            <th className="py-2 text-right">{t("users.table.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {data.users.map((u) => {
            const isSelf = u.id === session?.user?.id;
            const isBanning = banMutation.isPending && banMutation.variables?.userId === u.id;
            const isUnbanning = unbanMutation.isPending && unbanMutation.variables === u.id;
            return (
              <tr key={u.id} className="border-b border-surface-2 last:border-0">
                <td className="py-2 pr-3 font-medium text-ink">{u.name || "—"}</td>
                <td className="py-2 pr-3 text-ink-dim">{u.email}</td>
                <td className="py-2 pr-3">
                  {u.role === "admin" ? <Chip tone="indigo">admin</Chip> : <Chip>user</Chip>}
                  {u.banned && (
                    <Chip tone="rose" key="banned">
                      {t("users.table.bannedBadge")}
                    </Chip>
                  )}
                </td>
                <td className="py-2 pr-3 text-ink-dim">{new Date(u.createdAt).toLocaleDateString(i18n.language)}</td>
                <td className="py-2 pr-3 text-right">{u.vacancyCount}</td>
                <td className="py-2 pr-3 text-right">{u.llmCallsRecent}</td>
                <td className="py-2 text-right">
                  {isSelf ? (
                    <span className="text-xs text-ink-dim">—</span>
                  ) : u.banned ? (
                    <Btn variant="ghost" size="sm" loading={isUnbanning} onClick={() => unbanMutation.mutate(u.id)}>
                      {t("users.actions.unban")}
                    </Btn>
                  ) : (
                    <Btn
                      variant="danger"
                      size="sm"
                      loading={isBanning}
                      onClick={async () => {
                        if (
                          await confirm({
                            title: t("users.banConfirmTitle", { name: u.name || u.email }),
                            message: t("users.banConfirmMessage"),
                          })
                        )
                          banMutation.mutate({ userId: u.id });
                      }}
                    >
                      {t("users.actions.ban")}
                    </Btn>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="text-xs text-ink-dim mt-2">{t("users.showingSummary", { count: data.users.length, total: data.total })}</div>
    </Card>
  );
}

function LlmCostTab({ days }: { days: number }) {
  const { t } = useTranslation(["admin", "common"]);
  const { data, isLoading } = useAdminLlmUsage(days);
  if (isLoading) return <CardsSkeleton count={2} />;
  if (!data) return null;
  if (data.totalCalls === 0) {
    return (
      <Card>
        <EmptyState icon="🤖" title={t("llm.empty.title")} hint={t("llm.empty.hint")} />
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <StatCard label={t("llm.totalCostLabel", { days })} value={money(data.totalCostUsd)} hint={t("llm.totalCostHint")} />
        <StatCard label={t("llm.totalCallsLabel", { days })} value={String(data.totalCalls)} />
      </div>
      <Card>
        <div className="text-sm font-semibold mb-3 text-ink">{t("llm.costByFeature")}</div>
        <div style={{ height: Math.max(160, data.byFeature.length * 40) }}>
          <ResponsiveContainer>
            <BarChart data={data.byFeature} layout="vertical">
              <XAxis type="number" tick={{ fill: AXIS }} tickFormatter={(v: number) => money(v)} />
              <YAxis type="category" dataKey="feature" width={140} tick={{ fill: AXIS, fontSize: 11 }} />
              <Tooltip cursor={{ fill: "rgba(14,143,92,0.08)" }} contentStyle={TOOLTIP} formatter={(v: unknown) => money(Number(v))} />
              <Bar dataKey="costUsd" radius={[0, 6, 6, 0]}>
                {data.byFeature.map((_, i) => (
                  <Cell key={i} fill="#0e8f5c" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <div className="text-sm font-semibold mb-3 text-ink">{t("llm.costByDay")}</div>
        <div style={{ height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={data.byDay}>
              <XAxis dataKey="day" tick={{ fill: AXIS, fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: AXIS }} tickFormatter={(v: number) => money(v)} />
              <Tooltip contentStyle={TOOLTIP} formatter={(v: unknown) => money(Number(v))} />
              <Bar dataKey="costUsd" radius={[4, 4, 0, 0]} fill="#0e8f5c" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function ProductAnalyticsTab({ days }: { days: number }) {
  const { t } = useTranslation(["admin", "common"]);
  const { data, isLoading } = useAdminProductEvents(days);
  if (isLoading) return <CardsSkeleton count={2} />;
  if (!data) return null;
  if (data.byName.length === 0) {
    return (
      <Card>
        <EmptyState icon="📈" title={t("product.empty.title")} hint={t("product.empty.hint")} />
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <Card>
        <div className="text-sm font-semibold mb-3 text-ink">{t("product.eventsByType")}</div>
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
          <div className="text-sm font-semibold mb-3 text-ink">{t("product.searchesByDay")}</div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={data.searchesByDay}>
                <XAxis dataKey="day" tick={{ fill: AXIS, fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: AXIS }} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#b45309" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
      {data.topSearchQueries.length > 0 && (
        <Card>
          <div className="text-sm font-semibold mb-3 text-ink">{t("product.topSearchQueries")}</div>
          <div className="space-y-1.5">
            {data.topSearchQueries.map((q) => (
              <div key={q.query} className="flex items-center gap-3 text-sm">
                <div className="flex-1 truncate text-ink">{q.query}</div>
                <div className="text-ink-dim font-medium">{q.count}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function LogsTab({ logsDashboardUrl }: { logsDashboardUrl: string | null | undefined }) {
  const { t } = useTranslation(["admin", "common"]);
  return (
    <Card>
      <EmptyState
        icon="🪵"
        title={t("logs.empty.title")}
        hint={t("logs.empty.hint")}
        action={
          logsDashboardUrl ? (
            <a
              href={logsDashboardUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-signal hover:text-signal"
            >
              {t("logs.openDashboard")}
            </a>
          ) : undefined
        }
      />
    </Card>
  );
}

type Tab = "overview" | "users" | "llm" | "product" | "logs";
type TabLabelKey = `tabs.${keyof (typeof import("../../i18n/locales/en/admin.json"))["tabs"]}`;
const TAB_DEF: { value: Tab; labelKey: TabLabelKey }[] = [
  { value: "overview", labelKey: "tabs.overview" },
  { value: "users", labelKey: "tabs.users" },
  { value: "llm", labelKey: "tabs.llm" },
  { value: "product", labelKey: "tabs.product" },
  { value: "logs", labelKey: "tabs.logs" },
];

export function Admin() {
  const { t } = useTranslation(["admin", "common"]);
  const [tab, setTab] = useUi<Tab>("admin.tab", "overview");
  const [days, setDays] = useUi<number>("admin.days", 30);
  const { data: overview } = useAdminOverview(days);
  const tabs = TAB_DEF.map((tb) => ({ value: tb.value, label: t(tb.labelKey) }));
  const dayRanges = DAY_RANGE_VALUES.map((value) => ({ value, label: t("dayRange.label", { count: value }) }));
  return (
    <div className="space-y-4">
      <PageHeader
        title={t("page.title")}
        subtitle={t("page.subtitle")}
        actions={tab !== "users" && tab !== "logs" ? <Segmented value={days} onChange={setDays} options={dayRanges} /> : undefined}
      />
      <Segmented value={tab} onChange={setTab} options={tabs} />
      {tab === "overview" && <OverviewTab days={days} />}
      {tab === "users" && <UsersTab />}
      {tab === "llm" && <LlmCostTab days={days} />}
      {tab === "product" && <ProductAnalyticsTab days={days} />}
      {tab === "logs" && <LogsTab logsDashboardUrl={overview?.logsDashboardUrl} />}
    </div>
  );
}
