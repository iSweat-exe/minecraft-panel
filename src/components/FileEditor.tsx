import React, { useState } from 'react';
import { Save, X } from 'lucide-react';
import Editor from '@monaco-editor/react';

interface FileEditorProps {
    path: string;
    initialContent: string;
    onSave: (content: string) => void;
    onCancel: () => void;
}

// Function to guess language from extension
const getLanguage = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'json': return 'json';
        case 'yml':
        case 'yaml': return 'yaml';
        case 'sh':
        case 'bash': return 'shell';
        case 'xml': return 'xml';
        case 'properties': return 'ini';
        case 'js': return 'javascript';
        case 'ts': return 'typescript';
        case 'html': return 'html';
        case 'css': return 'css';
        default: return 'plaintext';
    }
};

export const FileEditor: React.FC<FileEditorProps> = ({ path, initialContent, onSave, onCancel }) => {
    const [content, setContent] = useState(initialContent);

    return (
        <div className="h-full flex flex-col bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
                <div className="font-mono text-sm text-zinc-300 truncate pr-4">
                    {path}
                </div>
                <div className="flex gap-2 shrink-0">
                    <button 
                        onClick={onCancel}
                        className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors flex items-center gap-1"
                    >
                        <X size={14} /> Cancel
                    </button>
                    <button 
                        onClick={() => onSave(content)}
                        className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors flex items-center gap-1 shadow-sm"
                    >
                        <Save size={14} /> Save
                    </button>
                </div>
            </div>
            <div className="flex-1 w-full relative">
                <Editor
                    height="100%"
                    language={getLanguage(path)}
                    theme="vs-dark"
                    value={content}
                    onChange={(value) => setContent(value || '')}
                    options={{
                        minimap: { enabled: true },
                        fontSize: 14,
                        fontFamily: 'Consolas, "Courier New", monospace',
                        scrollBeyondLastLine: false,
                        padding: { top: 16 },
                        wordWrap: 'on'
                    }}
                />
            </div>
        </div>
    );
};
