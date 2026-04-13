export type Metrics = {
  total_orders: number;
  total_revenue: number;
};

export type RevenuePoint = {
  date: string;
  revenue: number;
};

export type OrdersPoint = {
  date: string;
  count: number;
};

export type GrowthPoint = {
  date: string;
  total_rows: number;
};

export type Prediction = {
  predicted_revenue: number;
};

export type Anomaly = {
  date: string;
  revenue: number;
  z_score: number;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${path} failed (${response.status}): ${body}`);
  }

  return (await response.json()) as T;
}

export async function getMetrics(): Promise<Metrics> {
  const payload = await fetchJson<{
    data: { total_orders: number; total_revenue: number };
  }>("/metrics");

  return {
    total_orders: Number(payload.data.total_orders ?? 0),
    total_revenue: Number(payload.data.total_revenue ?? 0),
  };
}

export async function getDailyRevenue(): Promise<RevenuePoint[]> {
  const payload = await fetchJson<{
    data: Array<{ date: string; total_revenue?: number; revenue?: number }>;
  }>("/daily-revenue");

  return payload.data.map((row) => ({
    date: row.date,
    revenue: Number(row.total_revenue ?? row.revenue ?? 0),
  }));
}

export async function getDailyOrders(): Promise<OrdersPoint[]> {
  const payload = await fetchJson<{
    data: Array<{ date: string; order_count?: number; count?: number }>;
  }>("/daily-orders");

  return payload.data.map((row) => ({
    date: row.date,
    count: Number(row.order_count ?? row.count ?? 0),
  }));
}

export async function getDataGrowth(): Promise<GrowthPoint[]> {
  const payload = await fetchJson<{
    data: Array<{ date: string; cumulative_orders?: number; total_rows?: number }>;
  }>("/data-growth");

  return payload.data.map((row) => ({
    date: row.date,
    total_rows: Number(row.cumulative_orders ?? row.total_rows ?? 0),
  }));
}

export async function getPrediction(): Promise<Prediction> {
  const payload = await fetchJson<{ predicted_revenue?: number; data?: { predicted_revenue?: number } }>(
    "/prediction",
  );

  return {
    predicted_revenue: Number(payload.predicted_revenue ?? payload.data?.predicted_revenue ?? 0),
  };
}

export async function getAnomalies(): Promise<Anomaly[]> {
  const payload = await fetchJson<
    { anomalies?: Array<{ date: string; revenue: number; z_score: number }>; data?: Array<{ date: string; revenue: number; z_score: number }> } | Array<{ date: string; revenue: number; z_score: number }>
  >("/anomalies");

  const rows = Array.isArray(payload)
    ? payload
    : payload.anomalies ?? payload.data ?? [];

  return rows.map((row) => ({
    date: row.date,
    revenue: Number(row.revenue ?? 0),
    z_score: Number(row.z_score ?? 0),
  }));
}

export async function getDashboardData() {
  const [metrics, dailyRevenue, dailyOrders, dataGrowth, predictionResult, anomaliesResult] = await Promise.allSettled([
    getMetrics(),
    getDailyRevenue(),
    getDailyOrders(),
    getDataGrowth(),
    getPrediction(),
    getAnomalies(),
  ]);

  if (metrics.status !== "fulfilled") {
    throw metrics.reason;
  }
  if (dailyRevenue.status !== "fulfilled") {
    throw dailyRevenue.reason;
  }
  if (dailyOrders.status !== "fulfilled") {
    throw dailyOrders.reason;
  }
  if (dataGrowth.status !== "fulfilled") {
    throw dataGrowth.reason;
  }

  return {
    metrics: metrics.value,
    dailyRevenue: dailyRevenue.value,
    dailyOrders: dailyOrders.value,
    dataGrowth: dataGrowth.value,
    prediction: predictionResult.status === "fulfilled" ? predictionResult.value : { predicted_revenue: 0 },
    anomalies: anomaliesResult.status === "fulfilled" ? anomaliesResult.value : [],
    predictionError:
      predictionResult.status === "rejected"
        ? "Prediction service unavailable"
        : null,
    anomalyError:
      anomaliesResult.status === "rejected"
        ? "Anomaly service unavailable"
        : null,
  };
}
