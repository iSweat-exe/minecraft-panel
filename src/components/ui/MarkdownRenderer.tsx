import React from 'react';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
    const parseMarkdown = (text: string) => {
        if (!text) return '';
        
        let html = text
            // Escape HTML tags to prevent XSS
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$1</a>')
            // Headers
            .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-4 mb-2 text-foreground">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-5 mb-3 text-foreground">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4 text-foreground">$1</h1>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code class="bg-surface-hover px-1 py-0.5 rounded text-xs font-mono text-foreground">$1</code>');
            
        // Handle Lists
        const lines = html.split('\n');
        let inList = false;
        let result = '';
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trimRight();
            
            const listMatch = line.match(/^(\s*)([-*])\s+(.*)/);
            if (listMatch) {
                if (!inList) {
                    result += '<ul class="list-disc ml-5 my-2 space-y-1">\n';
                    inList = true;
                }
                result += `<li>${listMatch[3]}</li>\n`;
            } else {
                if (inList) {
                    result += '</ul>\n';
                    inList = false;
                }
                if (line.trim() === '') {
                    result += '<br/>\n';
                } else {
                    result += `<p class="mb-2 leading-relaxed">${line}</p>\n`;
                }
            }
        }
        if (inList) result += '</ul>\n';
        
        return result;
    };

    return (
        <div 
            className={`text-sm text-muted-foreground ${className}`}
            dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }}
        />
    );
};
