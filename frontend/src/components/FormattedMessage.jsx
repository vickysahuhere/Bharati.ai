import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';

function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);
  const codeText = String(children).replace(/\n$/, '');
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl border border-zinc-200 overflow-hidden bg-zinc-900 text-zinc-100 shadow-xs text-xs">
      <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-800/80 border-b border-zinc-700/60 text-[11px] font-mono text-zinc-400">
        <span className="font-medium text-zinc-300">{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-zinc-700/70 hover:text-white transition-colors"
          title="Copy code"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div className="p-3.5 overflow-x-auto font-mono text-[12.5px] leading-relaxed text-zinc-200">
        <code>{children}</code>
      </div>
    </div>
  );
}

export default function FormattedMessage({ content, isUser }) {
  if (isUser) {
    return <div className="whitespace-pre-wrap leading-relaxed text-[14px]">{content}</div>;
  }

  return (
    <div className="space-y-3 leading-relaxed text-[13.5px] sm:text-[14px] text-zinc-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Bold text
          strong: ({ children }) => (
            <strong className="font-semibold text-zinc-900">
              {children}
            </strong>
          ),

          // Emphasis / Italics
          em: ({ children }) => (
            <em className="italic text-zinc-800">
              {children}
            </em>
          ),

          // Headings
          h1: ({ children }) => (
            <h1 className="text-base sm:text-lg font-semibold text-zinc-900 mt-4 mb-2 pb-1 border-b border-zinc-100 tracking-tight">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm sm:text-base font-semibold text-zinc-900 mt-3 mb-1.5 pb-1 border-b border-zinc-100 tracking-tight">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs sm:text-sm font-semibold text-zinc-900 mt-2.5 mb-1">
              {children}
            </h3>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p className="mb-2.5 last:mb-0 leading-relaxed font-normal text-zinc-700">
              {children}
            </p>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="my-2.5 space-y-1.5 list-disc pl-5 marker:text-zinc-400 text-zinc-700">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2.5 space-y-1.5 list-decimal pl-5 marker:font-medium marker:text-zinc-500 text-zinc-700">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-0.5">
              {children}
            </li>
          ),

          // Tables
          table: ({ children }) => (
            <div className="my-3.5 overflow-x-auto rounded-xl border border-zinc-200/90 bg-white shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-zinc-50/80 text-zinc-700 font-semibold border-b border-zinc-200">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="py-2.5 px-3.5 text-xs font-semibold text-zinc-800 tracking-wider text-left border-b border-zinc-200">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="py-2.5 px-3.5 text-xs text-zinc-700 border-b border-zinc-100 last:border-b-0 leading-relaxed">
              {children}
            </td>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-zinc-50/50 transition-colors">
              {children}
            </tr>
          ),

          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="my-3 pl-3.5 border-l-2 border-zinc-300 bg-zinc-50/70 py-2 pr-3 rounded-r-lg text-xs text-zinc-600 italic">
              {children}
            </blockquote>
          ),

          // Code
          code: ({ inline, className, children, ...props }) => {
            if (inline) {
              return (
                <code
                  className="px-1.5 py-0.5 mx-0.5 bg-zinc-100 font-mono text-[12px] font-medium text-zinc-800 rounded-md border border-zinc-200/70"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
