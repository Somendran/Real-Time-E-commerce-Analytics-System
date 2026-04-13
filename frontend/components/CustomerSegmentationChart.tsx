"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { CustomerSegmentPoint } from "../lib/api";

type CustomerSegmentationChartProps = {
  data: CustomerSegmentPoint[];
};

const COLORS: Record<string, string> = {
  High: "#006c49",
  Medium: "#006591",
  Low: "#ff6b35",
};

export default function CustomerSegmentationChart({ data }: CustomerSegmentationChartProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="rounded-lg bg-white p-5 shadow-[0_12px_32px_rgba(19,27,46,0.05)] sm:p-6">
      <h2 className="text-lg font-bold text-[#131b2e]">Customer Segmentation</h2>
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
              <Tooltip
                contentStyle={{
                  border: "none",
                  borderRadius: 8,
                  boxShadow: "0 12px 32px rgba(19,27,46,0.08)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-3 text-sm text-[#45464d]">
          {data.map((item) => (
            <li key={item.segment} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-sm"
                  style={{ backgroundColor: COLORS[item.segment] ?? "#64748b" }}
                />
                {item.segment}
              </span>
              <span className="font-bold text-[#131b2e]">
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
