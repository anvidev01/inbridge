import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css'; // Light theme for code blocks

interface MarkdownRendererProps {
    content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
    return (
        <div className="prose prose-sm md:prose-base prose-slate max-w-none break-words">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                    ul: ({ node, ...props }) => <ul className="list-disc pl-4 space-y-1 my-2" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal pl-4 space-y-1 my-2" {...props} />,
                    li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                    h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-4 mb-2 text-neutral-100" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-3 mb-2 text-neutral-100" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-md font-bold mt-2 mb-1 text-neutral-100" {...props} />,
                    p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed text-neutral-200" {...props} />,
                    a: ({ node, ...props }) => <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                    code: ({ node, inline, className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline ? (
                            <div className="relative group rounded-md overflow-hidden my-3">
                                <div className="bg-gray-800 text-gray-200 text-xs px-3 py-1.5 flex justify-between items-center rounded-t-md">
                                    <span>{match?.[1] || 'code'}</span>
                                </div>
                                <code className={`block overflow-x-auto p-3 text-sm bg-[#171717] border border-neutral-800 rounded-b-md ${className}`} {...props}>
                                    {children}
                                </code>
                            </div>
                        ) : (
                            <code className="bg-neutral-800 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono border border-neutral-800" {...props}>
                                {children}
                            </code>
                        );
                    },
                    table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-4 border border-neutral-800 rounded-lg">
                            <table className="min-w-full divide-y divide-gray-200" {...props} />
                        </div>
                    ),
                    th: ({ node, ...props }) => <th className="px-4 py-2 bg-[#171717] text-left text-xs font-medium text-neutral-500 uppercase tracking-wider" {...props} />,
                    td: ({ node, ...props }) => <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-300 border-t border-neutral-800" {...props} />,
                    blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-neutral-800 pl-4 italic text-neutral-400 my-3" {...props} />
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
