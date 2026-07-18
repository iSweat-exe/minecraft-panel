import React from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { useServerOptions } from '../hooks/useServerOptions';
import { ServerHeaderCard } from './options/ServerHeaderCard';
import { PropertiesForm } from './options/PropertiesForm';

export const OptionsPanel: React.FC = () => {
    const {
        properties,
        serverIcon,
        loading,
        saving,
        updateProp,
        handleSave,
        fetchProperties
    } = useServerOptions();

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center text-zinc-500">
                <RefreshCw className="animate-spin mr-2" size={20} /> Chargement des options...
            </div>
        );
    }

    if (!properties) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-zinc-500">
                <p>Impossible de charger server.properties.</p>
                <button onClick={fetchProperties} className="mt-4 flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded">
                    <RefreshCw size={16} /> Réessayer
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-zinc-950 overflow-hidden relative">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                
                {/* Header Banner */}
                <ServerHeaderCard 
                    serverIcon={serverIcon}
                    properties={properties}
                    updateProp={updateProp}
                />

                <PropertiesForm 
                    properties={properties}
                    updateProp={updateProp}
                />
            </div>
            
            {/* Floating Save Button */}
            <div className="absolute bottom-6 right-6 z-50">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-full shadow-[0_0_15px_rgba(79,70,229,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? (
                        <RefreshCw size={18} className="animate-spin" />
                    ) : (
                        <Save size={18} />
                    )}
                    {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
            </div>
        </div>
    );
};
