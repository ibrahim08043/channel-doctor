import { Line } from "react-chartjs-2";
import {
  Chart,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
} from "chart.js";

Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

export default function ViewTrendChart({
  points,
}: {
  points: { date: string; views: number }[];
}) {
  return (
    <div className="h-64">
      <Line
        data={{
          labels: points.map((p) => p.date),
          datasets: [
            {
              data: points.map((p) => p.views),
              borderColor: "#a855f7",
              backgroundColor: "rgba(168, 85, 247, 0.15)",
              tension: 0.35,
              fill: true,
              pointRadius: 3,
              pointBackgroundColor: "#a855f7",
              pointBorderColor: "#0a0a0f",
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false } },
          scales: {
            x: {
              ticks: { color: "#a1a1aa", maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
              grid: { display: false },
            },
            y: {
              ticks: {
                color: "#a1a1aa",
                callback: (v) => {
                  const n = Number(v);
                  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
                  if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
                  return n;
                },
              },
              grid: { color: "rgba(255,255,255,0.05)" },
            },
          },
        }}
      />
    </div>
  );
}
