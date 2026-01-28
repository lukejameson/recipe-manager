<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount, tick } from 'svelte';
  import { trpc } from '$lib/trpc/client';
  import { authStore } from '$lib/stores/auth.svelte';
  import Header from '$lib/components/Header.svelte';
  import AIBadge from '$lib/components/ai/AIBadge.svelte';
  import AgentSelector, { type SelectedAgentInfo } from '$lib/components/ai/AgentSelector.svelte';
  import Markdown from '$lib/components/Markdown.svelte';
  import ChatHistorySidebar from '$lib/components/chat/ChatHistorySidebar.svelte';
  import ImageSearchModal from '$lib/components/ImageSearchModal.svelte';

  // Check if user has access to AI chat
  let hasAiChat = $derived(authStore.hasFeature('aiChat'));
  let hasImageSearch = $derived(authStore.hasFeature('imageSearch'));

  interface ChatMessage {
    id?: string; // Database ID for deletion
    role: 'user' | 'assistant';
    content: string;
    images?: string[];
    recipe?: GeneratedRecipe;
    referencedRecipes?: ReferencedRecipe[];
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

  interface ReferencedRecipe {
    id: string;
    title: string;
    description?: string | null;
    ingredients: string[];
    instructions: string[];
    prepTime?: number | null;
    cookTime?: number | null;
    servings?: number | null;
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
  let currentSessionId = $state<string | null>(null);
  let showSavedIndicator = $state(false);
  let savedIndicatorTimer: ReturnType<typeof setTimeout> | null = null;

  // @ mention state
  let referencedRecipes = $state<ReferencedRecipe[]>([]);
  let showMentionDropdown = $state(false);
  let mentionSearch = $state('');
  let mentionResults = $state<ReferencedRecipe[]>([]);
  let mentionLoading = $state(false);
  let selectedMentionIndex = $state(0);
  let textareaRef: HTMLTextAreaElement;
  let mentionStartPos = $state(-1);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function handleAgentSelect(agentId: string | null, agentInfo: SelectedAgentInfo) {
    // Clear chat when switching agents
    if (messages.length > 0 && agentId !== selectedAgentId) {
      messages = [];
    }
    currentModelId = agentInfo.modelId;
  }

  function handleNewChat() {
    messages = [];
    currentSessionId = null;
    error = '';
    pendingImages = [];
    referencedRecipes = [];
    goto('/generate');
  }

  function handleSessionSelect(sessionId: string) {
    goto(`/generate?session=${sessionId}`);
    // Auto-close sidebar on mobile when session is selected
    closeSidebar();
  }

  function showSaved() {
    showSavedIndicator = true;

    // Clear existing timer
    if (savedIndicatorTimer) {
      clearTimeout(savedIndicatorTimer);
    }

    // Hide after 2 seconds
    savedIndicatorTimer = setTimeout(() => {
      showSavedIndicator = false;
    }, 2000);
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

  // @ mention handling
  async function searchMentions(query: string) {
    if (query.length < 1) {
      mentionResults = [];
      return;
    }

    mentionLoading = true;
    try {
      const results = await trpc.ai.searchRecipesForMention.query({
        query,
        limit: 5,
      });
      // Filter out already referenced recipes
      mentionResults = results.filter(
        (r) => !referencedRecipes.some((ref) => ref.id === r.id)
      );
      selectedMentionIndex = 0;
    } catch (err) {
      console.error('Failed to search recipes:', err);
      mentionResults = [];
    } finally {
      mentionLoading = false;
    }
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    const value = target.value;
    const cursorPos = target.selectionStart;

    // Check if we're in a mention context (typing after @)
    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([^@\s]*)$/);

    if (mentionMatch) {
      showMentionDropdown = true;
      mentionSearch = mentionMatch[1];
      mentionStartPos = cursorPos - mentionMatch[1].length - 1;

      // Debounce the search
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchMentions(mentionMatch[1]);
      }, 150);
    } else {
      showMentionDropdown = false;
      mentionSearch = '';
      mentionStartPos = -1;
    }
  }

  function selectMention(recipe: ReferencedRecipe) {
    // Replace the @query with @RecipeTitle
    const beforeMention = inputValue.substring(0, mentionStartPos);
    const afterCursor = inputValue.substring(textareaRef.selectionStart);
    inputValue = `${beforeMention}@${recipe.title}${afterCursor}`;

    // Add to referenced recipes
    referencedRecipes = [...referencedRecipes, recipe];

    // Close dropdown and reset
    showMentionDropdown = false;
    mentionSearch = '';
    mentionResults = [];
    mentionStartPos = -1;

    // Focus back on textarea
    tick().then(() => {
      textareaRef?.focus();
    });
  }

  function removeMention(id: string) {
    referencedRecipes = referencedRecipes.filter((r) => r.id !== id);
  }

  function handleMentionKeydown(e: KeyboardEvent) {
    if (!showMentionDropdown || mentionResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedMentionIndex = Math.min(selectedMentionIndex + 1, mentionResults.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedMentionIndex = Math.max(selectedMentionIndex - 1, 0);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      selectMention(mentionResults[selectedMentionIndex]);
    } else if (e.key === 'Escape') {
      showMentionDropdown = false;
    }
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

  // Watch for URL changes to load sessions
  $effect(() => {
    if (!hasAiChat) return;

    const sessionId = $page.url.searchParams.get('session');
    if (sessionId && sessionId !== currentSessionId) {
      loadSession(sessionId);
    } else if (!sessionId && currentSessionId) {
      // URL cleared, reset to new chat
      messages = [];
      currentSessionId = null;
      error = '';
      pendingImages = [];
      referencedRecipes = [];
    }
  });

  async function loadSession(sessionId: string) {
    try {
      const { session, messages: loadedMessages } = await trpc.chatHistory.get.query({ id: sessionId });
      currentSessionId = session.id;
      selectedAgentId = session.agentId;

      // Convert loaded messages to ChatMessage format
      messages = loadedMessages.map((msg: any) => ({
        id: msg.id, // Store message ID for deletion
        role: msg.role,
        content: msg.content,
        images: msg.images || undefined,
        referencedRecipes: msg.referencedRecipes || undefined,
        recipe: msg.generatedRecipe || undefined,
      }));

      // Scroll to bottom after loading
      setTimeout(() => {
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 100);
    } catch (err) {
      console.error('Failed to load session:', err);
      error = 'Failed to load chat session';
    }
  }

  async function sendMessage(content?: string) {
    const messageContent = content || inputValue.trim();
    if ((!messageContent && pendingImages.length === 0) || loading) return;

    const imagesToSend = [...pendingImages];
    const recipesToReference = [...referencedRecipes];
    inputValue = '';
    pendingImages = [];
    referencedRecipes = [];
    error = '';

    // Create session on first message
    if (!currentSessionId && messages.length === 0) {
      try {
        const title = messageContent.slice(0, 50) || 'New conversation';
        const session = await trpc.chatHistory.create.mutate({
          title: title,
          agentId: selectedAgentId || undefined,
        });
        currentSessionId = session.id;
        // Update URL without navigation
        window.history.replaceState({}, '', `/generate?session=${session.id}`);
      } catch (err) {
        console.error('Failed to create session:', err);
        // Continue without session - messages will be in memory only
      }
    }

    // Add user message with images and referenced recipes
    const userMessage: ChatMessage = {
      role: 'user',
      content: messageContent || 'What can you tell me about this?',
      images: imagesToSend.length > 0 ? imagesToSend : undefined,
      referencedRecipes: recipesToReference.length > 0 ? recipesToReference : undefined,
    };
    messages = [...messages, userMessage];

    // Save user message to database
    if (currentSessionId) {
      try {
        const savedUserMessage = await trpc.chatHistory.addMessage.mutate({
          sessionId: currentSessionId,
          role: 'user',
          content: userMessage.content,
          images: userMessage.images,
          referencedRecipes: userMessage.referencedRecipes,
        });
        // Update the message with its database ID
        userMessage.id = savedUserMessage.id;
        messages = [...messages.slice(0, -1), userMessage];
      } catch (err) {
        console.error('Failed to save user message:', err);
      }
    }

    loading = true;

    try {
      const response = await trpc.ai.recipeChat.mutate({
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          images: m.images,
        })),
        agentId: selectedAgentId ?? undefined,
        referencedRecipes: recipesToReference.length > 0 ? recipesToReference : undefined,
      });

      // Add assistant message
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.message,
        recipe: response.recipe,
      };
      messages = [...messages, assistantMessage];

      // Save assistant message to database
      if (currentSessionId) {
        try {
          const savedAssistantMessage = await trpc.chatHistory.addMessage.mutate({
            sessionId: currentSessionId,
            role: 'assistant',
            content: assistantMessage.content,
            generatedRecipe: assistantMessage.recipe,
          });
          // Update the message with its database ID
          assistantMessage.id = savedAssistantMessage.id;
          messages = [...messages.slice(0, -1), assistantMessage];
          // Show saved indicator
          showSaved();
        } catch (err) {
          console.error('Failed to save assistant message:', err);
        }
      }

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
  let savedRecipeId = $state<string | null>(null);
  let savedRecipeTitle = $state('');
  let showSaveSuccessModal = $state(false);
  let showRecipePreviewModal = $state(false);
  let recipeToSave = $state<GeneratedRecipe | null>(null);
  let selectedImageUrl = $state<string | null>(null);
  let showImageSearch = $state(false);

  function openSaveRecipeModal(recipe: GeneratedRecipe) {
    recipeToSave = recipe;
    selectedImageUrl = null;
    showRecipePreviewModal = true;
  }

  function closeRecipePreviewModal() {
    showRecipePreviewModal = false;
    recipeToSave = null;
    selectedImageUrl = null;
    showImageSearch = false;
  }

  function handleImageSelect(url: string) {
    selectedImageUrl = url;
    showImageSearch = false;
  }

  async function confirmSaveRecipe() {
    if (!recipeToSave) return;

    savingRecipe = true;
    savingStatus = 'Saving recipe...';

    try {
      let imageUrl = selectedImageUrl;

      // If no image selected and image search is enabled, try auto-search
      if (!imageUrl && hasImageSearch) {
        savingStatus = 'Finding a photo...';
        try {
          const imageResult = await trpc.recipe.searchImages.mutate({
            query: recipeToSave.title,
            tags: recipeToSave.tags,
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
        title: recipeToSave.title,
        description: recipeToSave.description,
        ingredients: recipeToSave.ingredients,
        instructions: recipeToSave.instructions,
        prepTime: recipeToSave.prepTime,
        cookTime: recipeToSave.cookTime,
        servings: recipeToSave.servings,
        tags: recipeToSave.tags,
      };

      if (imageUrl) {
        recipeData.imageUrl = imageUrl;
      }

      const newRecipe = await trpc.recipe.create.mutate(recipeData);

      // Close preview modal and show success
      closeRecipePreviewModal();
      savedRecipeId = newRecipe.id;
      savedRecipeTitle = newRecipe.title;
      showSaveSuccessModal = true;
    } catch (err: any) {
      error = err.message || 'Failed to save recipe';
    } finally {
      savingRecipe = false;
      savingStatus = '';
    }
  }

  // Keep old function for backwards compatibility, but redirect to new flow
  async function saveRecipe(recipe: GeneratedRecipe) {
    openSaveRecipeModal(recipe);
  }

  function closeSaveSuccessModal() {
    showSaveSuccessModal = false;
    savedRecipeId = null;
    savedRecipeTitle = '';
  }

  function viewSavedRecipe() {
    if (savedRecipeId) {
      goto(`/recipe/${savedRecipeId}`);
    }
  }

  function openSavedRecipeNewTab() {
    if (savedRecipeId) {
      window.open(`/recipe/${savedRecipeId}`, '_blank');
      closeSaveSuccessModal();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    // Handle mention dropdown navigation first
    if (showMentionDropdown && mentionResults.length > 0) {
      handleMentionKeydown(e);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape') {
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    messages = [];
    pendingImages = [];
    referencedRecipes = [];
    error = '';
  }

  async function retryLastMessage() {
    if (messages.length < 2 || loading) return;

    // Remove the last assistant message
    const lastUserMessage = messages[messages.length - 2];
    messages = messages.slice(0, -1);

    // Resend the last user message
    await sendMessage(lastUserMessage.content);
  }

  async function resendMessage(index: number) {
    if (loading) return;

    // Get the message to resend
    const messageToResend = messages[index];

    // Remove all messages after this one
    messages = messages.slice(0, index);

    // Resend the message
    await sendMessage(messageToResend.content);
  }

  async function deleteMessage(index: number) {
    if (loading) return;

    const messageToDelete = messages[index];

    // Remove from UI immediately (optimistic update)
    messages = messages.filter((_, i) => i !== index);

    // Delete from database if it has an ID
    if (messageToDelete.id && currentSessionId) {
      try {
        await trpc.chatHistory.deleteMessage.mutate({
          messageId: messageToDelete.id,
        });
      } catch (err) {
        console.error('Failed to delete message from database:', err);
        // Optionally: show error and restore the message
      }
    }
  }

  let editingMessageIndex = $state<number | null>(null);
  let editingContent = $state('');

  // Mobile sidebar state
  let sidebarMobileOpen = $state(false);

  function toggleSidebar() {
    sidebarMobileOpen = !sidebarMobileOpen;
  }

  function closeSidebar() {
    sidebarMobileOpen = false;
  }

  function startEditMessage(index: number, content: string) {
    editingMessageIndex = index;
    editingContent = content;
  }

  function cancelEdit() {
    editingMessageIndex = null;
    editingContent = '';
  }

  async function saveEdit(index: number) {
    if (!editingContent.trim() || loading) return;

    // Update the message content
    messages[index].content = editingContent.trim();

    // Remove all messages after this one (including the AI response)
    messages = messages.slice(0, index + 1);

    // Clear editing state
    editingMessageIndex = null;
    editingContent = '';

    // Resend the edited message
    await sendMessage(messages[index].content);
  }

  function formatTime(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  // Prevent body scroll when sidebar is open on mobile
  $effect(() => {
    if (typeof window !== 'undefined') {
      if (sidebarMobileOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }

    // Cleanup: Always reset overflow when component unmounts
    return () => {
      if (typeof window !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  });
</script>

<Header />

{#if hasAiChat}
<main>
  <!-- Mobile Toggle Button -->
  <button class="mobile-toggle-btn" onclick={toggleSidebar} aria-label="Toggle sidebar">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  </button>

  <!-- Backdrop -->
  {#if sidebarMobileOpen}
    <div class="backdrop" onclick={closeSidebar} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && closeSidebar()}></div>
  {/if}

  <div class="page-layout">
    <ChatHistorySidebar
      bind:currentSessionId
      onNewChat={handleNewChat}
      onSessionSelect={handleSessionSelect}
      mobileOpen={sidebarMobileOpen}
      onMobileClose={closeSidebar}
    />
    <div class="container">
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
          {#each messages as message, i}
            <div class="message {message.role}">
              <div class="message-avatar">
                {message.role === 'user' ? '👤' : '👨‍🍳'}
              </div>
              <div class="message-content">
                {#if message.role === 'user'}
                  {#if message.referencedRecipes?.length}
                    <div class="referenced-recipes-display">
                      {#each message.referencedRecipes as ref}
                        <span class="reference-chip">📖 {ref.title}</span>
                      {/each}
                    </div>
                  {/if}
                  {#if message.images?.length}
                    <div class="message-images">
                      {#each message.images as image}
                        <img src={image} alt="Uploaded" class="chat-image" />
                      {/each}
                    </div>
                  {/if}
                  {#if editingMessageIndex === i}
                    <div class="edit-message-container">
                      <textarea
                        class="edit-textarea"
                        bind:value={editingContent}
                        rows="3"
                      />
                      <div class="edit-actions">
                        <button class="btn-edit-save" onclick={() => saveEdit(i)}>Save & Resend</button>
                        <button class="btn-edit-cancel" onclick={cancelEdit}>Cancel</button>
                      </div>
                    </div>
                  {:else}
                    <p class="message-text">{message.content}</p>
                  {/if}
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

                <!-- Message Actions -->
                {#if !loading && editingMessageIndex !== i}
                  <div class="message-actions">
                    {#if message.role === 'user'}
                      <button
                        class="action-btn"
                        onclick={() => resendMessage(i)}
                        title="Resend this message"
                        aria-label="Resend this message"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13"/>
                          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                        <span class="action-btn-text">Resend</span>
                      </button>
                      <button
                        class="action-btn"
                        onclick={() => startEditMessage(i, message.content)}
                        title="Edit message"
                        aria-label="Edit message"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        <span class="action-btn-text">Edit</span>
                      </button>
                    {:else if i === messages.length - 1}
                      <button
                        class="action-btn"
                        onclick={retryLastMessage}
                        title="Regenerate response"
                        aria-label="Regenerate response"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                        </svg>
                        <span class="action-btn-text">Retry</span>
                      </button>
                    {/if}
                    <button
                      class="action-btn action-btn-delete"
                      onclick={() => deleteMessage(i)}
                      title="Delete message"
                      aria-label="Delete message"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                      <span class="action-btn-text">Delete</span>
                    </button>
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

      {#if referencedRecipes.length > 0}
        <div class="referenced-recipes">
          {#each referencedRecipes as ref}
            <span class="reference-chip removable">
              📖 {ref.title}
              <button type="button" class="remove-ref" onclick={() => removeMention(ref.id)}>&times;</button>
            </span>
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
        <div class="textarea-container">
          <textarea
            bind:value={inputValue}
            bind:this={textareaRef}
            oninput={handleInput}
            onkeydown={handleKeydown}
            placeholder="Describe what you'd like to make... Type @ to reference a recipe"
            rows="1"
            disabled={loading}
          ></textarea>
          {#if showMentionDropdown}
            <div class="mention-dropdown">
              {#if mentionLoading}
                <div class="mention-loading">Searching recipes...</div>
              {:else if mentionResults.length > 0}
                {#each mentionResults as recipe, i}
                  <button
                    type="button"
                    class="mention-item"
                    class:selected={i === selectedMentionIndex}
                    onclick={() => selectMention(recipe)}
                  >
                    <span class="mention-icon">📖</span>
                    <span class="mention-title">{recipe.title}</span>
                  </button>
                {/each}
              {:else if mentionSearch.length > 0}
                <div class="mention-empty">No recipes found matching "{mentionSearch}"</div>
              {:else}
                <div class="mention-hint">Type a recipe name...</div>
              {/if}
            </div>
          {/if}
        </div>
        <AgentSelector bind:selectedAgentId onSelect={handleAgentSelect} />
        <button
          class="btn-send"
          onclick={() => sendMessage()}
          disabled={(!inputValue.trim() && pendingImages.length === 0) || loading}
          title="Send message"
          aria-label="Send message"
        >
          {#if loading}
            <span class="spinner"></span>
          {:else}
            <svg class="send-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            <span class="send-text">Send</span>
          {/if}
        </button>
      </div>
      <p class="hint">Press Enter to send, Shift+Enter for new line. Type @ to reference a recipe from your collection.</p>
    </div>
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

<!-- Recipe Preview/Configure Modal -->
{#if showRecipePreviewModal && recipeToSave}
  <div class="modal-overlay" onclick={closeRecipePreviewModal} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && closeRecipePreviewModal()}>
    <div class="modal-content modal-large" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="0" onkeydown={(e) => e.key === 'Escape' && closeRecipePreviewModal()}>
      <div class="modal-header">
        <h2>Save Recipe</h2>
        <button class="modal-close" onclick={closeRecipePreviewModal} title="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <h3 class="recipe-preview-title">{recipeToSave.title}</h3>

        <!-- Image Section -->
        <div class="image-section">
          <label>Recipe Image</label>
          {#if selectedImageUrl}
            <div class="selected-image-preview">
              <img src={selectedImageUrl} alt={recipeToSave.title} />
              <button class="btn-change-image" onclick={() => showImageSearch = true}>
                Change Image
              </button>
            </div>
          {:else if hasImageSearch}
            <button class="btn-search-image" onclick={() => showImageSearch = true}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Search for Image
            </button>
          {:else}
            <p class="no-image-text">No image will be added (image search not enabled)</p>
          {/if}
        </div>

        <div class="preview-actions">
          <button class="btn-modal-primary" onclick={confirmSaveRecipe} disabled={savingRecipe}>
            {#if savingRecipe}
              <span class="btn-spinner"></span>
              {savingStatus || 'Saving...'}
            {:else}
              Save Recipe
            {/if}
          </button>
          <button class="btn-modal-tertiary" onclick={closeRecipePreviewModal}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Image Search Modal -->
{#if showImageSearch && recipeToSave}
  <ImageSearchModal
    recipeName={recipeToSave.title}
    tags={recipeToSave.tags}
    onSelect={handleImageSelect}
    onClose={() => showImageSearch = false}
  />
{/if}

<!-- Save Success Modal -->
{#if showSaveSuccessModal}
  <div class="modal-overlay" onclick={closeSaveSuccessModal} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && closeSaveSuccessModal()}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="0" onkeydown={(e) => e.key === 'Escape' && closeSaveSuccessModal()}>
      <div class="modal-header">
        <h2>✅ Recipe Saved!</h2>
        <button class="modal-close" onclick={closeSaveSuccessModal} title="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <p class="success-message">
          <strong>{savedRecipeTitle}</strong> has been saved to your collection!
        </p>
        <div class="modal-actions">
          <button class="btn-modal-primary" onclick={openSavedRecipeNewTab}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Open in New Tab
          </button>
          <button class="btn-modal-secondary" onclick={viewSavedRecipe}>
            View Recipe
          </button>
          <button class="btn-modal-tertiary" onclick={closeSaveSuccessModal}>
            Continue Chatting
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: calc(100vh - 80px); /* Account for header height */
    overflow: hidden;
    position: relative;
  }

  .page-layout {
    flex: 1;
    display: grid;
    grid-template-columns: auto 1fr;
    min-height: 0;
    height: 100%;
    overflow: hidden;
    position: relative;
  }

  .container {
    flex: 1;
    display: flex;
    flex-direction: column;
    max-width: 900px;
    width: 100%;
    margin: 0 auto;
    padding: var(--spacing-4);
    min-height: 0;
    height: 100%;
    overflow: hidden;
    position: relative;
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
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }

  .messages::-webkit-scrollbar {
    width: 4px;
  }

  .messages::-webkit-scrollbar-track {
    background: transparent;
  }

  .messages::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 2px;
  }

  .messages::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-light);
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

  /* Message Actions */
  .message-actions {
    display: flex;
    gap: var(--spacing-2);
    margin-top: var(--spacing-2);
    opacity: 0;
    transition: opacity var(--transition-fast);
  }

  .message:hover .message-actions {
    opacity: 1;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-1);
    padding: var(--spacing-1) var(--spacing-2);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .action-btn-text {
    display: inline;
  }

  .action-btn:hover {
    background: var(--color-background);
    color: var(--color-text);
    border-color: var(--color-primary);
  }

  .action-btn-delete:hover {
    background: #fee;
    color: #c00;
    border-color: #faa;
  }

  .action-btn svg {
    flex-shrink: 0;
  }

  /* Edit Message */
  .edit-message-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .edit-textarea {
    width: 100%;
    padding: var(--spacing-3);
    background: var(--color-background);
    border: 2px solid var(--color-primary);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    font-family: inherit;
    color: var(--color-text);
    resize: vertical;
    min-height: 80px;
  }

  .edit-textarea:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .edit-actions {
    display: flex;
    gap: var(--spacing-2);
  }

  .btn-edit-save {
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-edit-save:hover {
    background: var(--color-primary-dark);
  }

  .btn-edit-cancel {
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-edit-cancel:hover {
    background: var(--color-background);
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
    padding: 2px var(--spacing-2);
    background: var(--color-background);
    border-radius: var(--radius-full);
    font-size: 0.7rem;
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
    align-items: center;
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

  .textarea-container {
    flex: 1;
    position: relative;
  }

  .input-wrapper textarea {
    width: 100%;
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

  /* @ mention dropdown */
  .mention-dropdown {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
    margin-bottom: var(--spacing-2);
    max-height: 200px;
    overflow-y: auto;
    z-index: 100;
  }

  .mention-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    width: 100%;
    padding: var(--spacing-2) var(--spacing-3);
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .mention-item:hover,
  .mention-item.selected {
    background: var(--color-background);
  }

  .mention-icon {
    font-size: var(--text-lg);
  }

  .mention-title {
    font-size: var(--text-sm);
    color: var(--color-text);
  }

  .mention-loading,
  .mention-empty,
  .mention-hint {
    padding: var(--spacing-3);
    text-align: center;
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  /* Referenced recipes chips */
  .referenced-recipes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    padding: var(--spacing-2);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-2);
  }

  .reference-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-1);
    padding: var(--spacing-1) var(--spacing-2);
    background: var(--color-primary-light, rgba(74, 158, 255, 0.1));
    color: var(--color-primary);
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
    font-weight: 500;
  }

  .reference-chip.removable {
    padding-right: var(--spacing-1);
  }

  .remove-ref {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: none;
    background: rgba(0, 0, 0, 0.1);
    color: var(--color-primary);
    border-radius: 50%;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    margin-left: var(--spacing-1);
  }

  .remove-ref:hover {
    background: rgba(0, 0, 0, 0.2);
  }

  /* Referenced recipes in message display */
  .referenced-recipes-display {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-1);
    margin-bottom: var(--spacing-2);
  }

  .referenced-recipes-display .reference-chip {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    font-size: var(--text-xs);
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
    gap: var(--spacing-1);
    min-width: 80px;
  }

  .send-icon {
    display: none;
  }

  .send-text {
    display: inline;
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

  .hint {
    font-size: var(--text-xs);
    color: var(--color-text-lighter);
    margin: 0;
    text-align: center;
  }

  @media (max-width: 768px) {
    .hint {
      display: none;
    }
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

  /* Save Success Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal-content {
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow: auto;
    animation: slideUp 0.3s ease-out;
  }

  .modal-large {
    max-width: 600px;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-5);
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h2 {
    margin: 0;
    font-size: var(--text-xl);
    color: var(--color-text);
  }

  .modal-close {
    background: none;
    border: none;
    color: var(--color-text-light);
    cursor: pointer;
    padding: var(--spacing-2);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: var(--transition-fast);
  }

  .modal-close:hover {
    background: var(--color-background);
    color: var(--color-text);
  }

  .modal-body {
    padding: var(--spacing-5);
  }

  .success-message {
    margin: 0 0 var(--spacing-5);
    font-size: var(--text-base);
    color: var(--color-text);
    text-align: center;
  }

  .success-message strong {
    color: var(--color-primary);
  }

  .modal-actions {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .btn-modal-primary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2);
    padding: var(--spacing-3) var(--spacing-4);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    font-size: var(--text-base);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-modal-primary:hover {
    background: var(--color-primary-dark);
    transform: translateY(-1px);
  }

  .btn-modal-secondary {
    padding: var(--spacing-3) var(--spacing-4);
    background: var(--color-surface);
    color: var(--color-text);
    border: 2px solid var(--color-primary);
    border-radius: var(--radius-lg);
    font-size: var(--text-base);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-modal-secondary:hover {
    background: var(--color-primary-light);
  }

  .btn-modal-tertiary {
    padding: var(--spacing-3) var(--spacing-4);
    background: transparent;
    color: var(--color-text-secondary);
    border: none;
    border-radius: var(--radius-lg);
    font-size: var(--text-base);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-modal-tertiary:hover {
    background: var(--color-background);
    color: var(--color-text);
  }

  /* Recipe Preview Modal */
  .recipe-preview-title {
    margin: 0 0 var(--spacing-4);
    font-size: var(--text-xl);
    color: var(--color-text);
  }

  .image-section {
    margin-bottom: var(--spacing-5);
  }

  .image-section label {
    display: block;
    margin-bottom: var(--spacing-2);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text);
  }

  .selected-image-preview {
    position: relative;
    border-radius: var(--radius-lg);
    overflow: hidden;
    border: 2px solid var(--color-border);
  }

  .selected-image-preview img {
    width: 100%;
    height: 300px;
    object-fit: cover;
    display: block;
  }

  .btn-change-image {
    position: absolute;
    bottom: var(--spacing-3);
    right: var(--spacing-3);
    padding: var(--spacing-2) var(--spacing-3);
    background: rgba(255, 255, 255, 0.95);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
    backdrop-filter: blur(8px);
  }

  .btn-change-image:hover {
    background: white;
    transform: translateY(-1px);
  }

  .btn-search-image {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2);
    width: 100%;
    padding: var(--spacing-4);
    background: var(--color-background);
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-lg);
    font-size: var(--text-base);
    color: var(--color-text);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-search-image:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }

  .no-image-text {
    padding: var(--spacing-3);
    background: var(--color-background);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    text-align: center;
    margin: 0;
  }

  .preview-actions {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
    margin-top: var(--spacing-4);
  }

  .btn-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
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

  /* Mobile Toggle Button */
  .mobile-toggle-btn {
    display: none;
    position: fixed;
    top: 80px;
    left: var(--spacing-3);
    width: 44px;
    height: 44px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    cursor: pointer;
    align-items: center;
    justify-content: center;
    z-index: 150;
    transition: var(--transition-fast);
  }

  .mobile-toggle-btn:hover {
    background: var(--color-primary-dark);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .mobile-toggle-btn:active {
    transform: translateY(0);
  }

  /* Backdrop */
  .backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 190;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* Mobile Responsive Styles */
  @media (max-width: 768px) {
    main {
      position: fixed;
      top: 80px;
      left: 0;
      right: 0;
      bottom: 0;
      height: auto;
    }

    .mobile-toggle-btn {
      display: flex;
    }

    .backdrop {
      display: block;
    }

    .page-layout {
      grid-template-columns: 1fr;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    }

    .container {
      padding: var(--spacing-3);
      position: relative;
      height: 100%;
      overflow: hidden;
    }

    .chat-container {
      height: 100%;
      min-height: 0;
    }

    /* Ensure touch targets are 44px minimum */
    .btn-attach,
    .btn-send,
    .action-btn {
      min-height: 44px;
      min-width: 44px;
    }

    .session-item {
      min-height: 44px;
    }

    /* Icon-only action buttons on mobile - compact */
    .action-btn-text {
      display: none;
    }

    .action-btn {
      padding: var(--spacing-1);
      width: 32px;
      height: 32px;
      justify-content: center;
      min-height: 32px;
      min-width: 32px;
    }

    .action-btn svg {
      width: 16px;
      height: 16px;
    }

    .message-actions {
      margin-top: var(--spacing-1);
      gap: var(--spacing-1);
    }

    /* Compact send button - icon only */
    .btn-send {
      padding: var(--spacing-2);
      min-width: 44px;
      width: 44px;
      height: 44px;
    }

    .send-icon {
      display: block;
    }

    .send-text {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .container {
      padding: var(--spacing-2);
    }

    .input-wrapper {
      flex-wrap: wrap;
      padding: var(--spacing-1);
      gap: var(--spacing-1);
    }

    .message-content {
      max-width: 95%;
    }

    .btn-attach {
      padding: var(--spacing-1);
      min-width: 40px;
      width: 40px;
    }
  }

  @media (max-width: 480px) {
    .input-wrapper {
      padding: 6px;
      gap: 6px;
    }

    .input-wrapper textarea {
      font-size: 16px; /* Prevent iOS zoom */
      padding: var(--spacing-1) var(--spacing-2);
    }

    .input-section {
      padding-bottom: env(safe-area-inset-bottom, 0); /* iOS safe area */
    }

    .btn-attach {
      min-width: 36px;
      width: 36px;
      height: 36px;
    }

    .btn-attach svg {
      width: 18px;
      height: 18px;
    }

    .btn-send {
      width: 40px;
      height: 40px;
      min-width: 40px;
    }

    .btn-send svg {
      width: 18px;
      height: 18px;
    }
  }

  /* Touch device optimizations */
  @media (hover: none) {
    .message-actions {
      opacity: 1; /* Always visible on touch devices */
    }

    .star-btn {
      opacity: 0.6;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .sidebar,
    .backdrop,
    .mobile-toggle-btn {
      transition: none;
      animation: none;
    }
  }
</style>
