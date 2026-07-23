import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SpinnerProps {
    size?: number;
    className?: string;
    variant?: 'primary' | 'muted' | 'white' | 'current';
}

export const Spinner: React.FC<SpinnerProps> = ({ 
    size = 20, 
    className,
    variant = 'current'
}) => {
    const variantClasses = {
        primary: 'text-primary',
        muted: 'text-muted-foreground',
        white: 'text-white',
        current: 'text-current'
    };

    return (
        <Loader2 
            size={size} 
            className={cn('animate-spin', variantClasses[variant], className)} 
        />
    );
};
