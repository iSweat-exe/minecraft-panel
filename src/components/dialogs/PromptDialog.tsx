import React, { useState, useRef, useEffect } from 'react';
import { createCallable } from 'react-call';

interface Props {
    title: string;
    defaultValue?: string;
}

export const PromptDialog = createCallable<Props, string | null>(({ call, title, defaultValue }) => {
    const [value, setValue] = useState(defaultValue || '');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        call.end(value);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-5">
                    <h3 className="text-lg font-semibold text-zinc-100 mb-4">{title}</h3>
                    <form onSubmit={handleSubmit} id="prompt-form">
                        <input
                            ref={inputRef}
                            type="text"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                        />
                    </form>
                </div>
                <div className="p-4 bg-zinc-950/50 flex justify-end gap-3 border-t border-zinc-800">
                    <button
                        type="button"
                        onClick={() => call.end(null)}
                        className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-zinc-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="prompt-form"
                        className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-sm"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
});
