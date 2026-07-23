import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    maxWidth?: string;
    maxHeight?: string;
    className?: string;
}

export const Modal: React.FC<ModalProps> = ({ 
    isOpen, 
    onClose, 
    title, 
    children, 
    footer,
    maxWidth = 'max-w-md',
    maxHeight = 'max-h-[70vh] overflow-y-auto',
    className,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed top-8 inset-x-0 bottom-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={cn('bg-background border border-border w-full rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200', maxWidth, className)}>
                <div className="flex justify-between items-center p-5 border-b border-border bg-surface/30">
                    <h3 className="font-bold text-foreground text-lg">{title}</h3>
                    <button 
                        onClick={onClose}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface rounded-lg transition-all group"
                        title="Fermer"
                    >
                        <X size={18} className="transition-transform duration-300 group-hover:rotate-180" />
                    </button>
                </div>
                
                <div className={cn('p-5 custom-scrollbar', maxHeight)}>
                    {children}
                </div>

                {footer && (
                    <div className="p-5 border-t border-border bg-surface/30 flex justify-end gap-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};
