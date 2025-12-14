import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Clipboard } from 'lucide-react';
import type { Theme } from '../types';

// ============================================================================
// CodeBlockWithCopy - Code block with copy button overlay
// ============================================================================

interface CodeBlockWithCopyProps {
  language: string;
  codeContent: string;
  theme: Theme;
  onCopy: (text: string) => void;
}

const CodeBlockWithCopy = memo(({ language, codeContent, theme, onCopy }: CodeBlockWithCopyProps) => {
  return (
    <div className="relative group/codeblock">
      <button
        onClick={() => onCopy(codeContent)}
        className="absolute bottom-2 right-2 p-1.5 rounded opacity-0 group-hover/codeblock:opacity-70 hover:!opacity-100 transition-opacity z-10"
        style={{
          backgroundColor: theme.colors.bgActivity,
          color: theme.colors.textDim,
          border: `1px solid ${theme.colors.border}`
        }}
        title="Copy code"
      >
        <Clipboard className="w-3.5 h-3.5" />
      </button>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: '0.5em 0',
          padding: '1em',
          background: theme.colors.bgSidebar,
          fontSize: '0.9em',
          borderRadius: '6px',
        }}
        PreTag="div"
      >
        {codeContent}
      </SyntaxHighlighter>
    </div>
  );
});

CodeBlockWithCopy.displayName = 'CodeBlockWithCopy';

// ============================================================================
// MarkdownRenderer - Unified markdown rendering component for AI responses
// ============================================================================

interface MarkdownRendererProps {
  /** The markdown content to render */
  content: string;
  /** The current theme */
  theme: Theme;
  /** Callback to copy text to clipboard */
  onCopy: (text: string) => void;
  /** Optional additional className for the container */
  className?: string;
}

/**
 * MarkdownRenderer provides consistent markdown rendering across the application.
 *
 * Features:
 * - GitHub Flavored Markdown support (tables, strikethrough, task lists, etc.)
 * - Syntax highlighted code blocks with copy button
 * - External link handling (opens in browser)
 * - Theme-aware styling
 *
 * Note: Prose styles are injected at the TerminalOutput container level for performance.
 * This component assumes those styles are already present in a parent container.
 */
export const MarkdownRenderer = memo(({ content, theme, onCopy, className = '' }: MarkdownRendererProps) => {
  return (
    <div
      className={`prose prose-sm max-w-none text-sm ${className}`}
      style={{ color: theme.colors.textMain, lineHeight: 1.4, paddingLeft: '0.5em' }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, href, children, ...props }) => (
            <a
              href={href}
              {...props}
              onClick={(e) => {
                e.preventDefault();
                if (href) {
                  window.maestro.shell.openExternal(href);
                }
              }}
              style={{ color: theme.colors.accent, textDecoration: 'underline', cursor: 'pointer' }}
            >
              {children}
            </a>
          ),
          code: ({ node, inline, className, children, ...props }: any) => {
            const match = (className || '').match(/language-(\w+)/);
            const language = match ? match[1] : 'text';
            const codeContent = String(children).replace(/\n$/, '');

            return !inline && match ? (
              <CodeBlockWithCopy
                language={language}
                codeContent={codeContent}
                theme={theme}
                onCopy={onCopy}
              />
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

MarkdownRenderer.displayName = 'MarkdownRenderer';

// Also export CodeBlockWithCopy for cases where only the code block is needed
export { CodeBlockWithCopy };
export type { CodeBlockWithCopyProps, MarkdownRendererProps };
