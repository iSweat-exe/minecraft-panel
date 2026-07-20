import React from "react";
import { cn } from "../../lib/utils";
import { Check } from "lucide-react";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <div className={cn("relative flex items-center justify-center w-4 h-4 shrink-0", className)}>
        <input
          type="checkbox"
          className="peer appearance-none m-0 w-full h-full rounded-[3px] border border-primary/50 bg-transparent checked:bg-primary checked:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 transition-colors cursor-pointer hover:border-primary"
          ref={ref}
          {...props}
        />
        <Check 
          size={12} 
          strokeWidth={4} 
          className="absolute inset-0 m-auto text-primary-foreground opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" 
        />
      </div>
    );
  }
);
Checkbox.displayName = "Checkbox";
