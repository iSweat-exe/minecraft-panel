import React from 'react';
import { cn } from '../../lib/utils';

interface TabsContextValue {
    activeTab: string;
    setActiveTab: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

interface TabsProps {
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
    className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ defaultValue, value, onValueChange, children, className }) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue || '');
    
    const activeTab = value !== undefined ? value : internalValue;
    const setActiveTab = onValueChange || setInternalValue;

    return (
        <TabsContext.Provider value={{ activeTab, setActiveTab }}>
            <div className={cn('flex flex-col', className)}>
                {children}
            </div>
        </TabsContext.Provider>
    );
};

export const TabsList: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
    const context = React.useContext(TabsContext);
    const listRef = React.useRef<HTMLDivElement>(null);
    const [indicatorStyle, setIndicatorStyle] = React.useState<{ left: number; width: number; top: number; height: number; opacity: number }>({
        left: 0,
        width: 0,
        top: 0,
        height: 0,
        opacity: 0,
    });

    const updateIndicator = React.useCallback(() => {
        if (!listRef.current || !context?.activeTab) return;
        
        // Escape special characters in activeTab for querySelector
        const safeValue = context.activeTab.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const activeNode = listRef.current.querySelector<HTMLElement>(`[data-tab-value="${safeValue}"]`);
        
        if (activeNode) {
            setIndicatorStyle({
                left: activeNode.offsetLeft,
                width: activeNode.offsetWidth,
                top: activeNode.offsetTop,
                height: activeNode.offsetHeight,
                opacity: 1,
            });
        }
    }, [context?.activeTab]);

    React.useLayoutEffect(() => {
        updateIndicator();
        const handleResize = () => updateIndicator();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [updateIndicator, children]);

    return (
        <div 
            ref={listRef} 
            className={cn('relative inline-flex items-center gap-1 p-1 bg-surface/80 border border-border rounded-lg w-fit select-none', className)}
        >
            {/* Smooth Sliding Active Pill Indicator */}
            <div 
                className="absolute bg-background rounded-md border border-border/80 shadow-sm transition-all duration-300 ease-out pointer-events-none z-0"
                style={{
                    left: `${indicatorStyle.left}px`,
                    width: `${indicatorStyle.width}px`,
                    top: `${indicatorStyle.top}px`,
                    height: `${indicatorStyle.height}px`,
                    opacity: indicatorStyle.opacity,
                }}
            />
            {children}
        </div>
    );
};

export const TabsTrigger: React.FC<{ value: string; children: React.ReactNode; className?: string }> = ({ value, children, className }) => {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error('TabsTrigger must be used within Tabs');

    const isActive = context.activeTab === value;

    return (
        <button
            type="button"
            data-tab-value={value}
            onClick={() => context.setActiveTab(value)}
            className={cn(
                'relative z-10 inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors duration-200 cursor-pointer whitespace-nowrap active:scale-[0.97]',
                isActive 
                    ? 'text-foreground font-bold' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover/30',
                className
            )}
        >
            {children}
        </button>
    );
};

export const TabsContent: React.FC<{ value: string; children: React.ReactNode; className?: string }> = ({ value, children, className }) => {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error('TabsContent must be used within Tabs');

    if (context.activeTab !== value) return null;

    return (
        <div className={cn('focus-visible:outline-none animate-in fade-in duration-200', className)}>
            {children}
        </div>
    );
};
