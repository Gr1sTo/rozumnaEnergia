export type ServiceStatus = "online" | "degraded" | "offline" | "unchecked";
export type AdapterStatus = "ready" | "partial" | "stale" | "unavailable";
export type SignalLevel = "normal" | "warning" | "critical";

export interface CybersecurityBackend {
  status: string;
  integrationHealth: string;
  integrationMode: string;
  publicPort: number;
  apiBasePath: string;
  snapshotEndpoint: string;
  source: string;
  externalReadsEnabled: boolean;
  externalSources: number;
  generatedAt: string;
}

export interface ComponentSummary {
  total: number;
  online: number;
  degraded: number;
  offline: number;
  unchecked: number;
  criticalOffline: number;
}

export interface ServiceResult {
  service: {
    id: string;
    name: string;
    owner: string;
    port: number;
    protocol: string;
    url: string;
    method: string;
    timeoutMs: number;
    critical: boolean;
    description: string;
  };
  status: ServiceStatus;
  checkedAt: string;
  latencyMs: number | null;
  statusCode: number | null;
  detail: string;
  corsLimited: boolean;
}

export interface AdapterMetric {
  label: string;
  value: string | number | boolean | null;
  level: SignalLevel;
  unit?: string;
}

export interface AdapterSignal {
  level: SignalLevel;
  title: string;
  description: string;
}

export interface AdapterResult {
  source: {
    id: string;
    name: string;
    owner: string;
    component?: string;
    protocol?: string;
    port: number;
    endpoint: string;
    timeoutMs: number;
    description: string;
  };
  status: AdapterStatus;
  checkedAt: string;
  latencyMs: number | null;
  statusCode: number | null;
  metrics: AdapterMetric[];
  signals: AdapterSignal[];
  rawPreview: unknown;
}

export interface MetricsSummary {
  policies: number;
  avgAvailabilityPct: number;
  avgMttdMin: number;
  avgMttrMin: number;
  totalIncidents: number;
  totalActions: number;
}

export interface PolicyMetrics {
  policy: string;
  availability_pct: number;
  total_downtime_hr: number;
  mean_mttd_min: number;
  mean_mttr_min: number;
  incidents_total: number;
  incidents_critical: number;
  incidents_high: number;
  incidents_medium: number;
  incidents_low: number;
  by_availability_attack: number;
  by_integrity_attack: number;
  by_outage: number;
}

export interface Incident {
  id: string;
  ruleId: string;
  severity: "critical" | "warning";
  title: string;
  description: string;
  affectedComponents: string[];
  evidence: string[];
  createdAt: string;
}

export interface DispatchAction {
  id: string;
  decisionId: string;
  mode: "applied" | "recommended" | "failed" | "unsupported";
  title: string;
  description: string;
  targetComponents: string[];
  reason: string;
  createdAt: string;
}

export interface TelemetryEvent {
  timestamp: string;
  source: string;
  component: string;
  key: string;
  value: string;
  unit: string;
  analyzed: boolean;
}

export interface CybersecuritySnapshot {
  generatedAt: string;
  backend: CybersecurityBackend;
  api: {
    generatedAt: string;
    component: {
      component_id: string;
      component_type: string;
      status: string;
      details: ComponentSummary;
      last_updated: string;
    };
    results: ServiceResult[];
  };
  readOnly: {
    generatedAt: string;
    summary: {
      total: number;
      ready: number;
      partial: number;
      stale: number;
      unavailable: number;
      warningSignals: number;
      criticalSignals: number;
    };
    adapters: AdapterResult[];
  };
  metrics: {
    generatedAt: string;
    summary: MetricsSummary;
    byPolicy: PolicyMetrics[];
  };
  telemetry?: {
    generatedAt: string;
    status: "streaming" | "waiting";
    mode: "near-real-time";
    topic: string;
    analyzedKeys: string[];
    summary: {
      visible: number;
      analyzed: number;
      collectedOnly: number;
    };
    events: TelemetryEvent[];
  };
  incidents: {
    generatedAt: string;
    summary: {
      totalIncidents: number;
      criticalIncidents: number;
      warningIncidents: number;
    };
    incidents: Incident[];
  };
  actions: {
    generatedAt: string;
    summary: {
      total: number;
      applied: number;
      recommended: number;
      failed: number;
      unsupported: number;
    };
    actions: DispatchAction[];
  };
}

export interface CybersecurityDashboardData {
  snapshot: CybersecuritySnapshot | null;
  error: string | null;
  fetchedAt: string;
}
