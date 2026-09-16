import type { ReactNode } from "react";

import { formatDate, quarantineReason, statusPresentation } from "./presentation";
import type {
  AdapterResult,
  DispatchAction,
  Incident,
  QuarantinedTelemetryEvent,
  ServiceResult,
  TelemetryEvent,
} from "./types";

export function StatusBadge({ status }: { status: string }) {
  const presentation = statusPresentation(status);

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${presentation.className}`}
    >
      {presentation.label}
    </span>
  );
}

export function Section({
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

export function MetricCard({
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
    <article className="flex h-full min-h-36 flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-sm leading-5 text-slate-400">
        <span className="shrink-0 text-cyan-300">{icon}</span>
        <span>{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-auto pt-3 text-xs leading-5 text-slate-500">{hint}</p>
    </article>
  );
}

export function ServiceCard({ result }: { result: ServiceResult }) {
  const gatewayState = result.gatewayState;

  return (
    <article className="flex h-full min-h-44 flex-col rounded-2xl border border-white/10 bg-slate-950/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-white">{result.service.name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
            {result.service.protocol} · {result.service.id} · порт {result.service.port}
          </p>
        </div>
        <StatusBadge status={result.status} />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{result.service.description}</p>
      {gatewayState ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
          <span className="rounded-lg bg-white/5 px-2 py-1">
            Rate {gatewayState.rateLimit.ratePerSecond}/с · burst {gatewayState.rateLimit.burstCapacity}
          </span>
          <span className="rounded-lg bg-white/5 px-2 py-1">
            Блокувань: {gatewayState.blockedCount}
          </span>
          <span className="rounded-lg bg-white/5 px-2 py-1">
            Circuit: {gatewayState.circuit.mode}
          </span>
          <span className="rounded-lg bg-white/5 px-2 py-1">Cache: {gatewayState.cache.entries}</span>
        </div>
      ) : null}
      <p className="mt-auto pt-4 text-xs leading-5 text-slate-500">{result.detail}</p>
    </article>
  );
}

export function AdapterCard({ adapter }: { adapter: AdapterResult }) {
  const connectionLabel =
    adapter.status === "unavailable"
      ? "Немає з’єднання"
      : adapter.source.protocol === "tcp"
        ? "З’єднання встановлено"
        : adapter.statusCode !== null
          ? `Відповідь HTTP ${adapter.statusCode}`
          : "Сервіс відповідає";

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
        {adapter.latencyMs !== null ? (
          <span className="rounded-lg bg-white/5 px-2 py-1">{adapter.latencyMs} мс</span>
        ) : null}
        <span className="rounded-lg bg-white/5 px-2 py-1">{connectionLabel}</span>
      </div>
    </article>
  );
}

export function TelemetryRow({ event }: { event: TelemetryEvent }) {
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

export function QuarantineRow({ event }: { event: QuarantinedTelemetryEvent }) {
  return (
    <li className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-rose-400/10 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-white">{event.key}</p>
          {event.reasons.map((reason) => (
            <span key={reason} className="rounded-md bg-rose-400/10 px-2 py-0.5 text-[11px] text-rose-200">
              {quarantineReason(reason)}
            </span>
          ))}
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">
          {event.source} · ізольовано {formatDate(event.quarantinedAt)}
        </p>
      </div>
      <p className="text-right text-lg font-semibold text-rose-200">
        {event.value}
        {event.unit ? <span className="ml-1 text-xs font-normal text-slate-500">{event.unit}</span> : null}
      </p>
    </li>
  );
}

export function IncidentCard({ incident }: { incident: Incident }) {
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
      {incident.serviceId ? <p className="mt-2 text-xs text-cyan-200">Gateway: {incident.serviceId}</p> : null}
      <p className="mt-auto pt-4 text-xs text-slate-500">Виявлено: {formatDate(incident.createdAt)}</p>
    </article>
  );
}

export function ActionRow({ action }: { action: DispatchAction }) {
  return (
    <li className="flex min-h-24 flex-col gap-3 border-b border-white/5 py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium text-white">{action.title}</p>
        <p className="mt-1 break-words text-sm leading-6 text-slate-400">{action.description}</p>
        <p className="mt-2 text-xs text-slate-500">
          {action.targetComponents.join(" · ")}
          {action.serviceId ? ` · ${action.serviceId}` : ""} · {formatDate(action.createdAt)}
        </p>
      </div>
      <StatusBadge status={action.mode} />
    </li>
  );
}
