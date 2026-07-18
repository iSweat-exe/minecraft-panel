import React, { useState, useRef, useEffect } from 'react';

const COLORS: Record<string, string> = {
    '0': '#000000',
    '1': '#0000AA',
    '2': '#00AA00',
    '3': '#00AAAA',
    '4': '#AA0000',
    '5': '#AA00AA',
    '6': '#FFAA00',
    '7': '#AAAAAA',
    '8': '#555555',
    '9': '#5555FF',
    'a': '#55FF55',
    'b': '#55FFFF',
    'c': '#FF5555',
    'd': '#FF55FF',
    'e': '#FFFF55',
    'f': '#FFFFFF',
};

const FORMATS: Record<string, string> = {
    'l': 'font-bold',
    'm': 'line-through',
    'n': 'underline',
    'o': 'italic',
};

export const parseMinecraftColors = (text: string) => {
    if (!text) return null;

    const parts = text.split(/(§[0-9a-fk-or])/i);
    let currentColor = '#AAAAAA';
    let currentFormats = new Set<string>();
    
    return parts.map((part, index) => {
        if (!part) return null;
        
        if (part.startsWith('§') || part.startsWith('&')) {
            const code = part.charAt(1).toLowerCase();
            if (COLORS[code]) {
                currentColor = COLORS[code];
                currentFormats.clear();
            } else if (FORMATS[code]) {
                currentFormats.add(FORMATS[code]);
            } else if (code === 'r') {
                currentColor = '#AAAAAA';
                currentFormats.clear();
            }
            return null;
        }

        // Replace \n with actual breaks
        const lines = part.split(/\\n|\n/);
        
        return (
            <span 
                key={index} 
                style={{ color: currentColor }}
                className={Array.from(currentFormats).join(' ')}
            >
                {lines.map((line, i) => (
                    <React.Fragment key={i}>
                        {line}
                        {i < lines.length - 1 && <br />}
                    </React.Fragment>
                ))}
            </span>
        );
    });
};

interface EditableMinecraftTextProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    className?: string;
}

export const EditableMinecraftText: React.FC<EditableMinecraftTextProps> = ({ value, onChange, placeholder, className }) => {
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={() => setIsEditing(false)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') {
                        setIsEditing(false);
                    }
                }}
                placeholder={placeholder}
                className={`font-mono text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-300 w-full focus:outline-none focus:border-indigo-500 ${className || ''}`}
            />
        );
    }

    return (
        <div 
            onClick={() => setIsEditing(true)}
            className={`cursor-text group relative rounded hover:bg-zinc-800/50 transition-colors p-1 -mx-1 w-full overflow-hidden ${className || ''}`}
        >
            <div className="whitespace-pre-wrap font-sans">
                {value ? parseMinecraftColors(value) : <span className="text-zinc-600 italic">{placeholder}</span>}
            </div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </div>
        </div>
    );
};
