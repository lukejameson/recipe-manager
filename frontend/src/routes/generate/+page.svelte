<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { trpc } from '$lib/trpc/client';
  import { authStore } from '$lib/stores/auth.svelte';
  import Header from '$lib/components/Header.svelte';
  import AIBadge from '$lib/components/ai/AIBadge.svelte';
  import AgentSelector, { type SelectedAgentInfo } from '$lib/components/ai/AgentSelector.svelte';
  import Markdown from '$lib/components/Markdown.svelte';

  // Check if user has access to AI chat
  let hasAiChat = $derived(authStore.hasFeature('aiChat'));
  let hasImageSearch = $derived(authStore.hasFeature('imageSearch'));

  interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    images?: string[];
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
  let pendingImages = $state<string[]>([]);
  let fileInput: HTMLInputElement;
  let selectedAgentId = $state<string | null>(null);
  let currentModelId = $state<string | null>(null);

  function handleAgentSelect(agentId: string | null, agentInfo: SelectedAgentInfo) {
    // Clear chat when switching agents
    if (messages.length > 0 && agentId !== selectedAgentId) {
      messages = [];
    }
    currentModelId = agentInfo.modelId;
  }

  // Format model ID for display (extract meaningful part)
  function formatModelName(modelId: string | null): string {
    if (!modelId) return 'Default';
    // Extract model name from full ID like "claude-opus-4-20250514" -> "Opus 4"
    const match = modelId.match(/claude-(\w+)-?([\d.]*)/i);
    if (match) {
      const name = match[1].charAt(0).toUpperCase() + match[1].slice(1);
      const version = match[2] ? ` ${match[2].split('-')[0]}` : '';
      return name + version;
    }
    return modelId;
  }

  async function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        const maxSize = 1024;
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width *= ratio;
          height *= ratio;
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => {
        reject(new Error('Failed to load image'));
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  async function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      if (pendingImages.length >= 5) {
        error = 'Maximum 5 images per message';
        break;
      }
      try {
        const compressed = await compressImage(file);
        pendingImages = [...pendingImages, compressed];
      } catch (err) {
        console.error('Failed to compress image:', err);
      }
    }
    input.value = ''; // Reset input
  }

  function removeImage(index: number) {
    pendingImages = pendingImages.filter((_, i) => i !== index);
  }

  // Default prompts as fallback
  const defaultPrompts = [
    "I want to make something with chicken and vegetables",
    "Give me ideas for a quick weeknight dinner",
    "I'm craving Italian food",
    "What can I make that's vegetarian and high protein?",
    "Suggest a fancy dinner for a date night",
  ];

  let starterPrompts = $state<string[]>(defaultPrompts);
  let loadingPrompts = $state(false);

  // Load personalized suggestions on mount
  onMount(async () => {
    if (!hasAiChat) return;

    loadingPrompts = true;
    try {
      const result = await trpc.ai.getPersonalizedSuggestions.query();
      if (result.suggestions.length > 0) {
        starterPrompts = result.suggestions;
      }
    } catch (err) {
      // Silently fall back to default prompts
      console.error('Failed to load personalized suggestions:', err);
    } finally {
      loadingPrompts = false;
    }
  });

  async function sendMessage(content?: string) {
    const messageContent = content || inputValue.trim();
    if ((!messageContent && pendingImages.length === 0) || loading) return;

    const imagesToSend = [...pendingImages];
    inputValue = '';
    pendingImages = [];
    error = '';

    // Add user message with images
    const userMessage: ChatMessage = {
      role: 'user',
      content: messageContent || 'What can you tell me about this?',
      images: imagesToSend.length > 0 ? imagesToSend : undefined,
    };
    messages = [...messages, userMessage];

    loading = true;

    try {
      const response = await trpc.ai.recipeChat.mutate({
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          images: m.images,
        })),
        agentId: selectedAgentId ?? undefined,
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

  let savingRecipe = $state(false);
  let savingStatus = $state('');

  async function saveRecipe(recipe: GeneratedRecipe) {
    savingRecipe = true;
    savingStatus = 'Saving recipe...';
    try {
      let imageUrl: string | undefined;

      // Try to find a matching image from Pexels if user has the feature
      if (hasImageSearch) {
        savingStatus = 'Finding a photo...';
        try {
          const imageResult = await trpc.recipe.searchImages.mutate({
            query: recipe.title,
            tags: recipe.tags,
            page: 1,
          });
          if (imageResult.images.length > 0) {
            imageUrl = imageResult.images[0].url;
          }
        } catch (imgErr: any) {
          // Continue without image but log the error
          console.error('Failed to fetch image:', imgErr);
        }
      }

      savingStatus = 'Creating recipe...';
      const recipeData: any = {
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
        tags: recipe.tags,
      };

      // Only include imageUrl if we have one
      if (imageUrl) {
        recipeData.imageUrl = imageUrl;
      }

      const newRecipe = await trpc.recipe.create.mutate(recipeData);
      goto(`/recipe/${newRecipe.id}`);
    } catch (err: any) {
      error = err.message || 'Failed to save recipe';
    } finally {
      savingRecipe = false;
      savingStatus = '';
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
    pendingImages = [];
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

{#if hasAiChat}
<main>
  <div class="container">
    <div class="chat-header">
      <div class="header-content">
        <h1>Recipe Ideas</h1>
        <p class="subtitle">Tell me what you're craving and I'll help you create the perfect recipe</p>
      </div>
      <div class="header-actions">
        <AgentSelector bind:selectedAgentId onSelect={handleAgentSelect} />
        <span
          class="model-badge"
          class:opus={currentModelId?.includes('opus')}
          class:haiku={currentModelId?.includes('haiku')}
          title={currentModelId || 'Using default model from settings'}
        >
          {formatModelName(currentModelId)}
        </span>
      </div>
    </div>

    <div class="chat-container">
      {#if messages.length === 0}
        <div class="welcome-state">
          <div class="welcome-icon">👨‍🍳</div>
          <h2>What would you like to cook?</h2>
          <p>Describe what you're in the mood for, ingredients you have, or any dietary preferences.</p>

          <div class="starter-prompts">
            {#if loadingPrompts}
              {#each [1, 2, 3, 4, 5] as _}
                <div class="starter-btn-skeleton"></div>
              {/each}
            {:else}
              {#each starterPrompts as prompt}
                <button class="starter-btn" onclick={() => sendMessage(prompt)}>
                  {prompt}
                </button>
              {/each}
            {/if}
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
                  {#if message.images?.length}
                    <div class="message-images">
                      {#each message.images as image}
                        <img src={image} alt="Uploaded" class="chat-image" />
                      {/each}
                    </div>
                  {/if}
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
                      <button class="btn-save" onclick={() => saveRecipe(message.recipe!)} disabled={savingRecipe}>
                        {#if savingRecipe}
                          <span class="btn-spinner"></span>
                          {savingStatus || 'Saving...'}
                        {:else}
                          Save Recipe
                        {/if}
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

      {#if pendingImages.length > 0}
        <div class="pending-images">
          {#each pendingImages as image, index}
            <div class="pending-image">
              <img src={image} alt="To upload" />
              <button class="remove-image" onclick={() => removeImage(index)}>&times;</button>
            </div>
          {/each}
        </div>
      {/if}

      <div class="input-wrapper">
        <input
          type="file"
          accept="image/*"
          multiple
          bind:this={fileInput}
          onchange={handleFileSelect}
          style="display: none"
        />
        <button
          class="btn-attach"
          onclick={() => fileInput.click()}
          disabled={loading || pendingImages.length >= 5}
          title="Add photo"
          aria-label="Add photo"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
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
          disabled={(!inputValue.trim() && pendingImages.length === 0) || loading}
        >
          {#if loading}
            <span class="spinner"></span>
          {:else}
            Send
          {/if}
        </button>
      </div>
      <p class="hint">Press Enter to send, Shift+Enter for new line. Add photos with the image button.</p>
    </div>
  </div>
</main>
{:else}
<main class="feature-disabled">
  <div class="disabled-message">
    <div class="disabled-icon">🔒</div>
    <h2>Feature Not Available</h2>
    <p>Recipe Ideas is not enabled for your account.</p>
    <p>Ask an admin to enable this feature for you.</p>
    <a href="/" class="btn-primary">Go to Recipes</a>
  </div>
</main>
{/if}

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
    gap: var(--spacing-4);
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

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
  }

  .model-badge {
    display: inline-flex;
    align-items: center;
    padding: var(--spacing-1) var(--spacing-3);
    background: #f3e8ff;
    color: #7c3aed;
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .model-badge.opus {
    background: #fef3c7;
    color: #b45309;
  }

  .model-badge.haiku {
    background: #ecfdf5;
    color: #059669;
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

  .starter-btn-skeleton {
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    height: 38px;
    min-width: 180px;
    animation: skeleton-pulse 1.5s ease-in-out infinite;
  }

  @keyframes skeleton-pulse {
    0%, 100% {
      opacity: 0.5;
    }
    50% {
      opacity: 0.8;
    }
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

  .btn-save:hover:not(:disabled) {
    background: var(--color-primary-dark);
  }

  .btn-save:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .btn-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-right: var(--spacing-2);
    vertical-align: middle;
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
      gap: var(--spacing-3);
    }

    .header-content h1 {
      font-size: var(--text-xl);
    }

    .header-actions {
      width: 100%;
      justify-content: space-between;
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

  /* Image upload styles */
  .pending-images {
    display: flex;
    gap: var(--spacing-2);
    flex-wrap: wrap;
    padding: var(--spacing-2);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .pending-image {
    position: relative;
    width: 80px;
    height: 80px;
  }

  .pending-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: var(--radius-md);
  }

  .remove-image {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--color-error);
    color: white;
    border: none;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .remove-image:hover {
    background: #c53030;
  }

  .btn-attach {
    padding: var(--spacing-2);
    background: transparent;
    border: none;
    color: var(--color-text-light);
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-attach:hover:not(:disabled) {
    background: var(--color-background);
    color: var(--color-primary);
  }

  .btn-attach:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .message-images {
    display: flex;
    gap: var(--spacing-2);
    flex-wrap: wrap;
    margin-bottom: var(--spacing-2);
  }

  .chat-image {
    max-width: 200px;
    max-height: 150px;
    object-fit: cover;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
  }

  /* Feature disabled state */
  main.feature-disabled {
    justify-content: center;
    align-items: center;
    min-height: calc(100vh - 80px);
  }

  .disabled-message {
    text-align: center;
    padding: var(--spacing-8);
    max-width: 400px;
  }

  .disabled-icon {
    font-size: 4rem;
    margin-bottom: var(--spacing-4);
  }

  .disabled-message h2 {
    font-size: var(--text-2xl);
    margin: 0 0 var(--spacing-3);
    color: var(--color-text);
  }

  .disabled-message p {
    color: var(--color-text-secondary);
    margin: 0 0 var(--spacing-2);
    line-height: 1.5;
  }

  .disabled-message .btn-primary {
    display: inline-block;
    margin-top: var(--spacing-4);
    padding: var(--spacing-3) var(--spacing-6);
    background: var(--color-primary);
    color: white;
    text-decoration: none;
    border-radius: var(--radius-md);
    font-weight: var(--font-semibold);
    transition: background 0.2s;
  }

  .disabled-message .btn-primary:hover {
    background: var(--color-primary-dark);
  }
</style>
