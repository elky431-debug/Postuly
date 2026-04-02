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

export type ChartPeriod = "hier" | "semaine" | "mois" | "annee";

type CampaignChartProps = {
  period: ChartPeriod;
  values?: number[];
  labels?: string[];
};

const ORANGE = "#F97316";
const GRID = "#F1F0EE";

export function CampaignChart({ period, values, labels: labelsProp }: CampaignChartProps) {
  const defaults: Record<ChartPeriod, { labels: string[]; count: number }> = {
    hier:    { labels: ["0h","2h","4h","6h","8h","10h","12h","14h","16h","18h","20h","22h"], count: 12 },
    semaine: { labels: ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"], count: 7 },
    mois:    { labels: Array.from({ length: 30 }, (_, i) => String(i + 1)), count: 30 },
    annee:   { labels: ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"], count: 12 },
  };

  const def = defaults[period];
  const labels = labelsProp?.length === def.count ? labelsProp : def.labels;
  const heights = values?.length === def.count ? values : Array(def.count).fill(0);
  const data = labels.map((name, i) => ({ name, v: heights[i] ?? 0 }));

  const showEveryN = period === "mois" ? 5 : 1;

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="40%">
          <CartesianGrid strokeDasharray="2 4" stroke={GRID} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#A8A29E" }}
            axisLine={false}
            tickLine={false}
            interval={showEveryN - 1}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#A8A29E" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(249, 115, 22, 0.06)", radius: 4 }}
            formatter={(v) => [String(v ?? 0), "Candidatures"]}
            contentStyle={{
              fontSize: 12,
              fontFamily: "var(--font-geist-sans)",
              borderRadius: 10,
              border: "1px solid #E7E5E4",
              backgroundColor: "#FFFFFF",
              color: "#1C1917",
              boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
              padding: "8px 12px",
            }}
            labelStyle={{ color: "#78716C", marginBottom: 2 }}
          />
          <Bar
            dataKey="v"
            radius={[5, 5, 0, 0]}
            fill={ORANGE}
            fillOpacity={0.8}
            activeBar={{ fill: ORANGE, fillOpacity: 1 }}
            maxBarSize={period === "mois" ? 16 : period === "hier" ? 24 : 32}
            isAnimationActive
            animationDuration={400}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
