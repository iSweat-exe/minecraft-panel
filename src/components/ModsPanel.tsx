import React from 'react';

export const ModsPanel: React.FC = () => {
    return (
        <div className="flex flex-col h-full overflow-hidden bg-surface rounded-lg border border-border">
            <div className="p-6">
                <h1 className="text-2xl font-bold">Mods</h1>
                <p className="text-muted-foreground mt-2">Recherchez et installez des mods (via Modrinth).</p>
            </div>
        </div>
    );
};
