<script lang="ts">
  import { trpc } from '$lib/trpc/client';

  interface Message {
    role: 'user' | 'assistant';
    content: string;
  }

  interface Recipe {
    title: string;
    description?: string;
    ingredients: string[];
    instructions: string[];
    prepTime?: number;
    cookTime?: number;
    servings?: number;
    tags?: Array<{ name: string }>;
  }

  let {
    recipe,
    onClose,
  }: {
    recipe: Recipe;
    onClose: () => void;
  } = $props();

  let messages = $state<Message[]>([]);
  let inputValue = $state('');
  let sending = $state(false);
  let error = $state('');
  let messagesContainer: HTMLDivElement;

  // Quick action suggestions
  const quickActions = [
    { label: 'Scale recipe', prompt: 'How do I scale this recipe to serve 8 people?' },
    { label: 'Substitutions', prompt: 'What are some good ingredient substitutions for this recipe?' },
    { label: 'Make it healthier', prompt: 'How can I make this recipe healthier?' },
    { label: 'Wine pairing', prompt: 'What wine would pair well with this dish?' },
    { label: 'Storage tips', prompt: 'How should I store leftovers and how long will they keep?' },
    { label: 'Common mistakes', prompt: 'What are common mistakes to avoid when making this?' },
  ];

  async function sendMessage(content: string) {
    if (!content.trim() || sending) return;

    error = '';
    const userMessage: Message = { role: 'user', content: content.trim() };
    messages = [...messages, userMessage];
    inputValue = '';
    sending = true;

    // Scroll to bottom
    setTimeout(() => {
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 0);

    try {
      const result = await trpc.ai.chatAboutRecipe.mutate({
        recipe: {
          title: recipe.title,
          description: recipe.description,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          prepTime: recipe.prepTime,
          cookTime: recipe.cookTime,
          servings: recipe.servings,
          tags: recipe.tags?.map((t) => t.name),
        },
        messages: messages,
      });

      const assistantMessage: Message = { role: 'assistant', content: result.message };
      messages = [...messages, assistantMessage];
    } catch (err: any) {
      error = err.message || 'Failed to get response';
      // Remove the user message if we failed
      messages = messages.slice(0, -1);
    } finally {
      sending = false;
      // Scroll to bottom after response
      setTimeout(() => {
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 0);
    }
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    sendMessage(inputValue);
  }

  function handleQuickAction(prompt: string) {
    sendMessage(prompt);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  }

  function clearChat() {
    messages = [];
    error = '';
  }
</script>

<div class="recipe-chat">
  <div class="chat-header">
    <div class="header-left">
      <svg class="chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <div>
        <h3>Ask about this recipe</h3>
        <p class="recipe-title">{recipe.title}</p>
      </div>
    </div>
    <div class="header-actions">
      {#if messages.length > 0}
        <button type="button" class="btn-clear" onclick={clearChat} title="Clear chat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      {/if}
      <button type="button" class="btn-close" onclick={onClose} title="Close chat">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  </div>

  <div class="chat-messages" bind:this={messagesContainer}>
    {#if messages.length === 0}
      <div class="empty-state">
        <p>Ask me anything about this recipe!</p>
        <div class="quick-actions">
          {#each quickActions as action}
            <button
              type="button"
              class="quick-action"
              onclick={() => handleQuickAction(action.prompt)}
              disabled={sending}
            >
              {action.label}
            </button>
          {/each}
        </div>
      </div>
    {:else}
      {#each messages as message}
        <div class="message {message.role}">
          <div class="message-content">
            {#if message.role === 'assistant'}
              {@html message.content.replace(/\n/g, '<br>')}
            {:else}
              {message.content}
            {/if}
          </div>
        </div>
      {/each}
      {#if sending}
        <div class="message assistant">
          <div class="message-content typing">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>
      {/if}
    {/if}
  </div>

  {#if error}
    <div class="chat-error">{error}</div>
  {/if}

  <form class="chat-input" onsubmit={handleSubmit}>
    <textarea
      bind:value={inputValue}
      placeholder="Ask a question..."
      rows="1"
      disabled={sending}
      onkeydown={handleKeydown}
    ></textarea>
    <button type="submit" class="btn-send" disabled={!inputValue.trim() || sending}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    </button>
  </form>
</div>

<style>
  .recipe-chat {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: 600px;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-3) var(--spacing-4);
    background: var(--color-bg-subtle);
    border-bottom: 1px solid var(--color-border);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
  }

  .chat-icon {
    width: 24px;
    height: 24px;
    color: var(--color-primary);
  }

  .chat-header h3 {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }

  .recipe-title {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-light);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-actions {
    display: flex;
    gap: var(--spacing-1);
  }

  .btn-clear,
  .btn-close {
    background: none;
    border: none;
    padding: var(--spacing-2);
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: var(--transition-fast);
  }

  .btn-clear:hover,
  .btn-close:hover {
    background: var(--color-border-light);
  }

  .btn-clear svg,
  .btn-close svg {
    width: 18px;
    height: 18px;
    color: var(--color-text-light);
  }

  .btn-close:hover svg {
    color: var(--color-error);
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-4);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--color-text-light);
  }

  .empty-state p {
    margin: 0 0 var(--spacing-4) 0;
    font-size: var(--text-base);
  }

  .quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    justify-content: center;
    max-width: 320px;
  }

  .quick-action {
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .quick-action:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: rgba(255, 107, 53, 0.05);
  }

  .quick-action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .message {
    display: flex;
    max-width: 85%;
  }

  .message.user {
    align-self: flex-end;
  }

  .message.assistant {
    align-self: flex-start;
  }

  .message-content {
    padding: var(--spacing-3);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    line-height: 1.5;
  }

  .message.user .message-content {
    background: var(--color-primary);
    color: white;
    border-bottom-right-radius: var(--radius-sm);
  }

  .message.assistant .message-content {
    background: var(--color-bg-subtle);
    color: var(--color-text);
    border-bottom-left-radius: var(--radius-sm);
  }

  .typing {
    display: flex;
    gap: 4px;
    padding: var(--spacing-3) var(--spacing-4);
  }

  .dot {
    width: 8px;
    height: 8px;
    background: var(--color-text-light);
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out;
  }

  .dot:nth-child(1) {
    animation-delay: -0.32s;
  }

  .dot:nth-child(2) {
    animation-delay: -0.16s;
  }

  @keyframes bounce {
    0%,
    80%,
    100% {
      transform: scale(0.8);
      opacity: 0.5;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .chat-error {
    padding: var(--spacing-2) var(--spacing-4);
    background: #fef2f2;
    color: var(--color-error);
    font-size: var(--text-sm);
    text-align: center;
  }

  .chat-input {
    display: flex;
    gap: var(--spacing-2);
    padding: var(--spacing-3);
    border-top: 1px solid var(--color-border);
    background: var(--color-surface);
  }

  .chat-input textarea {
    flex: 1;
    padding: var(--spacing-3);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    font-family: inherit;
    resize: none;
    min-height: 42px;
    max-height: 120px;
  }

  .chat-input textarea:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .chat-input textarea:disabled {
    background: var(--color-bg-subtle);
  }

  .btn-send {
    padding: var(--spacing-3);
    background: var(--color-primary);
    border: none;
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-send:hover:not(:disabled) {
    background: var(--color-primary-dark);
  }

  .btn-send:disabled {
    background: var(--color-border);
    cursor: not-allowed;
  }

  .btn-send svg {
    width: 18px;
    height: 18px;
    color: white;
  }

  @media (max-width: 640px) {
    .recipe-chat {
      max-height: none;
      height: 100%;
      border-radius: 0;
      border: none;
    }

    .recipe-title {
      display: none;
    }

    .quick-actions {
      max-width: 100%;
    }
  }
</style>
