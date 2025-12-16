/**
 * Shared markdown configuration utilities for consistent rendering across components.
 *
 * This module provides:
 * - generateProseStyles: Creates theme-aware CSS for markdown prose content
 * - createMarkdownComponents: Factory for ReactMarkdown component overrides
 *
 * Used by:
 * - AutoRun.tsx: Document editing/preview with image attachments and mermaid diagrams
 * - TerminalOutput.tsx: AI terminal output (uses its own variant with colored headings)
 */

import type { Components } from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import React from 'react';
import type { Theme } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface ProseStylesOptions {
  /** Theme object with color values */
  theme: Theme;
  /** Use colored headings (h1=accent, h2=success, h3=warning) - default false */
  coloredHeadings?: boolean;
  /** Use compact spacing for terminal output - default false */
  compactSpacing?: boolean;
  /** Include checkbox styling - default true */
  includeCheckboxStyles?: boolean;
}

export interface MarkdownComponentsOptions {
  /** Theme object with color values */
  theme: Theme;
  /** Custom image renderer - if not provided, default img tag is used */
  imageRenderer?: React.ComponentType<{ src?: string; alt?: string }>;
  /** Custom code block renderer for specific languages (e.g., mermaid) */
  customLanguageRenderers?: Record<string, React.ComponentType<{ code: string; theme: Theme }>>;
  /** Callback when external link is clicked - if not provided, uses default browser behavior */
  onExternalLinkClick?: (href: string) => void;
  /** Search highlighting options */
  searchHighlight?: {
    query: string;
    currentMatchIndex: number;
    /** Callback to track match index for scrolling */
    onMatchRendered?: (index: number, element: HTMLElement) => void;
  };
}

// ============================================================================
// Prose Styles Generator
// ============================================================================

/**
 * Generates CSS styles for markdown prose content.
 *
 * @param options Configuration options for style generation
 * @returns CSS string to be injected via <style> tag
 *
 * @example
 * const styles = generateProseStyles({ theme });
 * // In component: <style>{styles}</style>
 */
export function generateProseStyles(options: ProseStylesOptions): string {
  const { theme, coloredHeadings = false, compactSpacing = false, includeCheckboxStyles = true } = options;
  const colors = theme.colors;

  // Margin values based on spacing mode
  const headingMargin = compactSpacing ? '0.25em 0' : '0.67em 0';
  const headingMarginSmall = compactSpacing ? '0.2em 0' : '0.83em 0';
  const paragraphMargin = compactSpacing ? '0' : '0.5em 0';
  const listMargin = compactSpacing ? '0.25em 0' : '0.5em 0';
  const hrMargin = compactSpacing ? '0.5em 0' : '1em 0';

  // Heading colors based on mode
  const h1Color = coloredHeadings ? colors.accent : colors.textMain;
  const h2Color = coloredHeadings ? colors.success : colors.textMain;
  const h3Color = coloredHeadings ? colors.warning : colors.textMain;
  const h4Color = colors.textMain;
  const h5Color = colors.textMain;
  const h6Color = coloredHeadings ? colors.textDim : colors.textMain;

  let styles = `
    .prose { line-height: 1.4; overflow: visible; }
    ${compactSpacing ? '.prose > *:first-child { margin-top: 0 !important; }' : ''}
    ${compactSpacing ? '.prose > *:last-child { margin-bottom: 0 !important; }' : ''}
    ${compactSpacing ? '.prose * { margin-top: 0; margin-bottom: 0; }' : ''}
    .prose h1 { color: ${h1Color}; font-size: 2em; font-weight: bold; margin: ${headingMargin} !important; line-height: 1.4; }
    .prose h2 { color: ${h2Color}; font-size: 1.5em; font-weight: bold; margin: ${headingMargin} !important; line-height: 1.4; }
    .prose h3 { color: ${h3Color}; font-size: 1.17em; font-weight: bold; margin: ${headingMarginSmall} !important; line-height: 1.4; }
    .prose h4 { color: ${h4Color}; font-size: 1em; font-weight: bold; margin: ${headingMarginSmall} !important; line-height: 1.4; }
    .prose h5 { color: ${h5Color}; font-size: 0.83em; font-weight: bold; margin: ${headingMarginSmall} !important; line-height: 1.4; }
    .prose h6 { color: ${h6Color}; font-size: 0.67em; font-weight: bold; margin: ${headingMarginSmall} !important; line-height: 1.4; }
    .prose p { color: ${colors.textMain}; margin: ${paragraphMargin} !important; line-height: 1.4; }
    ${compactSpacing ? '.prose p + p { margin-top: 0.5em !important; }' : ''}
    ${compactSpacing ? '.prose p:empty { display: none; }' : ''}
    .prose ul, .prose ol { color: ${colors.textMain}; margin: ${listMargin} !important; padding-left: ${compactSpacing ? '2em' : '1.5em'}; ${compactSpacing ? 'list-style-position: outside;' : ''} }
    .prose ul { list-style-type: disc; }
    .prose ol { list-style-type: decimal; }
    ${compactSpacing ? '.prose li ul, .prose li ol { margin: 0 !important; padding-left: 1.5em; list-style-position: outside; }' : ''}
    .prose li { margin: ${compactSpacing ? '0' : '0.25em 0'} !important; ${compactSpacing ? 'padding: 0;' : ''} line-height: 1.4; display: list-item; }
    ${compactSpacing ? '.prose li > p { margin: 0 !important; display: inline; }' : ''}
    ${compactSpacing ? '.prose li > p + ul, .prose li > p + ol { margin-top: 0 !important; }' : ''}
    .prose li::marker { color: ${colors.textMain}; }
    .prose li:has(> input[type="checkbox"]) { list-style: none; margin-left: -1.5em; }
    .prose code { background-color: ${colors.bgActivity}; color: ${colors.textMain}; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
    .prose pre { background-color: ${colors.bgActivity}; color: ${colors.textMain}; padding: 1em; border-radius: 6px; overflow-x: auto; ${compactSpacing ? 'margin: 0.35em 0 !important;' : ''} }
    .prose pre code { background: none; padding: 0; }
    .prose blockquote { border-left: ${compactSpacing ? '3px' : '4px'} solid ${colors.border}; padding-left: ${compactSpacing ? '0.75em' : '1em'}; margin: ${compactSpacing ? '0.25em 0' : '0.5em 0'} !important; color: ${colors.textDim}; }
    .prose a { color: ${colors.accent}; text-decoration: underline; }
    .prose hr { border: none; border-top: ${compactSpacing ? '1px' : '2px'} solid ${colors.border}; margin: ${hrMargin} !important; }
    .prose table { border-collapse: collapse; width: 100%; margin: ${compactSpacing ? '0.35em 0' : '0.5em 0'} !important; }
    .prose th, .prose td { border: 1px solid ${colors.border}; padding: ${compactSpacing ? '0.25em 0.5em' : '0.5em'}; text-align: left; }
    .prose th { background-color: ${colors.bgActivity}; font-weight: bold; }
    .prose strong { font-weight: bold; }
    .prose em { font-style: italic; }
  `.trim();

  // Add checkbox styles if requested
  if (includeCheckboxStyles) {
    styles += `
    .prose input[type="checkbox"] {
      appearance: none;
      -webkit-appearance: none;
      width: 16px;
      height: 16px;
      border: 2px solid ${colors.accent};
      border-radius: 3px;
      background-color: transparent;
      cursor: pointer;
      vertical-align: middle;
      margin-right: 8px;
      position: relative;
    }
    .prose input[type="checkbox"]:checked {
      background-color: ${colors.accent};
      border-color: ${colors.accent};
    }
    .prose input[type="checkbox"]:checked::after {
      content: '';
      position: absolute;
      left: 4px;
      top: 1px;
      width: 5px;
      height: 9px;
      border: solid ${colors.bgMain};
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }
    .prose input[type="checkbox"]:hover {
      border-color: ${colors.accent};
      box-shadow: 0 0 4px ${colors.accent}40;
    }
    .prose li:has(> input[type="checkbox"]) {
      list-style-type: none;
      margin-left: -1.5em;
    }
    `;
  }

  return styles;
}

// ============================================================================
// Markdown Components Factory
// ============================================================================

/**
 * Creates ReactMarkdown component overrides for consistent rendering.
 *
 * @param options Configuration options for component creation
 * @returns Components object for ReactMarkdown's `components` prop
 *
 * @example
 * const components = createMarkdownComponents({
 *   theme,
 *   imageRenderer: MyImageComponent,
 *   customLanguageRenderers: { mermaid: MermaidRenderer },
 * });
 * // In component: <ReactMarkdown components={components}>...</ReactMarkdown>
 */
// Global match counter for tracking which match is current during render
let globalMatchCounter = 0;

export function createMarkdownComponents(options: MarkdownComponentsOptions): Partial<Components> {
  const { theme, imageRenderer, customLanguageRenderers = {}, onExternalLinkClick, searchHighlight } = options;

  // Reset match counter at start of each render
  globalMatchCounter = 0;

  const components: Partial<Components> = {
    // Text node handler for search highlighting
    text: ({ children }: any) => {
      const text = String(children);

      // If no search or empty query, return plain text
      if (!searchHighlight || !searchHighlight.query.trim()) {
        return React.createElement(React.Fragment, null, text);
      }

      const { query, currentMatchIndex, onMatchRendered } = searchHighlight;
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedQuery})`, 'gi');
      const parts = text.split(regex);

      // If no matches in this text node, return plain text
      if (parts.length === 1) {
        return React.createElement(React.Fragment, null, text);
      }

      // Build array of text and highlighted spans
      const elements: React.ReactNode[] = [];
      parts.forEach((part, i) => {
        if (part.toLowerCase() === query.toLowerCase()) {
          const matchIndex = globalMatchCounter++;
          const isCurrent = matchIndex === currentMatchIndex;
          elements.push(
            React.createElement('mark', {
              key: `match-${i}`,
              className: 'search-match',
              'data-match-index': matchIndex,
              'data-current': isCurrent ? 'true' : undefined,
              style: {
                padding: '0 2px',
                borderRadius: '2px',
                backgroundColor: isCurrent ? theme.colors.accent : '#ffd700',
                color: isCurrent ? '#fff' : '#000',
              },
              ref: isCurrent && onMatchRendered
                ? (el: HTMLElement | null) => el && onMatchRendered(matchIndex, el)
                : undefined,
            }, part)
          );
        } else {
          elements.push(part);
        }
      });

      return React.createElement(React.Fragment, null, ...elements);
    },
    // Code block with syntax highlighting and custom language support
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = (className || '').match(/language-(\w+)/);
      const language = match ? match[1] : 'text';
      const codeContent = String(children).replace(/\n$/, '');

      // Check for custom language renderer (e.g., mermaid)
      if (!inline && customLanguageRenderers[language]) {
        const CustomRenderer = customLanguageRenderers[language];
        return React.createElement(CustomRenderer, { code: codeContent, theme });
      }

      // Standard syntax-highlighted code block
      if (!inline && match) {
        return React.createElement(SyntaxHighlighter, {
          language,
          style: vscDarkPlus,
          customStyle: {
            margin: '0.5em 0',
            padding: '1em',
            background: theme.colors.bgActivity,
            fontSize: '0.9em',
            borderRadius: '6px',
          },
          PreTag: 'div',
          children: codeContent,
        });
      }

      // Inline code
      return React.createElement('code', { className, ...props }, children);
    },
  };

  // Custom image renderer if provided
  if (imageRenderer) {
    components.img = ({ node, src, alt, ...props }: any) => {
      return React.createElement(imageRenderer, { src, alt, ...props });
    };
  }

  // External link handler if provided
  if (onExternalLinkClick) {
    components.a = ({ node, href, children, ...props }: any) => {
      return React.createElement(
        'a',
        {
          href,
          ...props,
          onClick: (e: React.MouseEvent) => {
            e.preventDefault();
            if (href) {
              onExternalLinkClick(href);
            }
          },
          style: { color: theme.colors.accent, textDecoration: 'underline', cursor: 'pointer' },
        },
        children
      );
    };
  }

  return components;
}

// ============================================================================
// Pre-configured Style Generators (convenience exports)
// ============================================================================

/**
 * Generates prose styles for AutoRun document editing/preview.
 * Includes checkbox styling and standard heading colors.
 */
export function generateAutoRunProseStyles(theme: Theme): string {
  return generateProseStyles({
    theme,
    coloredHeadings: false,
    compactSpacing: false,
    includeCheckboxStyles: true,
  });
}

/**
 * Generates prose styles for terminal/AI output.
 * Uses colored headings and compact spacing for log display.
 */
export function generateTerminalProseStyles(theme: Theme): string {
  return generateProseStyles({
    theme,
    coloredHeadings: true,
    compactSpacing: true,
    includeCheckboxStyles: false,
  });
}
