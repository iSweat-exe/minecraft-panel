import React from 'react';
import { useToastStore } from '../../store/toastStore';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export const ToastContainer: React.FC = () => {
    const { toasts, removeToast } = useToastStore();

    return (
        <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
            {toasts.map((toast) => {
                const icons = {
                    success: <CheckCircle className="text-emerald-400" size={20} />,
                    error: <AlertCircle className="text-red-400" size={20} />,
                    warn: <AlertTriangle className="text-amber-400" size={20} />,
                    info: <Info className="text-blue-400" size={20} />,
                };

                const borders = {
                    success: 'border-emerald-500/20 bg-emerald-500/10',
                    error: 'border-red-500/20 bg-red-500/10',
                    warn: 'border-amber-500/20 bg-amber-500/10',
                    info: 'border-blue-500/20 bg-blue-500/10',
                };

                return (
                    <div 
                        key={toast.id}
                        className={cn(
                            'pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-lg transition-all transform animate-in slide-in-from-top-5 fade-in duration-300 min-w-[300px] max-w-[400px]',
                            borders[toast.type]
                        )}
                    >
                        <div className="shrink-0 mt-0.5">{icons[toast.type]}</div>
                        <div className="flex-1 mr-4">
                            <h4 className="text-sm font-semibold text-zinc-100">{toast.message}</h4>
                            {toast.description && (
                                <p className="text-xs text-zinc-400 mt-1">{toast.description}</p>
                            )}
                        </div>
                        <button 
                            onClick={() => removeToast(toast.id)}
                            className="shrink-0 text-zinc-500 hover:text-zinc-200 transition-all group p-1 rounded-md hover:bg-white/5"
                            title="Fermer"
                        >
                            <X size={16} className="transition-transform duration-300 group-hover:rotate-180" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
};