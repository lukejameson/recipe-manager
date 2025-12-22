<script lang="ts">
  import { marked } from 'marked';

  interface Props {
    content: string;
    class?: string;
  }

  let { content, class: className = '' }: Props = $props();

  // Configure marked for safe rendering
  marked.setOptions({
    breaks: true, // Convert \n to <br>
    gfm: true, // GitHub Flavored Markdown
  });

  // Simple HTML sanitization to prevent XSS
  function sanitizeHtml(html: string): string {
    // Allow only safe tags
    const allowedTags = [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote', 'code', 'pre',
      'a', 'hr'
    ];

    // Remove script tags and event handlers
    let sanitized = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      .replace(/javascript:/gi, '');

    // Simple tag filter - remove tags not in allowed list
    sanitized = sanitized.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
      if (allowedTags.includes(tag.toLowerCase())) {
        // For anchor tags, ensure they open in new tab and have noopener
        if (tag.toLowerCase() === 'a') {
          return match
            .replace(/<a /i, '<a target="_blank" rel="noopener noreferrer" ')
            .replace(/href="javascript:[^"]*"/gi, 'href="#"');
        }
        return match;
      }
      return '';
    });

    return sanitized;
  }

  const renderedHtml = $derived(sanitizeHtml(marked.parse(content) as string));
</script>

<div class="markdown {className}">
  {@html renderedHtml}
</div>

<style>
  .markdown {
    line-height: 1.6;
  }

  .markdown :global(p) {
    margin: 0 0 0.75em;
  }

  .markdown :global(p:last-child) {
    margin-bottom: 0;
  }

  .markdown :global(h1),
  .markdown :global(h2),
  .markdown :global(h3),
  .markdown :global(h4),
  .markdown :global(h5),
  .markdown :global(h6) {
    margin: 1em 0 0.5em;
    font-weight: 600;
    line-height: 1.3;
  }

  .markdown :global(h1:first-child),
  .markdown :global(h2:first-child),
  .markdown :global(h3:first-child) {
    margin-top: 0;
  }

  .markdown :global(h1) {
    font-size: 1.5em;
  }

  .markdown :global(h2) {
    font-size: 1.3em;
  }

  .markdown :global(h3) {
    font-size: 1.15em;
  }

  .markdown :global(ul),
  .markdown :global(ol) {
    margin: 0.5em 0;
    padding-left: 1.5em;
  }

  .markdown :global(li) {
    margin: 0.25em 0;
  }

  .markdown :global(code) {
    background: var(--color-background);
    padding: 0.125em 0.375em;
    border-radius: var(--radius-sm);
    font-family: ui-monospace, monospace;
    font-size: 0.9em;
  }

  .markdown :global(pre) {
    background: var(--color-background);
    padding: 0.75em 1em;
    border-radius: var(--radius-md);
    overflow-x: auto;
    margin: 0.75em 0;
  }

  .markdown :global(pre code) {
    background: none;
    padding: 0;
  }

  .markdown :global(blockquote) {
    border-left: 3px solid var(--color-border);
    margin: 0.75em 0;
    padding: 0.5em 0 0.5em 1em;
    color: var(--color-text-light);
  }

  .markdown :global(a) {
    color: var(--color-primary);
    text-decoration: none;
  }

  .markdown :global(a:hover) {
    text-decoration: underline;
  }

  .markdown :global(strong),
  .markdown :global(b) {
    font-weight: 600;
  }

  .markdown :global(hr) {
    border: none;
    border-top: 1px solid var(--color-border);
    margin: 1em 0;
  }
</style>
