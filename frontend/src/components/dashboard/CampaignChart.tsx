"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

type Period = "7j" | "30j";

type CampaignChartProps = {
  period: Period;
  /** Valeurs par barre (ex. candidatures par jour) */
  values?: number[];
  /** Libellés axe X (ex. jours réels des 7 derniers jours) */
  labels?: string[];
};

const DEFAULT_7 = [0, 0, 0, 0, 0, 0, 0];
const DEFAULT_30 = [0, 0, 0, 0];

/**
 * Histogramme (Recharts) : barres orange-200, survol orange-400.
 */
export function CampaignChart({ period, values, labels: labelsProp }: CampaignChartProps) {
  const defaultLabels =
    period === "7j" ? ["L", "M", "M", "J", "V", "S", "D"] : ["S1", "S2", "S3", "S4"];
  const labels = labelsProp?.length ? labelsProp : defaultLabels;
  const base = period === "7j" ? DEFAULT_7 : DEFAULT_30;
  const heights =
    values && values.length === labels.length ? values : base;
  const data = labels.map((name, i) => ({
    name,
    v: heights[i] ?? 0,
  }));

  return (
    <div className="h-[120px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 2 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "#78716C" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(249, 115, 22, 0.06)" }}
            formatter={(v) => [String(v ?? 0), "Candidatures"]}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #E7E5E4",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          />
          <Bar
            dataKey="v"
            radius={[4, 4, 0, 0]}
            fill="#FED7AA"
            activeBar={{ fill: "#FB923C" }}
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
