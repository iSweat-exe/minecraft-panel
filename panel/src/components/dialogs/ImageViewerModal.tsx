import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ModrinthGalleryImage } from '../../api/modrinth';
import { 
    X, 
    ChevronLeft, 
    ChevronRight, 
    ZoomIn, 
    ZoomOut, 
    RotateCw, 
    Download
} from 'lucide-react';

interface ImageViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    images: ModrinthGalleryImage[];
    initialIndex?: number;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
    isOpen,
    onClose,
    images,
    initialIndex = 0
}) => {
    const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
    const [zoom, setZoom] = useState<number>(1);
    const [rotation, setRotation] = useState<number>(0);
    const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    // Sync initialIndex when modal opens
    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(initialIndex);
            setZoom(1);
            setRotation(0);
            setPan({ x: 0, y: 0 });
        }
    }, [isOpen, initialIndex]);

    const handlePrev = useCallback(() => {
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
        setZoom(1);
        setRotation(0);
        setPan({ x: 0, y: 0 });
    }, [images.length]);

    const handleNext = useCallback(() => {
        setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
        setZoom(1);
        setRotation(0);
        setPan({ x: 0, y: 0 });
    }, [images.length]);

    const handleZoomIn = useCallback(() => {
        setZoom(prev => Math.min(prev + 0.5, 4));
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoom(prev => {
            const next = Math.max(prev - 0.5, 1);
            if (next === 1) setPan({ x: 0, y: 0 });
            return next;
        });
    }, []);

    const handleResetZoom = useCallback(() => {
        setZoom(1);
        setRotation(0);
        setPan({ x: 0, y: 0 });
    }, []);

    const handleRotate = useCallback(() => {
        setRotation(prev => (prev + 90) % 360);
    }, []);

    // Mouse drag handlers for panning zoomed image
    const handleMouseDown = (e: React.MouseEvent) => {
        if (zoom <= 1) return;
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        panStartRef.current = { ...pan };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || zoom <= 1) return;
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        setPan({
            x: panStartRef.current.x + dx,
            y: panStartRef.current.y + dy
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Keyboard shortcuts listener
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowLeft') {
                handlePrev();
            } else if (e.key === 'ArrowRight') {
                handleNext();
            } else if (e.key === '+' || e.key === '=') {
                handleZoomIn();
            } else if (e.key === '-') {
                handleZoomOut();
            } else if (e.key === 'r' || e.key === 'R') {
                handleRotate();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, handlePrev, handleNext, handleZoomIn, handleZoomOut, handleRotate]);

    // Mouse wheel zoom
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        if (e.deltaY < 0) {
            handleZoomIn();
        } else {
            handleZoomOut();
        }
    };

    if (!isOpen || images.length === 0) return null;

    const currentImage = images[currentIndex] || images[0];

    return (
        <div 
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 animate-in fade-in duration-200 select-none"
            onClick={onClose}
        >
            {/* TOP TOOLBAR */}
            <div 
                className="flex items-center justify-between gap-4 p-3 bg-zinc-900/90 border border-zinc-800 rounded-xl z-30 shadow-2xl backdrop-blur-md shrink-0"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Image Counter & Title */}
                <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700">
                        {currentIndex + 1} / {images.length}
                    </span>
                    {currentImage.title && (
                        <h4 className="text-sm font-semibold text-zinc-100 truncate max-w-xs sm:max-w-md">
                            {currentImage.title}
                        </h4>
                    )}
                </div>

                {/* Control Actions */}
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={handleZoomOut}
                        disabled={zoom <= 1}
                        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-30"
                        title="Zoom arrière (-)"
                    >
                        <ZoomOut size={18} />
                    </button>
                    
                    <button
                        onClick={handleResetZoom}
                        className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                        title="Réinitialiser le zoom"
                    >
                        {Math.round(zoom * 100)}%
                    </button>

                    <button
                        onClick={handleZoomIn}
                        disabled={zoom >= 4}
                        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-30"
                        title="Zoom avant (+)"
                    >
                        <ZoomIn size={18} />
                    </button>

                    <div className="h-4 w-px bg-zinc-800 mx-1" />

                    <button
                        onClick={handleRotate}
                        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                        title="Pivoter (90°)"
                    >
                        <RotateCw size={18} />
                    </button>

                    <a
                        href={currentImage.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                        title="Ouvrir l'image HD"
                    >
                        <Download size={18} />
                    </a>

                    <div className="h-4 w-px bg-zinc-800 mx-1" />

                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-all group"
                        title="Fermer (Échap)"
                    >
                        <X size={20} className="transition-transform duration-300 group-hover:rotate-180" />
                    </button>
                </div>
            </div>

            {/* MAIN IMAGE DISPLAY AREA */}
            <div 
                className="relative flex-1 flex items-center justify-center overflow-hidden my-2 w-full h-full"
                onWheel={handleWheel}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
            >
                {/* Previous Image Arrow Button */}
                {images.length > 1 && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handlePrev();
                        }}
                        className="absolute left-4 z-30 p-3 rounded-full bg-zinc-900/80 border border-zinc-800 text-white hover:bg-primary transition-all shadow-xl hover:scale-110"
                        title="Image précédente (Flèche Gauche)"
                    >
                        <ChevronLeft size={24} />
                    </button>
                )}

                {/* Scalable & Pannable Image */}
                <div className="w-full h-full flex items-center justify-center p-2">
                    <img 
                        src={currentImage.url} 
                        alt={currentImage.title || 'Screenshot'} 
                        className="max-w-[94vw] max-h-[85vh] object-contain rounded-lg shadow-2xl transition-transform duration-100 ease-out"
                        style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                            transformOrigin: 'center center'
                        }}
                        draggable={false}
                    />
                </div>

                {/* Next Image Arrow Button */}
                {images.length > 1 && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleNext();
                        }}
                        className="absolute right-4 z-30 p-3 rounded-full bg-zinc-900/80 border border-zinc-800 text-white hover:bg-primary transition-all shadow-xl hover:scale-110"
                        title="Image suivante (Flèche Droite)"
                    >
                        <ChevronRight size={24} />
                    </button>
                )}
            </div>

            {/* BOTTOM CAPTION */}
            {currentImage.description && (
                <div 
                    className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-xl text-center max-w-2xl mx-auto z-30 shadow-2xl backdrop-blur-md shrink-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    <p className="text-xs text-zinc-300 leading-relaxed">{currentImage.description}</p>
                </div>
            )}
        </div>
    );
};
