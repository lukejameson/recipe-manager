<script lang="ts">
  import { goto } from '$app/navigation';
  import { trpc } from '$lib/trpc/client';
  import { authStore } from '$lib/stores/auth.svelte';
  import Markdown from '$lib/components/Markdown.svelte';

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

  interface Message {
    role: 'user' | 'assistant';
    content: string;
    images?: string[];
    recipe?: GeneratedRecipe;
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

  let hasImageSearch = $derived(authStore.hasFeature('imageSearch'));
  let messages = $state<Message[]>([]);
  let inputValue = $state('');
  let sending = $state(false);
  let error = $state('');
  let messagesContainer: HTMLDivElement;
  let pendingImages = $state<string[]>([]);
  let fileInput: HTMLInputElement;
  let savingRecipe = $state(false);
  let savingStatus = $state('');

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
    input.value = '';
  }

  function removeImage(index: number) {
    pendingImages = pendingImages.filter((_, i) => i !== index);
  }

  // Quick action suggestions
  const quickActions = [
    { label: 'Suggest a side dish', prompt: 'Suggest a side dish recipe that would pair well with this' },
    { label: 'Scale recipe', prompt: 'How do I scale this recipe to serve 8 people?' },
    { label: 'Substitutions', prompt: 'What are some good ingredient substitutions for this recipe?' },
    { label: 'Make it healthier', prompt: 'How can I make this recipe healthier?' },
    { label: 'Wine pairing', prompt: 'What wine would pair well with this dish?' },
    { label: 'Storage tips', prompt: 'How should I store leftovers and how long will they keep?' },
  ];

  function formatTime(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  async function saveRecommendedRecipe(genRecipe: GeneratedRecipe) {
    savingRecipe = true;
    savingStatus = 'Saving recipe...';
    try {
      let imageUrl: string | undefined;

      // Try to find a matching image from Pexels if user has the feature
      if (hasImageSearch) {
        savingStatus = 'Finding a photo...';
        try {
          const imageResult = await trpc.recipe.searchImages.mutate({
            query: genRecipe.title,
            tags: genRecipe.tags,
            page: 1,
          });
          if (imageResult.images.length > 0) {
            imageUrl = imageResult.images[0].url;
          }
        } catch (imgErr: any) {
          console.error('Failed to fetch image:', imgErr);
        }
      }

      savingStatus = 'Creating recipe...';
      const recipeData: any = {
        title: genRecipe.title,
        description: genRecipe.description,
        ingredients: genRecipe.ingredients,
        instructions: genRecipe.instructions,
        prepTime: genRecipe.prepTime,
        cookTime: genRecipe.cookTime,
        servings: genRecipe.servings,
        tags: genRecipe.tags,
      };

      if (imageUrl) {
        recipeData.imageUrl = imageUrl;
      }

      const newRecipe = await trpc.recipe.create.mutate(recipeData);
      onClose();
      goto(`/recipe/${newRecipe.id}`);
    } catch (err: any) {
      error = err.message || 'Failed to save recipe';
    } finally {
      savingRecipe = false;
      savingStatus = '';
    }
  }

  async function sendMessage(content: string) {
    if ((!content.trim() && pendingImages.length === 0) || sending) return;

    const imagesToSend = [...pendingImages];
    error = '';
    const userMessage: Message = {
      role: 'user',
      content: content.trim() || 'What can you tell me about this?',
      images: imagesToSend.length > 0 ? imagesToSend : undefined,
    };
    messages = [...messages, userMessage];
    inputValue = '';
    pendingImages = [];
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
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          images: m.images,
        })),
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: result.message,
        recipe: result.recipe,
      };
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
    pendingImages = [];
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
              <div class="message-text">
                <Markdown content={message.content} />
              </div>
              {#if message.recipe}
                <div class="recipe-card">
                  <div class="recipe-card-header">
                    <h4>{message.recipe.title}</h4>
                    <button
                      class="btn-save"
                      onclick={() => saveRecommendedRecipe(message.recipe!)}
                      disabled={savingRecipe}
                    >
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
                  <details class="recipe-details">
                    <summary>View recipe details</summary>
                    <div class="recipe-section">
                      <h5>Ingredients</h5>
                      <ul>
                        {#each message.recipe.ingredients as ingredient}
                          <li>{ingredient}</li>
                        {/each}
                      </ul>
                    </div>
                    <div class="recipe-section">
                      <h5>Instructions</h5>
                      <ol>
                        {#each message.recipe.instructions as instruction}
                          <li>{instruction}</li>
                        {/each}
                      </ol>
                    </div>
                  </details>
                </div>
              {/if}
            {:else}
              {#if message.images?.length}
                <div class="message-images">
                  {#each message.images as image}
                    <img src={image} alt="Uploaded" class="chat-image" />
                  {/each}
                </div>
              {/if}
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

  {#if pendingImages.length > 0}
    <div class="pending-images">
      {#each pendingImages as image, index}
        <div class="pending-image">
          <img src={image} alt="To upload" />
          <button type="button" class="remove-image" onclick={() => removeImage(index)}>&times;</button>
        </div>
      {/each}
    </div>
  {/if}

  <form class="chat-input" onsubmit={handleSubmit}>
    <input
      type="file"
      accept="image/*"
      capture="environment"
      multiple
      bind:this={fileInput}
      onchange={handleFileSelect}
      style="display: none"
    />
    <button
      type="button"
      class="btn-attach"
      onclick={() => fileInput.click()}
      disabled={sending || pendingImages.length >= 5}
      title="Add image"
      aria-label="Add image"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    </button>
    <textarea
      bind:value={inputValue}
      placeholder="Ask a question..."
      rows="1"
      disabled={sending}
      onkeydown={handleKeydown}
    ></textarea>
    <button type="submit" class="btn-send" disabled={(!inputValue.trim() && pendingImages.length === 0) || sending} aria-label="Send message">
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

  .message-text :global(.markdown) {
    color: var(--color-text);
  }

  .message-text :global(code) {
    background: var(--color-surface);
  }

  .recipe-card {
    margin-top: var(--spacing-3);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--spacing-3);
  }

  .recipe-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-2);
  }

  .recipe-card-header h4 {
    margin: 0;
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--color-text);
  }

  .btn-save {
    padding: var(--spacing-1) var(--spacing-3);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
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
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .recipe-description {
    margin: 0 0 var(--spacing-2);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  .recipe-meta {
    display: flex;
    gap: var(--spacing-3);
    font-size: var(--text-xs);
    color: var(--color-text-light);
    margin-bottom: var(--spacing-2);
  }

  .recipe-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-1);
    margin-bottom: var(--spacing-2);
  }

  .tag {
    padding: 2px var(--spacing-2);
    background: var(--color-background);
    border-radius: var(--radius-full);
    font-size: 10px;
    color: var(--color-text-light);
  }

  .recipe-details {
    margin-top: var(--spacing-2);
    font-size: var(--text-xs);
  }

  .recipe-details summary {
    cursor: pointer;
    color: var(--color-primary);
    font-weight: 500;
  }

  .recipe-details summary:hover {
    text-decoration: underline;
  }

  .recipe-section {
    margin-top: var(--spacing-2);
  }

  .recipe-section h5 {
    margin: 0 0 var(--spacing-1);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .recipe-section ul,
  .recipe-section ol {
    margin: 0;
    padding-left: var(--spacing-4);
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .recipe-section li {
    margin-bottom: 2px;
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

  /* Image upload styles */
  .pending-images {
    display: flex;
    gap: var(--spacing-2);
    flex-wrap: wrap;
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-bg-subtle);
    border-top: 1px solid var(--color-border);
  }

  .pending-image {
    position: relative;
    width: 60px;
    height: 60px;
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
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--color-error);
    color: white;
    border: none;
    font-size: 12px;
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
    background: var(--color-bg-subtle);
    color: var(--color-primary);
  }

  .btn-attach:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .message-images {
    display: flex;
    gap: var(--spacing-1);
    flex-wrap: wrap;
    margin-bottom: var(--spacing-2);
  }

  .chat-image {
    max-width: 120px;
    max-height: 90px;
    object-fit: cover;
    border-radius: var(--radius-sm);
  }
</style>
