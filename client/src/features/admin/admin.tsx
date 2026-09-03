import { useEffect, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import { Btn, Card, CardsSkeleton, Chip, EmptyState, PageHeader, Segmented } from "../../shared/ui";
import { useUi } from "../../shared/ui-state";
import { money } from "../../shared/format";
import {
  useAdminBilling,
  useAdminLlmUsage,
  useAdminOverview,
  useAdminProductEvents,
  useAdminUsers,
  useBanUser,
  useGrantBonusAiCalls,
  useGrantTemporaryPlan,
  useUnbanUser,
} from "../../shared/queries";
import { useConfirm } from "../../shared/use-confirm";
import { useSession } from "../../shared/auth-client";
import type { AdminUserRow } from "../../shared/types";

// CSS custom properties (not hardcoded hex) so these Recharts props — which take inline styles/SVG
// props, not Tailwind classes — stay correct across the light/dark toggle and the token repaint.
const AXIS = "rgb(var(--ink-dim))";
const TOOLTIP = {
  background: "rgb(var(--surface))",
  border: "1px solid rgb(var(--grid))",
  borderRadius: 12,
  boxShadow: "0 8px 24px -12px rgb(var(--ink) / 0.25)",
  color: "rgb(var(--ink))",
} as const;
// `contentStyle.color` only styles the tooltip's wrapper <div> — Recharts renders the label and
// each value line as separate elements with their OWN default color (the value line defaults to
// the hovered series' own fill, e.g. `--star`), ignoring `contentStyle.color` entirely — see
// analytics/charts.tsx's identical constants for the full explanation of this Recharts quirk.
const TOOLTIP_LABEL = { color: "rgb(var(--ink))", fontWeight: 600 } as const;
const TOOLTIP_ITEM = { color: "rgb(var(--ink))" } as const;

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

const NUMBER_FIELD_CLASS =
  "w-14 bg-surface-2 border border-grid rounded-lg px-1.5 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-signal/50";

/** Manual grant controls for one user row (users.grants.* i18n) — the "rescue hatch" for a solo
 * operator's first paying customers (apologize with a free month of Pro, top up someone's AI
 * quota by hand) without going through Stripe. Both actions are sensitive (they alter another
 * account's billing state), hence the useConfirm() gate and per-row loading state, same pattern
 * as the ban button above. */
function UserGrantActions({ user }: { user: AdminUserRow }) {
  const { t } = useTranslation(["admin", "common"]);
  const confirm = useConfirm();
  const [days, setDays] = useState(30);
  const [bonusCalls, setBonusCalls] = useState(25);
  const grantPlanMutation = useGrantTemporaryPlan();
  const grantBonusMutation = useGrantBonusAiCalls();
  const isGrantingPlan = grantPlanMutation.isPending && grantPlanMutation.variables?.userId === user.id;
  const isGrantingBonus = grantBonusMutation.isPending && grantBonusMutation.variables?.userId === user.id;
  const name = user.name || user.email;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={1}
          max={365}
          value={days}
          onChange={(e) => setDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
          aria-label={t("users.grants.daysAriaLabel")}
          className={NUMBER_FIELD_CLASS}
        />
        <Btn
          variant="ghost"
          size="sm"
          loading={isGrantingPlan}
          onClick={async () => {
            if (
              await confirm({
                title: t("users.grants.planConfirmTitle", { name }),
                message: t("users.grants.planConfirmMessage", { days }),
                tone: "primary",
              })
            )
              grantPlanMutation.mutate({ userId: user.id, plan: "pro", days });
          }}
        >
          {t("users.grants.grantPlan")}
        </Btn>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={-1000}
          max={1000}
          value={bonusCalls}
          onChange={(e) => setBonusCalls(Math.max(-1000, Math.min(1000, Number(e.target.value) || 0)))}
          aria-label={t("users.grants.callsAriaLabel")}
          className={NUMBER_FIELD_CLASS}
        />
        <Btn
          variant="ghost"
          size="sm"
          loading={isGrantingBonus}
          onClick={async () => {
            if (
              await confirm({
                title: t("users.grants.bonusConfirmTitle", { name }),
                message: t("users.grants.bonusConfirmMessage", { count: bonusCalls }),
                tone: "primary",
              })
            )
              grantBonusMutation.mutate({ userId: user.id, count: bonusCalls });
          }}
        >
          {t("users.grants.grantBonus")}
        </Btn>
      </div>
    </div>
  );
}

const ADMIN_USERS_PAGE_SIZE = 50;

function UsersTab() {
  const { t, i18n } = useTranslation(["admin", "common"]);
  const confirm = useConfirm();
  const { data: session } = useSession();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  // Debounced so typing doesn't fire a request per keystroke; resets to page 1 once the actual
  // (debounced) search term changes, not on every keystroke of searchInput.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);
  useEffect(() => setOffset(0), [search]);
  const { data, isLoading } = useAdminUsers(ADMIN_USERS_PAGE_SIZE, offset, search);
  const banMutation = useBanUser();
  const unbanMutation = useUnbanUser();

  const searchBox = (
    <input
      value={searchInput}
      onChange={(e) => setSearchInput(e.target.value)}
      placeholder={t("users.searchPlaceholder")}
      aria-label={t("users.searchAriaLabel")}
      className="w-full max-w-xs mb-3 bg-surface-2 border border-grid rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
    />
  );

  if (isLoading) return <CardsSkeleton count={1} />;
  if (!data || data.users.length === 0) {
    return (
      <Card>
        {searchBox}
        <EmptyState title={search ? t("users.noResults", { search }) : t("users.empty.title")} />
      </Card>
    );
  }
  return (
    <Card className="overflow-x-auto">
      {searchBox}
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="text-left text-xs font-semibold text-ink-dim border-b border-grid">
            <th className="py-2 pr-3">{t("users.table.name")}</th>
            <th className="py-2 pr-3">{t("users.table.email")}</th>
            <th className="py-2 pr-3">{t("users.table.role")}</th>
            <th className="py-2 pr-3">{t("users.table.joined")}</th>
            <th className="py-2 pr-3 text-right">{t("users.table.vacancies")}</th>
            <th className="py-2 pr-3">{t("users.table.plan")}</th>
            <th className="py-2 pr-3 text-right">{t("users.table.llmCallsRecent")}</th>
            <th className="py-2 pr-3 text-right">{t("users.table.costRecent")}</th>
            <th className="py-2 pr-3 text-right">{t("users.table.blockedRecent")}</th>
            <th className="py-2 pr-3 text-right">{t("users.table.grants")}</th>
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
                <td className="py-2 pr-3">
                  <Chip tone={u.plan === "free" ? "slate" : "emerald"}>{u.plan}</Chip>
                </td>
                <td className="py-2 pr-3 text-right">{u.llmCallsRecent}</td>
                <td className="py-2 pr-3 text-right">{money(u.llmCostRecentUsd)}</td>
                <td className="py-2 pr-3 text-right">
                  {u.blockedCallsRecent > 0 ? <Chip tone="amber">{u.blockedCallsRecent}</Chip> : "—"}
                </td>
                <td className="py-2 pr-3 text-right">
                  {isSelf ? <span className="text-xs text-ink-dim">—</span> : <UserGrantActions user={u} />}
                </td>
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
      <div className="flex items-center justify-between mt-2">
        <div className="text-xs text-ink-dim">{t("users.showingSummary", { count: data.users.length, total: data.total })}</div>
        <div className="flex gap-1">
          <Btn size="sm" variant="ghost" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - ADMIN_USERS_PAGE_SIZE))}>
            {t("users.pagination.prev")}
          </Btn>
          <Btn
            size="sm"
            variant="ghost"
            disabled={offset + ADMIN_USERS_PAGE_SIZE >= data.total}
            onClick={() => setOffset((o) => o + ADMIN_USERS_PAGE_SIZE)}
          >
            {t("users.pagination.next")}
          </Btn>
        </div>
      </div>
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
        <EmptyState title={t("llm.empty.title")} hint={t("llm.empty.hint")} />
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
              <Tooltip
                cursor={{ fill: "rgb(var(--star) / 0.12)" }}
                contentStyle={TOOLTIP}
                labelStyle={TOOLTIP_LABEL}
                itemStyle={TOOLTIP_ITEM}
                formatter={(v: unknown) => money(Number(v))}
              />
              <Bar dataKey="costUsd" radius={[0, 6, 6, 0]}>
                {data.byFeature.map((_, i) => (
                  <Cell key={i} fill="rgb(var(--star))" />
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
              <Tooltip
                contentStyle={TOOLTIP}
                labelStyle={TOOLTIP_LABEL}
                itemStyle={TOOLTIP_ITEM}
                formatter={(v: unknown) => money(Number(v))}
              />
              <Bar dataKey="costUsd" radius={[4, 4, 0, 0]} fill="rgb(var(--star))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <div className="text-sm font-semibold mb-3 text-ink">{t("llm.costByModel")}</div>
        <div style={{ height: Math.max(160, data.byModel.length * 40) }}>
          <ResponsiveContainer>
            <BarChart data={data.byModel.map((m) => ({ ...m, modelLabel: m.model ?? t("llm.cachedLabel") }))} layout="vertical">
              <XAxis type="number" tick={{ fill: AXIS }} tickFormatter={(v: number) => money(v)} />
              <YAxis type="category" dataKey="modelLabel" width={140} tick={{ fill: AXIS, fontSize: 11 }} />
              <Tooltip
                cursor={{ fill: "rgb(var(--star) / 0.12)" }}
                contentStyle={TOOLTIP}
                labelStyle={TOOLTIP_LABEL}
                itemStyle={TOOLTIP_ITEM}
                formatter={(v: unknown) => money(Number(v))}
              />
              <Bar dataKey="costUsd" radius={[0, 6, 6, 0]}>
                {data.byModel.map((_, i) => (
                  <Cell key={i} fill="rgb(var(--star))" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <div className="text-sm font-semibold mb-3 text-ink">{t("llm.costByTier")}</div>
        <div style={{ height: Math.max(160, data.byTier.length * 40) }}>
          <ResponsiveContainer>
            <BarChart data={data.byTier.map((m) => ({ ...m, tierLabel: m.tier ?? t("llm.cachedLabel") }))} layout="vertical">
              <XAxis type="number" tick={{ fill: AXIS }} tickFormatter={(v: number) => money(v)} />
              <YAxis type="category" dataKey="tierLabel" width={140} tick={{ fill: AXIS, fontSize: 11 }} />
              <Tooltip
                cursor={{ fill: "rgb(var(--star) / 0.12)" }}
                contentStyle={TOOLTIP}
                labelStyle={TOOLTIP_LABEL}
                itemStyle={TOOLTIP_ITEM}
                formatter={(v: unknown) => money(Number(v))}
              />
              <Bar dataKey="costUsd" radius={[0, 6, 6, 0]}>
                {data.byTier.map((_, i) => (
                  <Cell key={i} fill="rgb(var(--star))" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <div className="text-sm font-semibold mb-3 text-ink">{t("llm.costByOutcome")}</div>
        {/* Calls, not cost: budget_exceeded/quota_exceeded rows carry no real spend (the whole
            point is that the call never reached a provider) — a cost-based chart would show them
            as invisible zero-height bars. This is the first admin view where those two outcomes
            (previously recorded but never surfaced anywhere) become visible at all. */}
        <div style={{ height: Math.max(160, data.byOutcome.length * 40) }}>
          <ResponsiveContainer>
            <BarChart
              data={data.byOutcome.map((o) => ({
                ...o,
                outcomeLabel: t(`llm.outcomeLabels.${o.outcome}` as never, { defaultValue: o.outcome }),
              }))}
              layout="vertical"
            >
              <XAxis type="number" tick={{ fill: AXIS }} allowDecimals={false} />
              <YAxis type="category" dataKey="outcomeLabel" width={160} tick={{ fill: AXIS, fontSize: 11 }} />
              <Tooltip
                cursor={{ fill: "rgb(var(--star) / 0.12)" }}
                contentStyle={TOOLTIP}
                labelStyle={TOOLTIP_LABEL}
                itemStyle={TOOLTIP_ITEM}
              />
              <Bar dataKey="calls" radius={[0, 6, 6, 0]}>
                {data.byOutcome.map((o, i) => (
                  <Cell key={i} fill={o.outcome === "success" || o.outcome === "cache_hit" ? "rgb(var(--star))" : "rgb(var(--alert))"} />
                ))}
              </Bar>
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
        <EmptyState title={t("product.empty.title")} hint={t("product.empty.hint")} />
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
                <Tooltip contentStyle={TOOLTIP} labelStyle={TOOLTIP_LABEL} itemStyle={TOOLTIP_ITEM} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="rgb(var(--horizon))" />
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

function BillingTab({ days }: { days: number }) {
  const { t } = useTranslation(["admin", "common"]);
  const { data, isLoading } = useAdminBilling(days);
  if (isLoading) return <CardsSkeleton count={2} />;
  if (!data) return null;
  if (!data.planCounts.length) {
    return (
      <Card>
        <EmptyState title={t("billing.notConfigured")} />
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <StatCard label={t("billing.estimatedMrr", { days })} value={money(data.estimatedMrrUsd)} hint={t("billing.estimatedMrrHint")} />
        <StatCard label={t("billing.quotaExceeded", { days })} value={String(data.quotaExceededCount)} />
      </div>
      <Card>
        <div className="text-sm font-semibold mb-3 text-ink">{t("billing.planMix")}</div>
        <div className="flex flex-wrap gap-2">
          {data.planCounts.map((p) => (
            <Chip key={`${p.plan}-${p.status}`} tone={p.plan === "free" ? "slate" : "emerald"}>
              {p.plan} / {p.status}: {p.count}
            </Chip>
          ))}
        </div>
      </Card>
    </div>
  );
}

function LogsTab({ logsDashboardUrl }: { logsDashboardUrl: string | null | undefined }) {
  const { t } = useTranslation(["admin", "common"]);
  return (
    <Card>
      <EmptyState
        title={t("logs.empty.title")}
        hint={t("logs.empty.hint")}
        action={
          logsDashboardUrl ? (
            <a
              href={logsDashboardUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-dim hover:text-signal"
            >
              {t("logs.openDashboard")}
            </a>
          ) : undefined
        }
      />
    </Card>
  );
}

type Tab = "overview" | "users" | "llm" | "product" | "billing" | "logs";
type TabLabelKey = `tabs.${keyof (typeof import("../../i18n/locales/en/admin.json"))["tabs"]}`;
const TAB_DEF: { value: Tab; labelKey: TabLabelKey }[] = [
  { value: "overview", labelKey: "tabs.overview" },
  { value: "users", labelKey: "tabs.users" },
  { value: "llm", labelKey: "tabs.llm" },
  { value: "product", labelKey: "tabs.product" },
  { value: "billing", labelKey: "tabs.billing" },
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
        eyebrow={t("page.eyebrow")}
        title={t("page.title")}
        subtitle={t("page.subtitle")}
        actions={tab !== "users" && tab !== "logs" ? <Segmented value={days} onChange={setDays} options={dayRanges} /> : undefined}
      />
      <Segmented value={tab} onChange={setTab} options={tabs} />
      {tab === "overview" && <OverviewTab days={days} />}
      {tab === "users" && <UsersTab />}
      {tab === "llm" && <LlmCostTab days={days} />}
      {tab === "product" && <ProductAnalyticsTab days={days} />}
      {tab === "billing" && <BillingTab days={days} />}
      {tab === "logs" && <LogsTab logsDashboardUrl={overview?.logsDashboardUrl} />}
    </div>
  );
}
