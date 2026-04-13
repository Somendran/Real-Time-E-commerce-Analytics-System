"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import AnomalyAlert from "../components/AnomalyAlert";
import BarChartCard from "../components/BarChartCard";
import CustomerSegmentationChart from "../components/CustomerSegmentationChart";
import InsightList from "../components/InsightList";
import KpiCard from "../components/KpiCard";
import LineChartCard from "../components/LineChartCard";
import PredictionCard from "../components/PredictionCard";
import PredictionDriversCard from "../components/PredictionDriversCard";
import {
  type Anomaly,
  type CategoryAnalysisPoint,
  type CustomerSegmentPoint,
  type DashboardFilters,
  type FilterOptions,
  type GeoAnalysisPoint,
  type GrowthPoint,
  type Insight,
  type ModelMetrics,
  type Metrics,
  type OrdersPoint,
  type Prediction,
  type PredictionExplanation,
  type Recommendation,
  type RevenuePoint,
  type WeekdayAnalysisPoint,
  getDashboardData,
  getFilterOptions,
} from "../lib/api";

type DashboardState = {
  metrics: Metrics | null;
  dailyRevenue: RevenuePoint[];
  dailyOrders: OrdersPoint[];
  dataGrowth: GrowthPoint[];
  prediction: Prediction | null;
  anomalies: Anomaly[];
  categoryAnalysis: CategoryAnalysisPoint[];
  customerSegmentation: CustomerSegmentPoint[];
  weekdayAnalysis: WeekdayAnalysisPoint[];
  insights: Insight[];
  recommendations: Recommendation[];
  geoAnalysis: GeoAnalysisPoint[];
  modelMetrics: ModelMetrics;
  predictionExplanation: PredictionExplanation;
};

const REFRESH_INTERVAL_MS = 30000;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_MODEL_METRICS: ModelMetrics = {
  model_type: null,
  model_version: null,
  features: [],
  mae: null,
  rmse: null,
  mape: null,
  baseline_mae: null,
  baseline_rmse: null,
  baseline_mape: null,
  baseline_improvement_pct: null,
  residual_std: null,
  training_rows: null,
  test_rows: null,
  last_trained_at: null,
};
const DEFAULT_PREDICTION_EXPLANATION: PredictionExplanation = {
  predicted_revenue: 0,
  top_features: [],
  global_feature_importance: [],
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState>({
    metrics: null,
    dailyRevenue: [],
    dailyOrders: [],
    dataGrowth: [],
    prediction: null,
    anomalies: [],
    categoryAnalysis: [],
    customerSegmentation: [],
    weekdayAnalysis: [],
    insights: [],
    recommendations: [],
    geoAnalysis: [],
    modelMetrics: DEFAULT_MODEL_METRICS,
    predictionExplanation: DEFAULT_PREDICTION_EXPLANATION,
  });
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [anomalyError, setAnomalyError] = useState<string | null>(null);
  const [biError, setBiError] = useState<string | null>(null);
  const [explanationError, setExplanationError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setError(null);
      const data = await getDashboardData(filters);
      setState(data);
      setLastUpdated(new Date());
      setPredictionError(data.predictionError);
      setAnomalyError(data.anomalyError);
      setBiError(data.biError);
      setExplanationError(data.explanationError);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown API error";
      setError(message);
      setPredictionError("Prediction endpoint temporarily unavailable");
      setAnomalyError("Anomaly endpoint temporarily unavailable");
      setBiError("BI insights temporarily unavailable");
      setExplanationError("Prediction explanation unavailable");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadDashboard();

    const intervalId = window.setInterval(() => {
      void loadDashboard();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadDashboard]);

  useEffect(() => {
    getFilterOptions()
      .then(setFilterOptions)
      .catch(() => setFilterOptions(null));
  }, []);

  const metrics = useMemo(
    () => ({
      totalOrders: state.metrics?.total_orders ?? 0,
      totalRevenue: state.metrics?.total_revenue ?? 0,
      predictedRevenue: state.prediction?.predicted_revenue ?? 0,
    }),
    [state.metrics, state.prediction],
  );

  const categoryChartData = useMemo(
    () =>
      state.categoryAnalysis.slice(0, 10).map((item) => ({
        category: item.category.replace(/_/g, " "),
        revenue: item.revenue,
      })),
    [state.categoryAnalysis],
  );

  const weekdayChartData = useMemo(
    () =>
      [...state.weekdayAnalysis]
        .sort((a, b) => a.day - b.day)
        .map((item) => ({
          day: WEEKDAY_LABELS[item.day] ?? String(item.day),
          avg_revenue: item.avg_revenue,
        })),
    [state.weekdayAnalysis],
  );

  const geoChartData = useMemo(
    () =>
      state.geoAnalysis.slice(0, 10).map((item, index) => ({
        state: index === 0 ? `${item.state} (Top)` : item.state,
        revenue: item.revenue,
      })),
    [state.geoAnalysis],
  );

  const insightItems = useMemo(
    () => state.insights.map((item) => ({ text: item.insight })),
    [state.insights],
  );

  const recommendationItems = useMemo(
    () => state.recommendations.map((item) => ({ text: item.recommendation })),
    [state.recommendations],
  );

  const activeFilters = useMemo(() => {
    const items: Array<{ label: string; value: string }> = [];

    if (filters.startDate) items.push({ label: "From", value: filters.startDate });
    if (filters.endDate) items.push({ label: "To", value: filters.endDate });
    if (filters.category) {
      items.push({ label: "Category", value: filters.category.replace(/_/g, " ") });
    }
    if (filters.state) items.push({ label: "State", value: filters.state });
    if (filters.minRevenue !== undefined) {
      items.push({ label: "Min revenue", value: formatCurrency(filters.minRevenue) });
    }
    if (filters.maxRevenue !== undefined) {
      items.push({ label: "Max revenue", value: formatCurrency(filters.maxRevenue) });
    }

    return items;
  }, [filters]);

  const updateFilter = (key: keyof DashboardFilters, value: string) => {
    setFilters((current) => {
      const next = { ...current };

      if (value === "") {
        delete next[key];
      } else if (key === "minRevenue" || key === "maxRevenue") {
        next[key] = Number(value);
      } else {
        next[key] = value;
      }

      return next;
    });
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              E-commerce Real-Time Analytics Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Live operational metrics from the Olist streaming pipeline.
            </p>
          </div>
          <div className="text-sm text-slate-500">
            Last updated: {lastUpdated ? lastUpdated.toLocaleString() : "-"}
          </div>
        </header>

        {loading ? (
          <section className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
            Loading dashboard data...
          </section>
        ) : null}

        {error ? (
          <section className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            Failed to load dashboard data: {error}
          </section>
        ) : null}

        <section className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-100 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Controls</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">Dashboard Filters</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Narrow the dashboard by time, category, location, or transaction value.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFilters({})}
                className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Reset
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {activeFilters.length === 0 ? (
                <span className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500">
                  Showing all available records
                </span>
              ) : (
                activeFilters.map((item) => (
                  <span
                    key={`${item.label}-${item.value}`}
                    className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800"
                  >
                    {item.label}: {item.value}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 md:grid-cols-2 xl:grid-cols-4">
            <label className="block text-sm font-semibold text-slate-700">
              Start Date
              <input
                type="date"
                value={filters.startDate ?? ""}
                min={filterOptions?.min_date || undefined}
                max={filterOptions?.max_date || undefined}
                onChange={(event) => updateFilter("startDate", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              End Date
              <input
                type="date"
                value={filters.endDate ?? ""}
                min={filterOptions?.min_date || undefined}
                max={filterOptions?.max_date || undefined}
                onChange={(event) => updateFilter("endDate", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Product Category
              <select
                value={filters.category ?? ""}
                onChange={(event) => updateFilter("category", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              >
                <option value="">All categories</option>
                {filterOptions?.categories.map((category) => (
                  <option key={category} value={category}>
                    {category.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Customer State
              <select
                value={filters.state ?? ""}
                onChange={(event) => updateFilter("state", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              >
                <option value="">All states</option>
                {filterOptions?.states.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Min Revenue
              <input
                type="number"
                value={filters.minRevenue ?? ""}
                min={filterOptions?.min_revenue}
                max={filterOptions?.max_revenue}
                placeholder={filterOptions ? String(Math.floor(filterOptions.min_revenue)) : "0"}
                onChange={(event) => updateFilter("minRevenue", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Max Revenue
              <input
                type="number"
                value={filters.maxRevenue ?? ""}
                min={filterOptions?.min_revenue}
                max={filterOptions?.max_revenue}
                placeholder={filterOptions ? String(Math.ceil(filterOptions.max_revenue)) : "0"}
                onChange={(event) => updateFilter("maxRevenue", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </label>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            title="Total Orders"
            value={new Intl.NumberFormat("en-US").format(metrics.totalOrders)}
            subtitle="Filtered rows currently available in orders_clean"
          />
          <KpiCard
            title="Total Revenue"
            value={formatCurrency(metrics.totalRevenue)}
            subtitle="Filtered payment_value from loaded batches"
          />
          <PredictionCard
            value={metrics.predictedRevenue}
            lowerBound={state.prediction?.lower_bound}
            upperBound={state.prediction?.upper_bound}
            loading={loading}
            error={predictionError}
          />
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <LineChartCard
            title="Daily Revenue"
            data={state.dailyRevenue}
            xKey="date"
            yKey="revenue"
            yAxisLabel="Revenue"
            stroke="#0f766e"
          />

          <LineChartCard
            title="Daily Orders"
            data={state.dailyOrders}
            xKey="date"
            yKey="count"
            yAxisLabel="Orders"
            stroke="#1d4ed8"
          />

          <div className="xl:col-span-2">
            <LineChartCard
              title="Data Growth (Cumulative Rows)"
              data={state.dataGrowth}
              xKey="date"
              yKey="total_rows"
              yAxisLabel="Cumulative Rows"
              stroke="#be123c"
            />
          </div>
        </section>

        <section className="mt-6">
          <AnomalyAlert anomalies={state.anomalies} loading={loading} error={anomalyError} />
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Business Intelligence</h2>
            {biError ? <p className="mt-1 text-sm text-amber-700">{biError}</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <BarChartCard
              title="Category Analysis"
              data={categoryChartData}
              xKey="category"
              yKey="revenue"
              yAxisLabel="Revenue"
              fill="#0f766e"
            />

            <CustomerSegmentationChart data={state.customerSegmentation} />

            <BarChartCard
              title="Weekday Analysis"
              data={weekdayChartData}
              xKey="day"
              yKey="avg_revenue"
              yAxisLabel="Avg Revenue"
              fill="#2563eb"
            />

            <BarChartCard
              title="Geographic Analysis"
              data={geoChartData}
              xKey="state"
              yKey="revenue"
              yAxisLabel="Revenue"
              fill="#be123c"
            />

            <InsightList
              title="Key Insights"
              items={insightItems}
              emptyMessage="No insights available yet ⚠️"
            />

            <InsightList
              title="Recommendations"
              items={recommendationItems}
              emptyMessage="No recommendations available yet ⚠️"
            />

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6 xl:col-span-2">
              <h2 className="text-lg font-semibold text-slate-900">Model Metrics</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  title="MAE"
                  value={state.modelMetrics.mae === null ? "-" : formatCurrency(state.modelMetrics.mae)}
                />
                <KpiCard
                  title="RMSE"
                  value={state.modelMetrics.rmse === null ? "-" : formatCurrency(state.modelMetrics.rmse)}
                />
                <KpiCard
                  title="MAPE"
                  value={state.modelMetrics.mape === null ? "-" : `${state.modelMetrics.mape.toFixed(2)}%`}
                />
                <KpiCard
                  title="Baseline Improvement"
                  value={
                    state.modelMetrics.baseline_improvement_pct === null ||
                    state.modelMetrics.baseline_improvement_pct === undefined
                      ? "-"
                      : `${state.modelMetrics.baseline_improvement_pct.toFixed(2)}%`
                  }
                />
                <KpiCard
                  title="Training Rows"
                  value={
                    state.modelMetrics.training_rows === null ||
                    state.modelMetrics.training_rows === undefined
                      ? "-"
                      : state.modelMetrics.training_rows.toLocaleString()
                  }
                />
                <KpiCard
                  title="Test Rows"
                  value={
                    state.modelMetrics.test_rows === null ||
                    state.modelMetrics.test_rows === undefined
                      ? "-"
                      : state.modelMetrics.test_rows.toLocaleString()
                  }
                />
                <KpiCard
                  title="Features"
                  value={String(state.modelMetrics.features?.length ?? 0)}
                />
                <KpiCard
                  title="Last Trained"
                  value={
                    state.modelMetrics.last_trained_at
                      ? new Date(state.modelMetrics.last_trained_at).toLocaleDateString()
                      : "-"
                  }
                />
              </div>
            </section>

            <PredictionDriversCard
              drivers={state.predictionExplanation.top_features}
              globalImportance={state.predictionExplanation.global_feature_importance}
              error={explanationError}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
