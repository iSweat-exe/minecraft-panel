import React from 'react';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
    size?: number;
    className?: string;
    variant?: 'primary' | 'muted' | 'white' | 'current';
}

export const Spinner: React.FC<SpinnerProps> = ({ 
    size = 20, 
    className = '',
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
            className={`animate-spin ${variantClasses[variant]} ${className}`} 
        />
    );
};
