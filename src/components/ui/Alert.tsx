import React from 'react';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

export type AlertVariant = 'default' | 'success' | 'warning' | 'danger';

interface AlertProps {
    variant?: AlertVariant;
    title?: string;
    children: React.ReactNode;
    className?: string;
    icon?: boolean;
}

export const Alert: React.FC<AlertProps> = ({ 
    variant = 'default', 
    title, 
    children, 
    className = '',
    icon = true
}) => {
    const variants = {
        default: 'bg-primary/10 border-primary/20 text-foreground',
        success: 'bg-success/10 border-success/20 text-foreground',
        warning: 'bg-warning/10 border-warning/20 text-foreground',
        danger: 'bg-danger/10 border-danger/20 text-foreground',
    };

    const icons = {
        default: <Info size={18} className="text-primary" />,
        success: <CheckCircle size={18} className="text-success" />,
        warning: <AlertCircle size={18} className="text-warning" />,
        danger: <XCircle size={18} className="text-danger" />,
    };

    return (
        <div className={`p-4 rounded-xl border flex gap-3 ${variants[variant]} ${className}`}>
            {icon && (
                <div className="shrink-0 mt-0.5">
                    {icons[variant]}
                </div>
            )}
            <div className="flex flex-col gap-1 w-full">
                {title && <h5 className="font-semibold text-foreground">{title}</h5>}
                <div className={`text-sm ${title ? 'text-muted-foreground' : ''} leading-relaxed`}>
                    {children}
                </div>
            </div>
        </div>
    );
};
