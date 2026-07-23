import React from 'react';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
    icon?: LucideIcon | React.ComponentType<{ size?: number; className?: string }>;
    title: string;
    description?: React.ReactNode;
    action?: React.ReactNode;
    compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    action,
    compact = false,
    className,
    ...props
}) => {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center text-center p-8 rounded-xl text-muted-foreground',
                compact ? 'py-6 gap-2' : 'py-12 gap-3',
                className
            )}
            {...props}
        >
            {Icon && (
                <div className="p-3.5 bg-surface/80 rounded-2xl border border-border/60 text-muted-foreground/80 mb-1 shadow-md">
                    <Icon size={compact ? 24 : 32} strokeWidth={1.5} />
                </div>
            )}
            <div className="space-y-1 max-w-md">
                <h3 className={cn('font-semibold text-foreground tracking-tight', compact ? 'text-sm' : 'text-base')}>
                    {title}
                </h3>
                {description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {description}
                    </p>
                )}
            </div>
            {action && <div className="mt-3">{action}</div>}
        </div>
    );
};
