import React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "danger" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        {
          "border-primary/20 bg-primary/10 text-primary": variant === "default",
          "border-success/20 bg-success/10 text-success": variant === "success",
          "border-warning/20 bg-warning/10 text-warning": variant === "warning",
          "border-danger/20 bg-danger/10 text-danger": variant === "danger",
          "border-border text-foreground": variant === "outline",
        },
        className
      )}
      {...props}
    />
  );
}
