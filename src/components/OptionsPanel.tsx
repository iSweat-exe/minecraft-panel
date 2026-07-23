import React from 'react';
import { RefreshCw, Save, Check } from 'lucide-react';
import { useServerOptions } from '../hooks/useServerOptions';
import { ServerHeaderCard } from './options/ServerHeaderCard';
import { PropertiesForm } from './options/PropertiesForm';
import { Button } from './ui/Button';

export const OptionsPanel: React.FC = () => {
    const {
        properties,
        serverIcon,
        loading,
        saving,
        savedSuccess,
        updateProp,
        handleSave,
        fetchProperties
    } = useServerOptions();

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground bg-background">
                <RefreshCw className="animate-spin mr-2" size={20} /> Chargement des options...
            </div>
        );
    }

    if (!properties) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-muted-foreground bg-background">
                <p>Impossible de charger server.properties.</p>
                <Button onClick={fetchProperties} variant="secondary" className="mt-4 gap-2">
                    <RefreshCw size={16} /> Réessayer
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative text-foreground">
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
            
            {/* Floating Save Button with Animated Success Feedback */}
            <div className="absolute bottom-6 right-6 z-50">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    variant={savedSuccess ? "secondary" : "primary"}
                    className={`gap-2 rounded-full px-6 py-6 shadow-lg transition-all duration-200 ${
                        savedSuccess ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20' : 'shadow-primary/20'
                    }`}
                >
                    {saving ? (
                        <RefreshCw size={18} className="animate-spin" />
                    ) : savedSuccess ? (
                        <Check size={18} className="animate-in zoom-in-50" />
                    ) : (
                        <Save size={18} />
                    )}
                    <span className="font-semibold text-[15px]">
                        {saving ? 'Sauvegarde...' : savedSuccess ? 'Enregistré !' : 'Sauvegarder'}
                    </span>
                </Button>
            </div>
        </div>
    );
};
