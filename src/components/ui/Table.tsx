import React from 'react';

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
    ({ className = '', ...props }, ref) => (
        <div className="w-full overflow-auto custom-scrollbar">
            <table ref={ref} className={`w-full text-sm text-left text-foreground ${className}`} {...props} />
        </div>
    )
);
Table.displayName = 'Table';

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className = '', ...props }) => (
    <thead className={`text-xs uppercase text-muted-foreground bg-surface/50 border-b border-border ${className}`} {...props} />
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className = '', ...props }) => (
    <tbody className={`divide-y divide-border/50 ${className}`} {...props} />
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ className = '', ...props }) => (
    <tr className={`transition-colors hover:bg-surface-hover/50 ${className}`} {...props} />
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ className = '', ...props }) => (
    <th className={`px-4 py-3 font-medium tracking-wider ${className}`} {...props} />
);

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ className = '', ...props }) => (
    <td className={`px-4 py-3 whitespace-nowrap ${className}`} {...props} />
);
