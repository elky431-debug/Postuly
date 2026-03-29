"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Period = "7j" | "30j";

type CampaignChartProps = {
  period: Period;
  values?: number[];
  labels?: string[];
};

const DEFAULT_7 = [0, 0, 0, 0, 0, 0, 0];
const DEFAULT_30 = [0, 0, 0, 0];

const ORANGE = "#F97316";
const GRID = "#E5E7EB";

/** Histogramme — fond clair. */
export function CampaignChart({ period, values, labels: labelsProp }: CampaignChartProps) {
  const defaultLabels =
    period === "7j" ? ["L", "M", "M", "J", "V", "S", "D"] : ["S1", "S2", "S3", "S4"];
  const labels = labelsProp?.length ? labelsProp : defaultLabels;
  const base = period === "7j" ? DEFAULT_7 : DEFAULT_30;
  const heights = values && values.length === labels.length ? values : base;
  const data = labels.map((name, i) => ({
    name,
    v: heights[i] ?? 0,
  }));

  return (
    <div className="h-[140px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#737373" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide domain={[0, "auto"]} />
          <Tooltip
            cursor={{ fill: "rgba(249, 115, 22, 0.08)" }}
            formatter={(v) => [String(v ?? 0), "Candidatures"]}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              backgroundColor: "#FFFFFF",
              color: "#171717",
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            }}
            labelStyle={{ color: "#737373" }}
          />
          <Bar
            dataKey="v"
            radius={[4, 4, 0, 0]}
            fill={ORANGE}
            fillOpacity={0.35}
            activeBar={{ fill: ORANGE, fillOpacity: 1 }}
            maxBarSize={36}
            isAnimationActive
            animationDuration={500}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
