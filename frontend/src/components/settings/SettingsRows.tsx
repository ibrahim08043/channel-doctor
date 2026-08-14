import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * A single settings row: label + description on the left, control on the right.
 * Used by the Alerts, AI automation, and notification-channel groups. Fully
 * responsive (stacked on mobile, row on sm+).
 */
export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  icon: Icon,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-white/3 px-3.5 py-3 transition-colors hover:bg-white/5 sm:items-center sm:gap-4">
      <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
        {Icon && (
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/5 text-muted-foreground sm:mt-0">
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium leading-snug">{label}</div>
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        label={label}
        size="sm"
        className="shrink-0"
      />
    </div>
  );
}

/** Card group header with an icon + accent color. */
export function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("grid h-8 w-8 place-items-center rounded-lg border", accent)}>
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="font-semibold leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
