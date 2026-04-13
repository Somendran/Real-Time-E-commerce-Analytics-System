"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { CustomerSegmentPoint } from "../lib/api";

type CustomerSegmentationChartProps = {
  data: CustomerSegmentPoint[];
};

const COLORS: Record<string, string> = {
  High: "#0f766e",
  Medium: "#2563eb",
  Low: "#be123c",
};

export default function CustomerSegmentationChart({ data }: CustomerSegmentationChartProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">Customer Segmentation</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-center">
        <div className="h-72 w-full sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="segment"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={105}
                paddingAngle={2}
              >
                {data.map((item) => (
                  <Cell key={item.segment} fill={COLORS[item.segment] ?? "#64748b"} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-2 text-sm text-slate-700">
          {data.map((item) => (
            <li key={item.segment} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-sm"
                  style={{ backgroundColor: COLORS[item.segment] ?? "#64748b" }}
                />
                {item.segment}
              </span>
              <span className="font-medium text-slate-900">
                {item.count.toLocaleString()}{" "}
                {total > 0 ? `(${Math.round((item.count / total) * 100)}%)` : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
