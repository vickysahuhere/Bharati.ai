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
    <div className="my-3 rounded-none border-[1.5px] border-[#111111] overflow-hidden bg-[#1E1E1E] text-white brutal-shadow text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#111111] border-b-[1.5px] border-[#333333] text-[10px] font-mono uppercase tracking-wider text-gray-400">
        <span>{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors"
          title="Copy code"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <div className="p-3 overflow-x-auto font-mono text-[12px] leading-relaxed text-emerald-300">
        <code>{children}</code>
      </div>
    </div>
  );
}

export default function FormattedMessage({ content, isUser }) {
  if (isUser) {
    return <div className="whitespace-pre-wrap font-medium">{content}</div>;
  }

  return (
    <div className="chatgpt-message space-y-3 leading-relaxed text-[13.5px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Bold text highlighting
          strong: ({ children }) => (
            <strong className="font-extrabold text-[#111111] bg-[#E25A3F]/10 px-1 py-0.2 rounded-sm border-b-[1.5px] border-[#E25A3F]/40">
              {children}
            </strong>
          ),

          // Emphasis / Italics
          em: ({ children }) => (
            <em className="italic text-[#111111]/90 font-medium">
              {children}
            </em>
          ),

          // Headings
          h1: ({ children }) => (
            <h1 className="text-lg font-heading font-extrabold text-[#111111] mt-4 mb-2 pb-1 border-b-[1.5px] border-[#111111]/20 uppercase tracking-tight">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-heading font-bold text-[#111111] mt-3 mb-2 pb-1 border-b border-[#111111]/15 uppercase tracking-wide">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-heading font-bold text-[#1D2330] mt-3 mb-1.5 uppercase">
              {children}
            </h3>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p className="mb-2.5 last:mb-0 text-[#111111]/90 leading-relaxed font-normal">
              {children}
            </p>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="my-2.5 space-y-1.5 list-disc pl-5 marker:text-[#E25A3F] font-normal">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2.5 space-y-1.5 list-decimal pl-5 marker:font-bold marker:text-[#111111]">
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
            <div className="my-4 overflow-x-auto brutal-border">
              <table className="w-full text-left text-xs border-collapse bg-white">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#111111] text-white uppercase text-[10px] tracking-wider font-bold">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="p-2.5 border-[1.5px] border-[#111111]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="p-2.5 border-[1.5px] border-[#111111]/20 font-medium">
              {children}
            </td>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-[#F4F1EA]/60 transition-colors">
              {children}
            </tr>
          ),

          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="my-3 pl-3.5 border-l-4 border-[#E25A3F] bg-[#F4F1EA]/70 py-1.5 pr-3 text-xs text-[#111111]/80 italic">
              {children}
            </blockquote>
          ),

          // Code
          code: ({ inline, className, children, ...props }) => {
            if (inline) {
              return (
                <code
                  className="px-1.5 py-0.5 mx-0.5 bg-[#111111]/8 font-mono text-[11.5px] font-bold text-[#E25A3F] border border-[#111111]/20 rounded-sm"
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
