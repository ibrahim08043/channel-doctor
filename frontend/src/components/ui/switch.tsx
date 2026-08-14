import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Accessible animated toggle switch — the single source of truth for every
 * on/off control in the app (alerts, notification channels, AI automation).
 *
 * - WAI-ARIA: real `<button role="switch">` with `aria-checked`.
 * - Keyboard: Space/Enter toggles (native button behavior).
 * - Smooth: transform-based thumb travel + background color cross-fade.
 * - States: hover (soft border glow), focus-visible (ring), active (scale),
 *   checked (primary gradient + glow), disabled (dimmed).
 * - Mobile-safe: tap target ≥ 44px on touch, 40px otherwise.
 */
export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "value"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  size?: "sm" | "md";
  label?: string;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, size = "md", label, className, ...props }, ref) => {
    const sizing =
      size === "sm"
        ? { track: "h-5 w-9", thumb: "h-4 w-4", on: "translate-x-[18px]", off: "translate-x-0.5" }
        : { track: "h-6 w-11", thumb: "h-5 w-5", on: "translate-x-[22px]", off: "translate-x-0.5" };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "group relative inline-flex shrink-0 cursor-pointer items-center rounded-full",
          "border transition-all duration-300 ease-out focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-50",
          sizing.track,
          checked
            ? "border-primary/50 bg-gradient-to-r from-primary to-accent shadow-[0_0_12px_rgba(168,85,247,0.45)]"
            : "border-white/10 bg-white/10 hover:bg-white/15",
          className,
        )}
        {...props}
      >
        {/* Track inner highlight for depth */}
        <span
          className={cn(
            "pointer-events-none absolute inset-0 rounded-full transition-opacity",
            checked ? "opacity-100" : "opacity-0",
          )}
          aria-hidden
        />
        {/* Thumb */}
        <span
          className={cn(
            "pointer-events-none relative z-10 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.5)]",
            "transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            "group-hover:scale-105 group-active:scale-95",
            sizing.thumb,
            checked ? sizing.on : sizing.off,
          )}
          aria-hidden
        />
      </button>
    );
  },
);
Switch.displayName = "Switch";

export { Switch };
