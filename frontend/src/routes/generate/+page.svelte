<script lang="ts">
  import { goto } from '$app/navigation';
  import { trpc } from '$lib/trpc/client';
  import Header from '$lib/components/Header.svelte';
  import AIBadge from '$lib/components/ai/AIBadge.svelte';
  import Markdown from '$lib/components/Markdown.svelte';

  interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    recipe?: GeneratedRecipe;
  }

  interface GeneratedRecipe {
    title: string;
    description: string;
    ingredients: string[];
    instructions: string[];
    prepTime?: number;
    cookTime?: number;
    servings?: number;
    tags: string[];
  }

  let messages = $state<ChatMessage[]>([]);
  let inputValue = $state('');
  let loading = $state(false);
  let error = $state('');
  let messagesContainer: HTMLDivElement;

  const starterPrompts = [
    "I want to make something with chicken and vegetables",
    "Give me ideas for a quick weeknight dinner",
    "I'm craving Italian food",
    "What can I make that's vegetarian and high protein?",
    "Suggest a fancy dinner for a date night",
  ];

  async function sendMessage(content?: string) {
    const messageContent = content || inputValue.trim();
    if (!messageContent || loading) return;

    inputValue = '';
    error = '';

    // Add user message
    const userMessage: ChatMessage = { role: 'user', content: messageContent };
    messages = [...messages, userMessage];

    loading = true;

    try {
      const response = await trpc.ai.recipeChat.mutate({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });

      // Add assistant message
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.message,
        recipe: response.recipe,
      };
      messages = [...messages, assistantMessage];

      // Scroll to bottom
      setTimeout(() => {
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 100);
    } catch (err: any) {
      error = err.message || 'Failed to get response';
      // Remove the user message if we failed
      messages = messages.slice(0, -1);
    } finally {
      loading = false;
    }
  }

  async function saveRecipe(recipe: GeneratedRecipe) {
    try {
      const newRecipe = await trpc.recipe.create.mutate({
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
        tags: recipe.tags,
      });
      goto(`/recipe/${newRecipe.id}`);
    } catch (err: any) {
      error = err.message || 'Failed to save recipe';
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    messages = [];
    error = '';
  }

  function formatTime(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
</script>

<Header />

<main>
  <div class="container">
    <div class="chat-header">
      <div class="header-content">
        <h1>Recipe Generator</h1>
        <p class="subtitle">Chat with AI to brainstorm and create new recipes</p>
      </div>
      <AIBadge size="md" />
    </div>

    <div class="chat-container">
      {#if messages.length === 0}
        <div class="welcome-state">
          <div class="welcome-icon">👨‍🍳</div>
          <h2>What would you like to cook?</h2>
          <p>Describe what you're in the mood for, ingredients you have, or any dietary preferences.</p>

          <div class="starter-prompts">
            {#each starterPrompts as prompt}
              <button class="starter-btn" onclick={() => sendMessage(prompt)}>
                {prompt}
              </button>
            {/each}
          </div>
        </div>
      {:else}
        <div class="messages" bind:this={messagesContainer}>
          {#each messages as message}
            <div class="message {message.role}">
              <div class="message-avatar">
                {message.role === 'user' ? '👤' : '👨‍🍳'}
              </div>
              <div class="message-content">
                {#if message.role === 'user'}
                  <p class="message-text">{message.content}</p>
                {:else}
                  <div class="message-text">
                    <Markdown content={message.content} />
                  </div>
                {/if}

                {#if message.recipe}
                  <div class="recipe-card">
                    <div class="recipe-header">
                      <h3>{message.recipe.title}</h3>
                      <button class="btn-save" onclick={() => saveRecipe(message.recipe!)}>
                        Save Recipe
                      </button>
                    </div>

                    {#if message.recipe.description}
                      <p class="recipe-description">{message.recipe.description}</p>
                    {/if}

                    <div class="recipe-meta">
                      {#if message.recipe.prepTime}
                        <span>Prep: {formatTime(message.recipe.prepTime)}</span>
                      {/if}
                      {#if message.recipe.cookTime}
                        <span>Cook: {formatTime(message.recipe.cookTime)}</span>
                      {/if}
                      {#if message.recipe.servings}
                        <span>Serves: {message.recipe.servings}</span>
                      {/if}
                    </div>

                    {#if message.recipe.tags.length > 0}
                      <div class="recipe-tags">
                        {#each message.recipe.tags as tag}
                          <span class="tag">{tag}</span>
                        {/each}
                      </div>
                    {/if}

                    <div class="recipe-details">
                      <div class="recipe-section">
                        <h4>Ingredients</h4>
                        <ul>
                          {#each message.recipe.ingredients as ingredient}
                            <li>{ingredient}</li>
                          {/each}
                        </ul>
                      </div>

                      <div class="recipe-section">
                        <h4>Instructions</h4>
                        <ol>
                          {#each message.recipe.instructions as instruction}
                            <li>{instruction}</li>
                          {/each}
                        </ol>
                      </div>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          {/each}

          {#if loading}
            <div class="message assistant">
              <div class="message-avatar">👨‍🍳</div>
              <div class="message-content">
                <div class="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    <div class="input-section">
      {#if messages.length > 0}
        <button class="btn-clear" onclick={clearChat} title="Start new chat">
          New Chat
        </button>
      {/if}
      <div class="input-wrapper">
        <textarea
          bind:value={inputValue}
          onkeydown={handleKeydown}
          placeholder="Describe what you'd like to make..."
          rows="1"
          disabled={loading}
        ></textarea>
        <button
          class="btn-send"
          onclick={() => sendMessage()}
          disabled={!inputValue.trim() || loading}
        >
          {#if loading}
            <span class="spinner"></span>
          {:else}
            Send
          {/if}
        </button>
      </div>
      <p class="hint">Press Enter to send, Shift+Enter for new line</p>
    </div>
  </div>
</main>

<style>
  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--spacing-4) 0;
    min-height: 0;
  }

  .container {
    flex: 1;
    display: flex;
    flex-direction: column;
    max-width: 900px;
    width: 100%;
    margin: 0 auto;
    padding: 0 var(--spacing-4);
    min-height: 0;
  }

  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-4);
    flex-shrink: 0;
  }

  .header-content h1 {
    font-size: var(--text-2xl);
    font-weight: 700;
    margin: 0;
    color: var(--color-text);
  }

  .subtitle {
    font-size: var(--text-sm);
    color: var(--color-text-light);
    margin: var(--spacing-1) 0 0;
  }

  .chat-container {
    flex: 1;
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    border: 1px solid var(--color-border);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 400px;
  }

  .welcome-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-8);
    text-align: center;
  }

  .welcome-icon {
    font-size: 4rem;
    margin-bottom: var(--spacing-4);
  }

  .welcome-state h2 {
    font-size: var(--text-xl);
    font-weight: 600;
    margin: 0 0 var(--spacing-2);
    color: var(--color-text);
  }

  .welcome-state p {
    color: var(--color-text-light);
    margin: 0 0 var(--spacing-6);
    max-width: 400px;
  }

  .starter-prompts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    justify-content: center;
    max-width: 600px;
  }

  .starter-btn {
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .starter-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: rgba(74, 158, 255, 0.05);
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-4);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .message {
    display: flex;
    gap: var(--spacing-3);
    max-width: 100%;
  }

  .message.user {
    flex-direction: row-reverse;
  }

  .message-avatar {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-full);
    background: var(--color-background);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--text-lg);
    flex-shrink: 0;
  }

  .message.assistant .message-avatar {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
  }

  .message-content {
    flex: 1;
    min-width: 0;
    max-width: 80%;
  }

  .message.user .message-content {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .message-text {
    margin: 0;
    padding: var(--spacing-3) var(--spacing-4);
    border-radius: var(--radius-lg);
    line-height: 1.5;
  }

  p.message-text {
    white-space: pre-wrap;
  }

  .message.user .message-text {
    background: var(--color-primary);
    color: white;
    border-bottom-right-radius: var(--radius-sm);
  }

  .message.assistant .message-text {
    background: var(--color-background);
    color: var(--color-text);
    border-bottom-left-radius: var(--radius-sm);
  }

  .message.assistant .message-text :global(.markdown) {
    color: var(--color-text);
  }

  .message.assistant .message-text :global(code) {
    background: var(--color-surface);
  }

  .message.assistant .message-text :global(pre) {
    background: var(--color-surface);
  }

  .typing-indicator {
    display: flex;
    gap: 4px;
    padding: var(--spacing-3) var(--spacing-4);
    background: var(--color-background);
    border-radius: var(--radius-lg);
    border-bottom-left-radius: var(--radius-sm);
  }

  .typing-indicator span {
    width: 8px;
    height: 8px;
    background: var(--color-text-light);
    border-radius: 50%;
    animation: typing 1.4s infinite;
  }

  .typing-indicator span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .typing-indicator span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typing {
    0%, 60%, 100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    30% {
      transform: translateY(-4px);
      opacity: 1;
    }
  }

  .recipe-card {
    margin-top: var(--spacing-3);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-4);
  }

  .recipe-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--spacing-3);
    margin-bottom: var(--spacing-3);
  }

  .recipe-header h3 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text);
  }

  .btn-save {
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
    white-space: nowrap;
  }

  .btn-save:hover {
    background: var(--color-primary-dark);
  }

  .recipe-description {
    margin: 0 0 var(--spacing-3);
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
    line-height: 1.5;
  }

  .recipe-meta {
    display: flex;
    gap: var(--spacing-4);
    font-size: var(--text-sm);
    color: var(--color-text-light);
    margin-bottom: var(--spacing-3);
  }

  .recipe-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-3);
  }

  .tag {
    padding: var(--spacing-1) var(--spacing-2);
    background: var(--color-background);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    color: var(--color-text-light);
  }

  .recipe-details {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .recipe-section h4 {
    margin: 0 0 var(--spacing-2);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .recipe-section ul,
  .recipe-section ol {
    margin: 0;
    padding-left: var(--spacing-5);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    line-height: 1.6;
  }

  .recipe-section li {
    margin-bottom: var(--spacing-1);
  }

  .error-message {
    background: rgba(239, 68, 68, 0.1);
    color: var(--color-error);
    padding: var(--spacing-3) var(--spacing-4);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    margin-top: var(--spacing-3);
    flex-shrink: 0;
  }

  .input-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    margin-top: var(--spacing-4);
    flex-shrink: 0;
  }

  .input-wrapper {
    display: flex;
    gap: var(--spacing-2);
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: var(--spacing-2);
    transition: var(--transition-fast);
  }

  .input-wrapper:focus-within {
    border-color: var(--color-primary);
  }

  .input-wrapper textarea {
    flex: 1;
    border: none;
    background: transparent;
    padding: var(--spacing-2) var(--spacing-3);
    font-size: var(--text-base);
    font-family: inherit;
    resize: none;
    min-height: 24px;
    max-height: 120px;
  }

  .input-wrapper textarea:focus {
    outline: none;
  }

  .btn-send {
    padding: var(--spacing-2) var(--spacing-5);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 80px;
  }

  .btn-send:hover:not(:disabled) {
    background: var(--color-primary-dark);
  }

  .btn-send:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-send .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .btn-clear {
    align-self: flex-start;
    padding: var(--spacing-1) var(--spacing-3);
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--color-text-light);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-clear:hover {
    background: var(--color-background);
    color: var(--color-text);
  }

  .hint {
    font-size: var(--text-xs);
    color: var(--color-text-lighter);
    margin: 0;
    text-align: center;
  }

  @media (max-width: 640px) {
    .chat-header {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-2);
    }

    .header-content h1 {
      font-size: var(--text-xl);
    }

    .welcome-state {
      padding: var(--spacing-6);
    }

    .welcome-icon {
      font-size: 3rem;
    }

    .starter-prompts {
      flex-direction: column;
    }

    .starter-btn {
      text-align: left;
    }

    .message-content {
      max-width: 90%;
    }

    .recipe-header {
      flex-direction: column;
      gap: var(--spacing-2);
    }

    .btn-save {
      align-self: flex-start;
    }

    .recipe-meta {
      flex-wrap: wrap;
      gap: var(--spacing-2);
    }
  }
</style>
