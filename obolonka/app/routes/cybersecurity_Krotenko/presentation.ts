const dateFormatter = new Intl.DateTimeFormat("uk-UA", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Europe/Kyiv",
});

export const numberFormatter = new Intl.NumberFormat("uk-UA", {
  maximumFractionDigits: 2,
});

const statusLabels: Record<string, string> = {
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

const statusStyles = {
  positive: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  warning: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  critical: "border-rose-400/25 bg-rose-400/10 text-rose-300",
  neutral: "border-slate-500/30 bg-slate-500/10 text-slate-300",
};

const positiveStatuses = new Set([
  "available",
  "healthy",
  "online",
  "ready",
  "connected",
  "success",
  "applied",
  "streaming",
]);
const warningStatuses = new Set(["degraded", "partial", "warning", "recommended", "medium"]);
const criticalStatuses = new Set([
  "offline",
  "unavailable",
  "disconnected",
  "down",
  "critical",
  "failed",
  "unsupported",
  "high",
]);

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
}

export function statusLabel(status: string) {
  return statusLabels[status] ?? status;
}

export function statusPresentation(status: string) {
  const normalized = status.toLowerCase();

  if (positiveStatuses.has(normalized)) {
    return { label: statusLabel(normalized), className: statusStyles.positive };
  }
  if (warningStatuses.has(normalized)) {
    return { label: statusLabel(normalized), className: statusStyles.warning };
  }
  if (criticalStatuses.has(normalized)) {
    return { label: statusLabel(normalized), className: statusStyles.critical };
  }
  return { label: statusLabel(normalized), className: statusStyles.neutral };
}

export function quarantineReason(reason: string) {
  const labels: Record<string, string> = {
    abrupt_value_change: "різкий стрибок",
    invalid_numeric_value: "некоректне число",
    outside_physical_bounds: "вихід за фізичні межі",
  };

  return labels[reason] ?? reason;
}
