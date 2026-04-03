const client = require("prom-client");

function createMetricsRegistry(defaultLabels = {}) {
  const registry = new client.Registry();
  registry.setDefaultLabels(defaultLabels);
  client.collectDefaultMetrics({ register: registry });

  const httpRequestTotal = new client.Counter({
    name: "bot_keuangan_http_requests_total",
    help: "Total HTTP requests",
    labelNames: ["method", "route", "status"],
    registers: [registry]
  });

  const httpRequestDurationMs = new client.Histogram({
    name: "bot_keuangan_http_request_duration_ms",
    help: "HTTP request duration in milliseconds",
    labelNames: ["method", "route", "status"],
    buckets: [10, 50, 100, 250, 500, 1000, 3000, 5000],
    registers: [registry]
  });

  const appErrorsTotal = new client.Counter({
    name: "bot_keuangan_errors_total",
    help: "Total application errors",
    labelNames: ["scope", "code"],
    registers: [registry]
  });

  const commandUsageTotal = new client.Counter({
    name: "bot_keuangan_command_usage_total",
    help: "Total command usage observed by the API",
    labelNames: ["channel", "command"],
    registers: [registry]
  });

  const schedulerJobsTotal = new client.Counter({
    name: "bot_keuangan_scheduler_jobs_total",
    help: "Scheduler jobs by report type and status",
    labelNames: ["report_type", "status"],
    registers: [registry]
  });

  return {
    registry,
    metrics: {
      appErrorsTotal,
      commandUsageTotal,
      httpRequestDurationMs,
      httpRequestTotal,
      schedulerJobsTotal
    }
  };
}

module.exports = {
  createMetricsRegistry
};
