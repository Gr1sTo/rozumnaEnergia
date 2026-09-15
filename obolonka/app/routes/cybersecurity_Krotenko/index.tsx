import { useEffect } from "react";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  LockKeyhole,
  Network,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { NavLink, useLoaderData, useRevalidator } from "react-router";

import type { Route } from "./+types/index";
import { loadCybersecurityDashboard } from "./api.server";
import type {
  AdapterResult,
  Decision,
  DispatchAction,
  Incident,
  ServiceResult,
} from "./types";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Кіберзахист | Smart Energy Lab" },
    {
      name: "description",
      content: "Моніторинг кіберзахисту та функціональної стійкості Smart Energy",
    },
  ];
}

export async function loader(_: Route.LoaderArgs) {
  return loadCybersecurityDashboard();
}

const dateFormatter = new Intl.DateTimeFormat("uk-UA", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Europe/Kyiv",
});

const numberFormatter = new Intl.NumberFormat("uk-UA", {
  maximumFractionDigits: 2,
});

const statusStyles = {
  positive: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  warning: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  critical: "border-rose-400/25 bg-rose-400/10 text-rose-300",
  neutral: "border-slate-500/30 bg-slate-500/10 text-slate-300",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
}

function statusPresentation(status: string) {
  const normalized = status.toLowerCase();

  if (["available", "healthy", "online", "ready", "connected", "success", "applied"].includes(normalized)) {
    return { label: statusLabel(normalized), className: statusStyles.positive };
  }

  if (["degraded", "partial", "warning", "recommended", "medium"].includes(normalized)) {
    return { label: statusLabel(normalized), className: statusStyles.warning };
  }

  if (["offline", "unavailable", "down", "critical", "failed", "unsupported", "high"].includes(normalized)) {
    return { label: statusLabel(normalized), className: statusStyles.critical };
  }

  return { label: statusLabel(normalized), className: statusStyles.neutral };
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "Активний",
    applied: "Застосовано",
    available: "Доступний",
    blocked: "Заблоковано",
    connected: "Підключено",
    critical: "Критичний",
    degraded: "Деградація",
    down: "Не працює",
    failed: "Помилка",
    high: "Високий",
    low: "Низький",
    manual: "Ручний",
    medium: "Середній",
    offline: "Недоступний",
    online: "Працює",
    partial: "Частково",
    read_only: "Read-only",
    ready: "Готовий",
    recommended: "Рекомендовано",
    shadow: "Тіньовий",
    stale: "Застарілі дані",
    unchecked: "Не перевірено",
    unavailable: "Недоступний",
    unsupported: "Не підтримується",
    warning: "Попередження",
  };

  return labels[status] ?? status;
}

function StatusBadge({ status }: { status: string }) {
  const presentation = statusPresentation(status);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${presentation.className}`}>
      {presentation.label}
    </span>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/30 backdrop-blur sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span className="text-cyan-300">{icon}</span>
        {label}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </article>
  );
}

function ServiceCard({ result }: { result: ServiceResult }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{result.service.name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
            {result.service.protocol} · {result.service.id}
          </p>
        </div>
        <StatusBadge status={result.status} />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{result.service.description}</p>
      <p className="mt-3 text-xs text-slate-500">{result.detail}</p>
    </article>
  );
}

function AdapterCard({ adapter }: { adapter: AdapterResult }) {
  const primaryMetric = adapter.metrics[0];

  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{adapter.source.name}</p>
          <p className="mt-1 text-xs text-slate-500">
            {adapter.source.protocol?.toUpperCase() ?? "STATE"} · порт {adapter.source.port}
          </p>
        </div>
        <StatusBadge status={adapter.status} />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{adapter.source.description}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
        {adapter.latencyMs !== null && (
          <span className="rounded-lg bg-white/5 px-2 py-1">{adapter.latencyMs} мс</span>
        )}
        {adapter.statusCode !== null && (
          <span className="rounded-lg bg-white/5 px-2 py-1">HTTP {adapter.statusCode}</span>
        )}
        {primaryMetric && (
          <span className="rounded-lg bg-white/5 px-2 py-1">
            {primaryMetric.label}: {String(primaryMetric.value)}{primaryMetric.unit ? ` ${primaryMetric.unit}` : ""}
          </span>
        )}
      </div>
    </article>
  );
}

function IncidentCard({ incident }: { incident: Incident }) {
  return (
    <article className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{incident.title}</p>
          <p className="mt-1 text-xs text-slate-500">{incident.id}</p>
        </div>
        <StatusBadge status={incident.severity} />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{incident.description}</p>
      <p className="mt-3 text-xs text-slate-500">Виявлено: {formatDate(incident.createdAt)}</p>
    </article>
  );
}

function DecisionCard({ decision }: { decision: Decision }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{decision.title}</p>
          <p className="mt-1 text-xs text-slate-500">{decision.targetComponents.join(" · ")}</p>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={decision.priority} />
          <StatusBadge status={decision.executionMode} />
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{decision.description}</p>
      <p className="mt-2 text-xs text-slate-500">Причина: {decision.reason}</p>
    </article>
  );
}

function ActionRow({ action }: { action: DispatchAction }) {
  return (
    <li className="flex flex-col gap-3 border-b border-white/5 py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="font-medium text-white">{action.title}</p>
        <p className="mt-1 text-sm text-slate-400">{action.description}</p>
        <p className="mt-2 text-xs text-slate-500">{action.targetComponents.join(" · ")} · {formatDate(action.createdAt)}</p>
      </div>
      <StatusBadge status={action.mode} />
    </li>
  );
}

export default function CybersecurityDashboard() {
  const { snapshot, error, fetchedAt } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (revalidator.state === "idle") revalidator.revalidate();
    }, 5_000);

    return () => window.clearInterval(timer);
  }, [revalidator]);

  const refreshing = revalidator.state !== "idle";

  if (!snapshot) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-3xl border border-rose-400/25 bg-rose-400/[0.07] p-8">
          <TriangleAlert className="h-10 w-10 text-rose-300" />
          <h1 className="mt-5 text-3xl font-semibold">Cybersecurity API недоступний</h1>
          <p className="mt-3 text-slate-300">{error ?? "Snapshot не отримано."}</p>
          <p className="mt-2 text-sm text-slate-500">Остання спроба: {formatDate(fetchedAt)}</p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => revalidator.revalidate()}
              className="rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-300"
            >
              Повторити
            </button>
            <NavLink to="/" className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/5">
              На головну
            </NavLink>
          </div>
        </div>
      </main>
    );
  }

  const metrics = snapshot.metrics.summary;
  const externalAdapters = snapshot.readOnly.adapters.filter(
    (adapter) => adapter.source.owner === "Зовнішній сервіс SmartEnergy",
  );
  const externalAdapterCounts = externalAdapters.reduce(
    (counts, adapter) => {
      counts[adapter.status] += 1;
      return counts;
    },
    { ready: 0, partial: 0, stale: 0, unavailable: 0 },
  );
  const integrationStatus = snapshot.backend.integrationHealth;

  return (
    <main className="min-h-screen bg-slate-950 bg-[radial-gradient(circle_at_top_left,rgba(8,145,178,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_28%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-3xl border border-white/10 bg-slate-900/75 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <NavLink to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-cyan-300">
                <ArrowLeft className="h-4 w-4" />
                Smart Energy Lab
              </NavLink>
              <div className="mt-5 flex items-center gap-3">
                <span className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-300">
                  <ShieldCheck className="h-7 w-7" />
                </span>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Центр кіберзахисту</h1>
                  <p className="mt-1 text-sm text-slate-400">Функціональна стійкість та стан інтеграцій у реальному часі</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Backend</p>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge status={snapshot.backend.status} />
                  <StatusBadge status={integrationStatus} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => revalidator.revalidate()}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-300/15 disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Оновити
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-4 text-xs text-slate-500" aria-live="polite">
            <span>Режим: {statusLabel(snapshot.backend.integrationMode)}</span>
            <span>Джерело: {snapshot.backend.source}</span>
            <span>Зовнішніх джерел: {snapshot.backend.externalSources}</span>
            <span>Оновлено: {formatDate(snapshot.generatedAt)}</span>
          </div>
        </header>

        {error && (
          <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            {error}
          </div>
        )}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard icon={<Gauge className="h-4 w-4" />} label="Доступність" value={`${numberFormatter.format(metrics.avgAvailabilityPct)}%`} hint="середнє за політиками" />
          <MetricCard icon={<Clock3 className="h-4 w-4" />} label="MTTD" value={`${numberFormatter.format(metrics.avgMttdMin)} хв`} hint="час виявлення" />
          <MetricCard icon={<Activity className="h-4 w-4" />} label="MTTR" value={`${numberFormatter.format(metrics.avgMttrMin)} хв`} hint="час відновлення" />
          <MetricCard icon={<TriangleAlert className="h-4 w-4" />} label="Інциденти" value={String(metrics.totalIncidents)} hint="за поточним набором даних" />
          <MetricCard icon={<LockKeyhole className="h-4 w-4" />} label="Дії захисту" value={String(metrics.totalActions)} hint="реальні dispatcher-дії" />
          <MetricCard icon={<Radio className="h-4 w-4" />} label="Read-only" value={`${externalAdapterCounts.ready}/${externalAdapters.length}`} hint="зовнішніх джерел готові" />
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_1.95fr]">
          <Section title="Компоненти захисту" description="Стани формуються з локального захисту та фактичних HTTP/TCP-перевірок.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {snapshot.api.results.map((result) => <ServiceCard key={result.service.id} result={result} />)}
            </div>
          </Section>

          <Section title="Джерела Smart Energy" description="Read-only інтеграції не змінюють стан чужих підсистем.">
            <div className="mb-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-lg bg-emerald-400/10 px-2.5 py-1 text-emerald-300">Готові: {externalAdapterCounts.ready}</span>
              <span className="rounded-lg bg-amber-400/10 px-2.5 py-1 text-amber-300">Частково: {externalAdapterCounts.partial}</span>
              <span className="rounded-lg bg-slate-400/10 px-2.5 py-1 text-slate-300">Застарілі: {externalAdapterCounts.stale}</span>
              <span className="rounded-lg bg-rose-400/10 px-2.5 py-1 text-rose-300">Недоступні: {externalAdapterCounts.unavailable}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {externalAdapters.map((adapter) => <AdapterCard key={adapter.source.id} adapter={adapter} />)}
            </div>
          </Section>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Section title="Інциденти" description="Brute force, DDoS, телеметричні аномалії, несанкціоновані команди та відмови сервісів.">
            {snapshot.incidents.incidents.length ? (
              <div className="space-y-3">
                {snapshot.incidents.incidents.map((incident) => <IncidentCard key={incident.id} incident={incident} />)}
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300" />
                <p className="mt-3 font-medium text-white">Активних інцидентів не виявлено</p>
                <p className="mt-1 text-sm text-slate-400">Моніторинг продовжується автоматично.</p>
              </div>
            )}
          </Section>

          <Section title="Рішення системи" description="Пояснення реакції backend-а без прихованих або непідтримуваних команд.">
            <div className="space-y-3">
              {snapshot.incidents.decisions.map((decision) => <DecisionCard key={decision.id} decision={decision} />)}
            </div>
          </Section>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_1fr]">
          <Section title="Журнал дій" description="Окремо відображаються застосовані дії, рекомендації та непідтримувані операції.">
            <ul>
              {snapshot.actions.actions.length ? (
                snapshot.actions.actions.map((action) => <ActionRow key={action.id} action={action} />)
              ) : (
                <li className="py-8 text-center text-sm text-slate-500">Dispatcher-дій ще немає.</li>
              )}
            </ul>
          </Section>

          <Section title="Політики стійкості" description="Порівняння режимів захисту за фактичними результатами аналізатора.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="pb-3 font-medium">Політика</th>
                    <th className="pb-3 font-medium">Доступність</th>
                    <th className="pb-3 font-medium">MTTD</th>
                    <th className="pb-3 font-medium">MTTR</th>
                    <th className="pb-3 text-right font-medium">Інциденти</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.metrics.byPolicy.map((policy) => (
                    <tr key={policy.policy} className="border-t border-white/5 text-slate-300">
                      <td className="py-3 font-medium capitalize text-white">{policy.policy}</td>
                      <td className="py-3">{numberFormatter.format(policy.availability_pct)}%</td>
                      <td className="py-3">{numberFormatter.format(policy.mean_mttd_min)} хв</td>
                      <td className="py-3">{numberFormatter.format(policy.mean_mttr_min)} хв</td>
                      <td className="py-3 text-right">{policy.incidents_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        <footer className="mt-6 flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2"><Server className="h-4 w-4" />API через внутрішню Docker-мережу</span>
          <span className="inline-flex items-center gap-2"><Database className="h-4 w-4" />БД перевіряються read-only</span>
          <span className="inline-flex items-center gap-2"><Network className="h-4 w-4" />Автооновлення кожні 5 секунд</span>
        </footer>
      </div>
    </main>
  );
}
