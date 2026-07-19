import React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "danger" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        {
          "border-transparent bg-primary text-primary-foreground hover:bg-primary-hover": variant === "default",
          "border-transparent bg-success text-white hover:bg-success/80": variant === "success",
          "border-transparent bg-warning text-white hover:bg-warning/80": variant === "warning",
          "border-transparent bg-danger text-white hover:bg-danger/80": variant === "danger",
          "text-foreground": variant === "outline",
        },
        className
      )}
      {...props}
    />
  );
}
