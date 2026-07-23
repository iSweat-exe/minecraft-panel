import React from 'react';
import { cn } from '../../lib/utils';

export type StatusType = 
    | 'online' 
    | 'running' 
    | 'offline' 
    | 'stopped' 
    | 'pending' 
    | 'restarting' 
    | 'warning' 
    | 'danger';

export interface StatusIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
    status: StatusType;
    label?: string;
    sublabel?: string;
    size?: 'sm' | 'md' | 'lg';
    pulse?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
    status,
    label,
    sublabel,
    size = 'md',
    pulse,
    className,
    ...props
}) => {
    const isPendingOrRestarting = status === 'pending' || status === 'restarting';
    const shouldPulse = pulse ?? isPendingOrRestarting;

    const dotSizes = {
        sm: 'w-2 h-2',
        md: 'w-2.5 h-2.5',
        lg: 'w-3.5 h-3.5',
    };

    const dotColors = {
        online: 'bg-emerald-500 shadow-emerald-500/50',
        running: 'bg-emerald-500 shadow-emerald-500/50',
        offline: 'bg-zinc-500',
        stopped: 'bg-zinc-500',
        pending: 'bg-amber-500 shadow-amber-500/50',
        restarting: 'bg-amber-500 shadow-amber-500/50',
        warning: 'bg-amber-500 shadow-amber-500/50',
        danger: 'bg-rose-500 shadow-rose-500/50',
    };

    const labelColors = {
        online: 'text-emerald-400',
        running: 'text-emerald-400',
        offline: 'text-muted-foreground',
        stopped: 'text-muted-foreground',
        pending: 'text-amber-400',
        restarting: 'text-amber-400',
        warning: 'text-amber-400',
        danger: 'text-rose-400',
    };

    return (
        <div className={cn('inline-flex items-center gap-2', className)} {...props}>
            <span
                className={cn(
                    'rounded-full shrink-0 transition-colors shadow-sm',
                    dotSizes[size],
                    dotColors[status],
                    shouldPulse && 'animate-pulse'
                )}
            />
            {(label || sublabel) && (
                <div className="flex flex-col">
                    {label && (
                        <span className={cn('text-xs font-semibold leading-none', labelColors[status])}>
                            {label}
                        </span>
                    )}
                    {sublabel && (
                        <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            {sublabel}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};
