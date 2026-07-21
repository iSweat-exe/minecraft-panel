import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'dompurify';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
    // Sanitize markdown before parsing
    const cleanContent = useMemo(() => {
        return DOMPurify.sanitize(content, {
            USE_PROFILES: { html: true }, // allow basic html if necessary, but react-markdown handles most
            FORBID_ATTR: ['style', 'on*', 'class', 'id', 'name'],
        });
    }, [content]);

    return (
        <div className={`text-sm text-muted-foreground prose prose-invert max-w-none ${className}`}>
            <ReactMarkdown
                components={{
                    a: ({ node, ...props }) => (
                        <a target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" {...props} />
                    ),
                    h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mt-6 mb-4 text-foreground" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-5 mb-3 text-foreground" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-lg font-bold mt-4 mb-2 text-foreground" {...props} />,
                    code: ({ node, ...props }) => <code className="bg-surface-hover px-1 py-0.5 rounded text-xs font-mono text-foreground" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc ml-5 my-2 space-y-1" {...props} />,
                    p: ({ node, ...props }) => <p className="mb-2 leading-relaxed" {...props} />
                }}
            >
                {cleanContent}
            </ReactMarkdown>
        </div>
    );
};
