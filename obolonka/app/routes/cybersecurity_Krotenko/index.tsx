import { useEffect, type ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Gauge,
  LockKeyhole,
  Radio,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { NavLink, useLoaderData, useRevalidator } from "react-router";

import type { Route } from "./+types/index";
import { loadCybersecurityDashboard } from "./api.server";
import type {
  AdapterResult,
  DispatchAction,
  Incident,
  ServiceResult,
  TelemetryEvent,
} from "./types";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Кіберзахист | Smart Energy Lab" },
    {
      name: "description",
      content: "Кіберзахист і функціональна стійкість Smart Energy",
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

const emptyTelemetry = {
  status: "waiting" as const,
  topic: "sensor/data",
  analyzedKeys: ["power_kw", "voltage"],
  summary: { visible: 0, analyzed: 0, collectedOnly: 0 },
  events: [] as TelemetryEvent[],
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
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
    disconnected: "Немає зв'язку",
    down: "Не працює",
    failed: "Помилка",
    high: "Високий",
    healthy: "Штатний",
    isolated: "Ізольовано",
    low: "Низький",
    manual: "Ручний",
    medium: "Середній",
    offline: "Недоступний",
    online: "Працює",
    partial: "Частково",
    read_only: "Лише читання",
    ready: "Готовий",
    rate_limited: "Трафік обмежено",
    recommended: "Сформовано",
    shadow: "Тіньовий",
    stale: "Застарілі дані",
    streaming: "Надходять дані",
    unchecked: "Не перевірено",
    unavailable: "Недоступний",
    unsupported: "Не підтримується",
    unknown: "Невідомий",
    waiting: "Очікування даних",
    warning: "Попередження",
  };

  return labels[status] ?? status;
}

function statusPresentation(status: string) {
  const normalized = status.toLowerCase();

  if (
    [
      "available",
      "healthy",
      "online",
      "ready",
      "connected",
      "success",
      "applied",
      "streaming",
    ].includes(normalized)
  ) {
    return { label: statusLabel(normalized), className: statusStyles.positive };
  }

  if (["degraded", "partial", "warning", "recommended", "medium"].includes(normalized)) {
    return { label: statusLabel(normalized), className: statusStyles.warning };
  }

  if (
    [
      "offline",
      "unavailable",
      "disconnected",
      "down",
      "critical",
      "failed",
      "unsupported",
      "high",
    ].includes(normalized)
  ) {
    return { label: statusLabel(normalized), className: statusStyles.critical };
  }

  return { label: statusLabel(normalized), className: statusStyles.neutral };
}

function StatusBadge({ status }: { status: string }) {
  const presentation = statusPresentation(status);

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${presentation.className}`}
    >
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
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="h-full rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/30 backdrop-blur sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-400">{description}</p>
        ) : null}
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
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="flex min-h-36 h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-sm leading-5 text-slate-400">
        <span className="shrink-0 text-cyan-300">{icon}</span>
        <span>{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-auto pt-3 text-xs leading-5 text-slate-500">{hint}</p>
    </article>
  );
}

function ServiceCard({ result }: { result: ServiceResult }) {
  return (
    <article className="flex h-full min-h-44 flex-col rounded-2xl border border-white/10 bg-slate-950/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-white">{result.service.name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
            {result.service.protocol} · {result.service.id}
          </p>
        </div>
        <StatusBadge status={result.status} />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{result.service.description}</p>
      <p className="mt-auto pt-4 text-xs leading-5 text-slate-500">{result.detail}</p>
    </article>
  );
}

function AdapterCard({ adapter }: { adapter: AdapterResult }) {
  const primaryMetric = adapter.metrics[0];

  return (
    <article className="flex h-full min-h-48 flex-col rounded-2xl border border-white/10 bg-slate-950/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-white">{adapter.source.name}</p>
          <p className="mt-1 text-xs text-slate-500">
            {adapter.source.protocol?.toUpperCase() ?? "STATE"} · порт {adapter.source.port}
          </p>
        </div>
        <StatusBadge status={adapter.status} />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{adapter.source.description}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-4 text-xs text-slate-300">
        {adapter.latencyMs !== null && (
          <span className="rounded-lg bg-white/5 px-2 py-1">{adapter.latencyMs} мс</span>
        )}
        {adapter.statusCode !== null && (
          <span className="rounded-lg bg-white/5 px-2 py-1">HTTP {adapter.statusCode}</span>
        )}
        {primaryMetric && (
          <span className="rounded-lg bg-white/5 px-2 py-1">
            {primaryMetric.label}: {String(primaryMetric.value)}
            {primaryMetric.unit ? ` ${primaryMetric.unit}` : ""}
          </span>
        )}
      </div>
    </article>
  );
}

function TelemetryRow({ event }: { event: TelemetryEvent }) {
  return (
    <li className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-white/5 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-white">{event.key}</p>
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
            {event.analyzed ? "аналізується" : "лише збір"}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">
          {event.source} · {event.component} · {formatDate(event.timestamp)}
        </p>
      </div>
      <p className="text-right text-lg font-semibold text-cyan-200">
        {event.value}
        {event.unit ? <span className="ml-1 text-xs font-normal text-slate-500">{event.unit}</span> : null}
      </p>
    </li>
  );
}

function IncidentCard({ incident }: { incident: Incident }) {
  return (
    <article className="flex h-full min-h-44 flex-col rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-white">{incident.title}</p>
          <p className="mt-1 text-xs text-slate-500">{incident.ruleId}</p>
        </div>
        <StatusBadge status={incident.severity} />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{incident.description}</p>
      <p className="mt-auto pt-4 text-xs text-slate-500">
        Виявлено: {formatDate(incident.createdAt)}
      </p>
    </article>
  );
}

function ActionRow({ action }: { action: DispatchAction }) {
  return (
    <li className="flex min-h-24 flex-col gap-3 border-b border-white/5 py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium text-white">{action.title}</p>
        <p className="mt-1 break-words text-sm leading-6 text-slate-400">{action.description}</p>
        <p className="mt-2 text-xs text-slate-500">
          {action.targetComponents.join(" · ")} · {formatDate(action.createdAt)}
        </p>
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
          <p className="mt-3 text-slate-300">{error ?? "Не вдалося отримати стан системи."}</p>
          <p className="mt-2 text-sm text-slate-500">Остання спроба: {formatDate(fetchedAt)}</p>
          <div className="mt-6 flex flex-wrap gap-3">
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
  const telemetry = snapshot.telemetry ?? emptyTelemetry;
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

  return (
    <main className="min-h-screen bg-slate-950 bg-[radial-gradient(circle_at_top_left,rgba(8,145,178,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_28%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <NavLink
              to="/"
              className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-cyan-300"
            >
              <ArrowLeft className="h-4 w-4" />
              На головну
            </NavLink>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-cyan-300">
                <ShieldCheck className="h-8 w-8" />
              </span>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">Кіберзахист</h1>
                <p className="mt-1 text-sm text-slate-400">
                  Захист API, аналіз MQTT-телеметрії та контроль доступності
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3" aria-live="polite">
            <StatusBadge status={snapshot.backend.integrationHealth} />
            <div className="text-xs leading-5 text-slate-500">
              <p>Режим: {statusLabel(snapshot.backend.integrationMode)}</p>
              <p>Оновлено: {formatDate(snapshot.generatedAt)}</p>
            </div>
            <button
              type="button"
              onClick={() => revalidator.revalidate()}
              disabled={refreshing}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-200 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Оновити
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            {error}
          </div>
        )}

        <section className="mt-6 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard
            icon={<Gauge className="h-4 w-4" />}
            label="Розрахункова доступність"
            value={`${numberFormatter.format(metrics.avgAvailabilityPct)}%`}
            hint="порівняльна модель політик"
          />
          <MetricCard
            icon={<Clock3 className="h-4 w-4" />}
            label="Порівняльний MTTD"
            value={`${numberFormatter.format(metrics.avgMttdMin)} хв`}
            hint="модельний час виявлення"
          />
          <MetricCard
            icon={<Activity className="h-4 w-4" />}
            label="Порівняльний MTTR"
            value={`${numberFormatter.format(metrics.avgMttrMin)} хв`}
            hint="модельний час відновлення"
          />
          <MetricCard
            icon={<TriangleAlert className="h-4 w-4" />}
            label="Активні інциденти"
            value={String(snapshot.incidents.summary.totalIncidents)}
            hint="DDoS, телеметрія та upstream"
          />
          <MetricCard
            icon={<LockKeyhole className="h-4 w-4" />}
            label="Дії захисту"
            value={String(metrics.totalActions)}
            hint="фактичні дії Analyzer і Control"
          />
          <MetricCard
            icon={<Radio className="h-4 w-4" />}
            label="Доступні джерела"
            value={`${externalAdapterCounts.ready}/${externalAdapters.length}`}
            hint="read-only HTTP/TCP перевірки"
          />
        </section>

        <div className="mt-6">
          <Section
            title="Компоненти кіберзахисту"
          >
            <div className="grid auto-rows-fr gap-3 md:grid-cols-2">
              {snapshot.api.results.map((result) => (
                <ServiceCard key={result.service.id} result={result} />
              ))}
            </div>
          </Section>
        </div>

        <div className="mt-6">
          <Section
            title="MQTT-телеметрія"
            description={`Останні повідомлення з MQTT-топіка ${telemetry.topic}.`}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <StatusBadge status={telemetry.status} />
              <span className="rounded-lg bg-cyan-400/10 px-2.5 py-1 text-cyan-200">
                Аналізуються: {telemetry.summary.analyzed}
              </span>
              <span className="rounded-lg bg-white/5 px-2.5 py-1 text-slate-400">
                Лише збираються: {telemetry.summary.collectedOnly}
              </span>
            </div>
            {telemetry.events.length ? (
              <ul className="grid gap-x-5 md:grid-cols-2">
                {telemetry.events.map((event, index) => (
                  <TelemetryRow key={`${event.timestamp}-${event.source}-${event.key}-${index}`} event={event} />
                ))}
              </ul>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
                <Radio className="mx-auto h-8 w-8 text-slate-500" />
                <p className="mt-3 font-medium text-white">Очікуємо MQTT-телеметрію</p>
                <p className="mt-1 text-sm text-slate-500">
                  Перевірте broker і публікацію в topic {telemetry.topic}.
                </p>
              </div>
            )}
          </Section>
        </div>

        <div className="mt-6">
          <Section
            title="Доступність зовнішніх компонентів"
            description="HTTP/TCP перевірки показують доступність і затримку. Вони не аналізують вміст БД або мережеві атаки."
          >
            <div className="mb-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-lg bg-emerald-400/10 px-2.5 py-1 text-emerald-300">
                Готові: {externalAdapterCounts.ready}
              </span>
              <span className="rounded-lg bg-amber-400/10 px-2.5 py-1 text-amber-300">
                Частково: {externalAdapterCounts.partial}
              </span>
              <span className="rounded-lg bg-slate-400/10 px-2.5 py-1 text-slate-300">
                Застарілі: {externalAdapterCounts.stale}
              </span>
              <span className="rounded-lg bg-rose-400/10 px-2.5 py-1 text-rose-300">
                Недоступні: {externalAdapterCounts.unavailable}
              </span>
            </div>
            <div className="grid auto-rows-fr gap-3 md:grid-cols-2 lg:grid-cols-3">
              {externalAdapters.map((adapter) => (
                <AdapterCard key={adapter.source.id} adapter={adapter} />
              ))}
            </div>
          </Section>
        </div>

        <div className="mt-6 grid items-stretch gap-6 lg:grid-cols-2">
          <Section
            title="Інциденти"
          >
            {snapshot.incidents.incidents.length ? (
              <div className="grid auto-rows-fr gap-3">
                {snapshot.incidents.incidents.map((incident) => (
                  <IncidentCard key={incident.id} incident={incident} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300" />
                <p className="mt-3 font-medium text-white">Активних інцидентів немає</p>
                <p className="mt-1 text-sm text-slate-400">Gateway і MQTT-потік продовжують аналізуватися.</p>
              </div>
            )}
          </Section>

          <Section
            title="Журнал дій"
          >
            <ul>
              {snapshot.actions.actions.length ? (
                snapshot.actions.actions.map((action) => <ActionRow key={action.id} action={action} />)
              ) : (
                <li className="py-8 text-center text-sm text-slate-500">Дій реагування ще немає.</li>
              )}
            </ul>
          </Section>
        </div>

        <div className="mt-6">
          <Section
            title="Порівняння політик стійкості"
            description="Модельні метрики для порівняння minimal, baseline і standard; це не виміряний час стендової реакції."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="pb-3 font-medium">Політика</th>
                    <th className="pb-3 font-medium">Розрахункова доступність</th>
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
      </div>
    </main>
  );
}
