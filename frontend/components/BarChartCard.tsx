"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type BarChartCardProps = {
  title: string;
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  yAxisLabel: string;
  fill: string;
};

export default function BarChartCard({
  title,
  data,
  xKey,
  yKey,
  yAxisLabel,
  fill,
}: BarChartCardProps) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-[0_12px_32px_rgba(19,27,46,0.05)] sm:p-6">
      <h2 className="text-lg font-bold text-[#131b2e]">{title}</h2>
      <div className="mt-4 h-72 w-full sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f2f3ff" />
            <XAxis
              dataKey={xKey}
              interval={0}
              minTickGap={12}
              tick={{ fill: "#45464d", fontSize: 12 }}
              tickMargin={10}
            />
            <YAxis tick={{ fill: "#45464d", fontSize: 12 }}>
              <Label
                value={yAxisLabel}
                angle={-90}
                position="insideLeft"
                style={{ fill: "#45464d", textAnchor: "middle" }}
              />
            </YAxis>
            <Tooltip
              contentStyle={{
                border: "none",
                borderRadius: 8,
                boxShadow: "0 12px 32px rgba(19,27,46,0.08)",
              }}
            />
            <Bar dataKey={yKey} fill={fill} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
