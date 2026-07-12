import { useListAlerts } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Loader2, AlertTriangle, AlertCircle, Info, Bell } from "lucide-react";

const sevConfig: Record<
  string,
  { Icon: typeof Info; color: string; bg: string; border: string }
> = {
  critical: { Icon: AlertCircle, color: "text-rose-300", bg: "bg-rose-500/10", border: "border-rose-500/30" },
  warning: { Icon: AlertTriangle, color: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  info: { Icon: Info, color: "text-cyan-300", bg: "bg-cyan-500/10", border: "border-cyan-500/30" },
};

export default function AlertsCard() {
  const { data, isLoading } = useListAlerts();
  return (
    <Card className="space-y-3 p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Bell className="h-4 w-4 text-primary" /> Growth alerts
      </h2>
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Scanning your channel…
        </div>
      )}
      {data?.alerts.map((a) => {
        const cfg = sevConfig[a.severity] ?? sevConfig.info;
        const Icon = cfg.Icon;
        return (
          <div key={a.id} className={`rounded-md border ${cfg.border} ${cfg.bg} p-3`}>
            <div className={`flex items-center gap-2 text-sm font-semibold ${cfg.color}`}>
              <Icon className="h-4 w-4" /> {a.title}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>
            <p className="mt-1 text-xs">→ {a.action}</p>
          </div>
        );
      })}
    </Card>
  );
}
