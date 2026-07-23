import React from 'react';
import { cn } from '../../lib/utils';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
    value: number;
    max?: number;
    variant?: 'default' | 'success' | 'warning' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    label?: string;
    sublabel?: string;
    animated?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
    value,
    max = 100,
    variant = 'default',
    size = 'md',
    showLabel = false,
    label,
    sublabel,
    animated = false,
    className,
    ...props
}) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    const sizeClasses = {
        sm: 'h-1.5',
        md: 'h-2.5',
        lg: 'h-4',
    };

    const variantTrackClasses = {
        default: 'bg-surface-hover/60 border-border/40',
        success: 'bg-success/20 border-success/30',
        warning: 'bg-warning/20 border-warning/30',
        danger: 'bg-danger/20 border-danger/30',
    };

    const variantBarClasses = {
        default: 'bg-primary',
        success: 'bg-success',
        warning: 'bg-warning',
        danger: 'bg-danger',
    };

    return (
        <div className={cn('w-full flex flex-col gap-1.5', className)} {...props}>
            {(showLabel || label || sublabel) && (
                <div className="flex justify-between items-center text-xs font-medium">
                    {label ? (
                        <span className="text-foreground/90 truncate">{label}</span>
                    ) : (
                        <span />
                    )}
                    {showLabel && (
                        <span className="font-bold font-mono text-foreground/80">{Math.round(percentage)}%</span>
                    )}
                </div>
            )}

            <div
                className={cn(
                    'w-full rounded-full overflow-hidden border transition-colors',
                    sizeClasses[size],
                    variantTrackClasses[variant]
                )}
            >
                <div
                    className={cn(
                        'h-full transition-all duration-300 rounded-full',
                        variantBarClasses[variant],
                        animated && 'animate-pulse'
                    )}
                    style={{ width: `${percentage}%` }}
                />
            </div>

            {sublabel && (
                <div className="text-[11px] text-muted-foreground">{sublabel}</div>
            )}
        </div>
    );
};
