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

export type ModelMetrics = {
  mae: number | null;
  rmse: number | null;
  mape: number | null;
  last_trained_at: string | null;
};

export type Anomaly = {
  date: string;
  revenue: number;
  z_score: number;
};

export type CategoryAnalysisPoint = {
  category: string;
  revenue: number;
};

export type CustomerSegmentPoint = {
  segment: "High" | "Medium" | "Low" | string;
  count: number;
};

export type WeekdayAnalysisPoint = {
  day: number;
  avg_revenue: number;
};

export type Insight = {
  insight: string;
};

export type Recommendation = {
  recommendation: string;
};

export type GeoAnalysisPoint = {
  state: string;
  revenue: number;
};

export type DashboardFilters = {
  startDate?: string;
  endDate?: string;
  category?: string;
  state?: string;
  minRevenue?: number;
  maxRevenue?: number;
};

export type FilterOptions = {
  min_date: string;
  max_date: string;
  min_revenue: number;
  max_revenue: number;
  categories: string[];
  states: string[];
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

function buildQuery(filters: DashboardFilters = {}): string {
  const params = new URLSearchParams();

  if (filters.startDate) params.set("start_date", filters.startDate);
  if (filters.endDate) params.set("end_date", filters.endDate);
  if (filters.category) params.set("category", filters.category);
  if (filters.state) params.set("state", filters.state);
  if (filters.minRevenue !== undefined) params.set("min_revenue", String(filters.minRevenue));
  if (filters.maxRevenue !== undefined) params.set("max_revenue", String(filters.maxRevenue));

  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function getMetrics(filters: DashboardFilters = {}): Promise<Metrics> {
  const payload = await fetchJson<{
    data: { total_orders: number; total_revenue: number };
  }>(`/metrics${buildQuery(filters)}`);

  return {
    total_orders: Number(payload.data.total_orders ?? 0),
    total_revenue: Number(payload.data.total_revenue ?? 0),
  };
}

export async function getDailyRevenue(filters: DashboardFilters = {}): Promise<RevenuePoint[]> {
  const payload = await fetchJson<{
    data: Array<{ date: string; total_revenue?: number; revenue?: number }>;
  }>(`/daily-revenue${buildQuery(filters)}`);

  return payload.data.map((row) => ({
    date: row.date,
    revenue: Number(row.total_revenue ?? row.revenue ?? 0),
  }));
}

export async function getDailyOrders(filters: DashboardFilters = {}): Promise<OrdersPoint[]> {
  const payload = await fetchJson<{
    data: Array<{ date: string; order_count?: number; count?: number }>;
  }>(`/daily-orders${buildQuery(filters)}`);

  return payload.data.map((row) => ({
    date: row.date,
    count: Number(row.order_count ?? row.count ?? 0),
  }));
}

export async function getDataGrowth(filters: DashboardFilters = {}): Promise<GrowthPoint[]> {
  const payload = await fetchJson<{
    data: Array<{ date: string; cumulative_orders?: number; total_rows?: number }>;
  }>(`/data-growth${buildQuery(filters)}`);

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

export async function getModelMetrics(): Promise<ModelMetrics> {
  return fetchJson<ModelMetrics>("/model-metrics");
}

export async function getCategoryAnalysis(filters: DashboardFilters = {}): Promise<CategoryAnalysisPoint[]> {
  const payload = await fetchJson<Array<{ category: string; revenue: number }>>(
    `/category-analysis${buildQuery(filters)}`,
  );

  return payload.map((row) => ({
    category: row.category,
    revenue: Number(row.revenue ?? 0),
  }));
}

export async function getCustomerSegmentation(filters: DashboardFilters = {}): Promise<CustomerSegmentPoint[]> {
  const payload = await fetchJson<Array<{ segment: string; count: number }>>(
    `/customer-segmentation${buildQuery(filters)}`,
  );

  return payload.map((row) => ({
    segment: row.segment,
    count: Number(row.count ?? 0),
  }));
}

export async function getWeekdayAnalysis(filters: DashboardFilters = {}): Promise<WeekdayAnalysisPoint[]> {
  const payload = await fetchJson<Array<{ day: number; avg_revenue: number }>>(
    `/weekday-analysis${buildQuery(filters)}`,
  );

  return payload.map((row) => ({
    day: Number(row.day),
    avg_revenue: Number(row.avg_revenue ?? 0),
  }));
}

export async function getInsights(filters: DashboardFilters = {}): Promise<Insight[]> {
  return fetchJson<Insight[]>(`/insights${buildQuery(filters)}`);
}

export async function getRecommendations(filters: DashboardFilters = {}): Promise<Recommendation[]> {
  return fetchJson<Recommendation[]>(`/recommendations${buildQuery(filters)}`);
}

export async function getGeoAnalysis(filters: DashboardFilters = {}): Promise<GeoAnalysisPoint[]> {
  const payload = await fetchJson<Array<{ state: string; revenue: number }>>(
    `/geo-analysis${buildQuery(filters)}`,
  );

  return payload.map((row) => ({
    state: row.state,
    revenue: Number(row.revenue ?? 0),
  }));
}

export async function getFilterOptions(): Promise<FilterOptions> {
  const payload = await fetchJson<FilterOptions>("/filter-options");

  return {
    ...payload,
    min_revenue: Number(payload.min_revenue ?? 0),
    max_revenue: Number(payload.max_revenue ?? 0),
    categories: payload.categories ?? [],
    states: payload.states ?? [],
  };
}

export async function getDashboardData(filters: DashboardFilters = {}) {
  const [
    metrics,
    dailyRevenue,
    dailyOrders,
    dataGrowth,
    predictionResult,
    anomaliesResult,
    categoryAnalysisResult,
    customerSegmentationResult,
    weekdayAnalysisResult,
    insightsResult,
    recommendationsResult,
    geoAnalysisResult,
    modelMetricsResult,
  ] = await Promise.allSettled([
    getMetrics(filters),
    getDailyRevenue(filters),
    getDailyOrders(filters),
    getDataGrowth(filters),
    getPrediction(),
    getAnomalies(),
    getCategoryAnalysis(filters),
    getCustomerSegmentation(filters),
    getWeekdayAnalysis(filters),
    getInsights(filters),
    getRecommendations(filters),
    getGeoAnalysis(filters),
    getModelMetrics(),
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
    categoryAnalysis: categoryAnalysisResult.status === "fulfilled" ? categoryAnalysisResult.value : [],
    customerSegmentation:
      customerSegmentationResult.status === "fulfilled" ? customerSegmentationResult.value : [],
    weekdayAnalysis: weekdayAnalysisResult.status === "fulfilled" ? weekdayAnalysisResult.value : [],
    insights: insightsResult.status === "fulfilled" ? insightsResult.value : [],
    recommendations:
      recommendationsResult.status === "fulfilled" ? recommendationsResult.value : [],
    geoAnalysis: geoAnalysisResult.status === "fulfilled" ? geoAnalysisResult.value : [],
    modelMetrics:
      modelMetricsResult.status === "fulfilled"
        ? modelMetricsResult.value
        : { mae: null, rmse: null, mape: null, last_trained_at: null },
    predictionError:
      predictionResult.status === "rejected"
        ? "Prediction service unavailable"
        : null,
    anomalyError:
      anomaliesResult.status === "rejected"
        ? "Anomaly service unavailable"
        : null,
    biError:
      categoryAnalysisResult.status === "rejected" ||
      customerSegmentationResult.status === "rejected" ||
      weekdayAnalysisResult.status === "rejected" ||
      insightsResult.status === "rejected" ||
      recommendationsResult.status === "rejected" ||
      geoAnalysisResult.status === "rejected"
        ? "Some BI insights are temporarily unavailable"
        : null,
  };
}
