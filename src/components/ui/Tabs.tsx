import React from 'react';

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

export const Tabs: React.FC<TabsProps> = ({ defaultValue, value, onValueChange, children, className = '' }) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue || '');
    
    const activeTab = value !== undefined ? value : internalValue;
    const setActiveTab = onValueChange || setInternalValue;

    return (
        <TabsContext.Provider value={{ activeTab, setActiveTab }}>
            <div className={`flex flex-col ${className}`}>
                {children}
            </div>
        </TabsContext.Provider>
    );
};

export const TabsList: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
    return (
        <div className={`flex items-center gap-1 p-1 bg-surface/50 border border-border/50 rounded-lg w-fit ${className}`}>
            {children}
        </div>
    );
};

export const TabsTrigger: React.FC<{ value: string; children: React.ReactNode; className?: string }> = ({ value, children, className = '' }) => {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error('TabsTrigger must be used within Tabs');

    const isActive = context.activeTab === value;

    return (
        <button
            onClick={() => context.setActiveTab(value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                isActive 
                    ? 'bg-background text-foreground shadow-sm border border-border/50' 
                    : 'bg-transparent text-muted-foreground hover:text-foreground'
            } ${className}`}
        >
            {children}
        </button>
    );
};

export const TabsContent: React.FC<{ value: string; children: React.ReactNode; className?: string }> = ({ value, children, className = '' }) => {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error('TabsContent must be used within Tabs');

    if (context.activeTab !== value) return null;

    return (
        <div className={`focus-visible:outline-none ${className}`}>
            {children}
        </div>
    );
};
