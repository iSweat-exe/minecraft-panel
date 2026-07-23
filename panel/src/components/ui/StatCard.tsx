import React from 'react';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';
import { Card } from './Card';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string;
    value: React.ReactNode;
    subvalue?: React.ReactNode;
    icon?: LucideIcon | React.ComponentType<{ size?: number; className?: string }>;
    variant?: 'default' | 'success' | 'warning' | 'danger';
    badge?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    subvalue,
    icon: Icon,
    variant = 'default',
    badge,
    className,
    ...props
}) => {
    const valueVariantClasses = {
        default: 'text-foreground',
        success: 'text-emerald-400',
        warning: 'text-amber-400',
        danger: 'text-rose-400',
    };

    return (
        <Card
            className={cn(
                'px-4 py-2.5 bg-surface border border-border rounded-lg flex items-center justify-between transition-all hover:border-border/80 shadow-sm',
                className
            )}
            {...props}
        >
            <div className="flex items-center justify-between w-full gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {title}
                    </span>
                    {badge}
                </div>

                <div className={cn('text-sm font-bold font-mono', valueVariantClasses[variant])}>
                    {value}
                </div>
            </div>
        </Card>
    );
};
