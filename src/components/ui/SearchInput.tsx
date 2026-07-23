import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    value: string;
    onChange: (value: string) => void;
    onClear?: () => void;
    inputClassName?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
    value,
    onChange,
    onClear,
    placeholder = 'Rechercher...',
    className,
    inputClassName,
    ...props
}) => {
    const handleClear = () => {
        onChange('');
        if (onClear) onClear();
    };

    return (
        <div className={cn('relative flex-1', className)}>
            <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none"
            />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={cn(
                    'w-full pl-9 pr-9 py-2 bg-surface/60 border border-border/80 rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors',
                    inputClassName
                )}
                {...props}
            />
            {value && (
                <button
                    type="button"
                    onClick={handleClear}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-md transition-all group"
                    title="Effacer la recherche"
                >
                    <X size={14} className="transition-transform duration-300 group-hover:rotate-180" />
                </button>
            )}
        </div>
    );
};
