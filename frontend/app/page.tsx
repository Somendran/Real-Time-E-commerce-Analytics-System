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
    <main className="min-h-screen bg-[#faf8ff] px-4 py-6 text-[#131b2e] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <nav className="mb-8 flex items-center justify-between rounded-lg bg-white/70 px-4 py-3 shadow-[0_12px_32px_rgba(19,27,46,0.04)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-[#131b2e] text-sm font-black text-white">
              BI
            </div>
            <span className="text-sm font-bold text-[#131b2e]">E-commerce Analytics</span>
          </div>
          <div className="hidden rounded-lg bg-[#f2f3ff] px-4 py-2 text-sm text-[#45464d] md:block">
            Live dashboard
          </div>
        </nav>

        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[#131b2e] sm:text-4xl">
              E-commerce Real-Time Analytics Dashboard
            </h1>
            <p className="mt-2 text-sm text-[#45464d]">
              Live operational metrics from the Olist streaming pipeline.
            </p>
          </div>
          <div className="rounded-lg bg-[#f2f3ff] px-4 py-2 text-sm font-medium text-[#45464d]">
            Last updated: {lastUpdated ? lastUpdated.toLocaleString() : "-"}
          </div>
        </header>

        {loading ? (
          <section className="rounded-lg bg-white p-6 text-[#45464d] shadow-[0_12px_32px_rgba(19,27,46,0.05)]">
            Loading dashboard data...
          </section>
        ) : null}

        {error ? (
          <section className="mb-6 rounded-lg bg-rose-50 p-4 text-sm text-rose-700 shadow-[0_12px_32px_rgba(19,27,46,0.04)]">
            Failed to load dashboard data: {error}
          </section>
        ) : null}

        <section className="mb-8 overflow-hidden rounded-lg bg-[#f2f3ff] p-4 shadow-[0_12px_32px_rgba(19,27,46,0.04)] sm:p-6">
          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#45464d]">Controls</p>
                <h2 className="mt-1 text-lg font-bold text-[#131b2e]">Dashboard Filters</h2>
                <p className="mt-1 text-sm text-[#45464d]">
                  Narrow the dashboard by time, category, location, or transaction value.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFilters({})}
                className="h-10 rounded-md bg-white px-4 text-sm font-bold text-[#131b2e] shadow-[0_8px_24px_rgba(19,27,46,0.05)] transition hover:bg-[#faf8ff]"
              >
                Reset
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {activeFilters.length === 0 ? (
                <span className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#45464d]">
                  Showing all available records
                </span>
              ) : (
                activeFilters.map((item) => (
                  <span
                    key={`${item.label}-${item.value}`}
                    className="rounded-md bg-[#6cf8bb] px-3 py-1.5 text-xs font-bold text-[#005236]"
                  >
                    {item.label}: {item.value}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#45464d]">
              Start Date
              <input
                type="date"
                value={filters.startDate ?? ""}
                min={filterOptions?.min_date || undefined}
                max={filterOptions?.max_date || undefined}
                onChange={(event) => updateFilter("startDate", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-[#c6c6cd]/20 bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#131b2e] shadow-none outline-none focus:border-[#006591] focus:ring-4 focus:ring-[#006591]/10"
              />
            </label>

            <label className="block text-xs font-bold uppercase tracking-wider text-[#45464d]">
              End Date
              <input
                type="date"
                value={filters.endDate ?? ""}
                min={filterOptions?.min_date || undefined}
                max={filterOptions?.max_date || undefined}
                onChange={(event) => updateFilter("endDate", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-[#c6c6cd]/20 bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#131b2e] shadow-none outline-none focus:border-[#006591] focus:ring-4 focus:ring-[#006591]/10"
              />
            </label>

            <label className="block text-xs font-bold uppercase tracking-wider text-[#45464d]">
              Product Category
              <select
                value={filters.category ?? ""}
                onChange={(event) => updateFilter("category", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-[#c6c6cd]/20 bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#131b2e] shadow-none outline-none focus:border-[#006591] focus:ring-4 focus:ring-[#006591]/10"
              >
                <option value="">All categories</option>
                {filterOptions?.categories.map((category) => (
                  <option key={category} value={category}>
                    {category.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-bold uppercase tracking-wider text-[#45464d]">
              Customer State
              <select
                value={filters.state ?? ""}
                onChange={(event) => updateFilter("state", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-[#c6c6cd]/20 bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#131b2e] shadow-none outline-none focus:border-[#006591] focus:ring-4 focus:ring-[#006591]/10"
              >
                <option value="">All states</option>
                {filterOptions?.states.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-bold uppercase tracking-wider text-[#45464d]">
              Min Revenue
              <input
                type="number"
                value={filters.minRevenue ?? ""}
                min={filterOptions?.min_revenue}
                max={filterOptions?.max_revenue}
                placeholder={filterOptions ? String(Math.floor(filterOptions.min_revenue)) : "0"}
                onChange={(event) => updateFilter("minRevenue", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-[#c6c6cd]/20 bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#131b2e] shadow-none outline-none focus:border-[#006591] focus:ring-4 focus:ring-[#006591]/10"
              />
            </label>

            <label className="block text-xs font-bold uppercase tracking-wider text-[#45464d]">
              Max Revenue
              <input
                type="number"
                value={filters.maxRevenue ?? ""}
                min={filterOptions?.min_revenue}
                max={filterOptions?.max_revenue}
                placeholder={filterOptions ? String(Math.ceil(filterOptions.max_revenue)) : "0"}
                onChange={(event) => updateFilter("maxRevenue", event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-[#c6c6cd]/20 bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#131b2e] shadow-none outline-none focus:border-[#006591] focus:ring-4 focus:ring-[#006591]/10"
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
            variant="dark"
            badge="Live"
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
            stroke="#006c49"
          />

          <LineChartCard
            title="Daily Orders"
            data={state.dailyOrders}
            xKey="date"
            yKey="count"
            yAxisLabel="Orders"
            stroke="#006591"
          />

          <div className="xl:col-span-2">
            <LineChartCard
              title="Data Growth (Cumulative Rows)"
              data={state.dataGrowth}
              xKey="date"
              yKey="total_rows"
              yAxisLabel="Cumulative Rows"
              stroke="#d40036"
            />
          </div>
        </section>

        <section className="mt-6">
          <AnomalyAlert anomalies={state.anomalies} loading={loading} error={anomalyError} />
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-black text-[#131b2e]">Business Intelligence</h2>
            {biError ? <p className="mt-1 text-sm text-amber-700">{biError}</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <BarChartCard
              title="Category Analysis"
              data={categoryChartData}
              xKey="category"
              yKey="revenue"
              yAxisLabel="Revenue"
              fill="#00a889"
            />

            <CustomerSegmentationChart data={state.customerSegmentation} />

            <BarChartCard
              title="Weekday Analysis"
              data={weekdayChartData}
              xKey="day"
              yKey="avg_revenue"
              yAxisLabel="Avg Revenue"
              fill="#006591"
            />

            <BarChartCard
              title="Geographic Analysis"
              data={geoChartData}
              xKey="state"
              yKey="revenue"
              yAxisLabel="Revenue"
              fill="#d40036"
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

            <section className="rounded-lg bg-[#f2f3ff] p-5 shadow-[0_12px_32px_rgba(19,27,46,0.04)] sm:p-6 xl:col-span-2">
              <h2 className="text-lg font-black text-[#131b2e]">Model Metrics</h2>
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
