<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { trpc } from '$lib/trpc/client';
  import Header from '$lib/components/Header.svelte';
  import RelatedRecipes from '$lib/components/RelatedRecipes.svelte';
  import RecipeComponentView from '$lib/components/RecipeComponentView.svelte';
  import { formatTime, formatServings, parseDurationFromText, formatTimerDisplay } from '$lib/utils/format';
  import { scaleRecipe } from '$lib/utils/recipe-scaling';
  import AIButton from '$lib/components/ai/AIButton.svelte';
  import SubstitutionModal from '$lib/components/ai/SubstitutionModal.svelte';
  import ImprovementModal from '$lib/components/ai/ImprovementModal.svelte';
  import AdaptRecipeModal from '$lib/components/ai/AdaptRecipeModal.svelte';
  import TechniqueTooltip from '$lib/components/ai/TechniqueTooltip.svelte';
  import RecipeChat from '$lib/components/RecipeChat.svelte';

  let recipe = $state<any>(null);
  let loading = $state(true);
  let error = $state('');
  let cookingMode = $state(false);
  let currentStep = $state(0);
  let scaledServings = $state<number | null>(null);
  let showRatingForm = $state(false);
  let rating = $state(0);
  let notes = $state('');
  let copied = $state(false);
  let wakeLock: WakeLockSentinel | null = null;

  // Timer state
  let timerEndTime = $state<number | null>(null); // Timestamp when timer should end
  let timerRunning = $state(false);
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let timerInitialSeconds = $state(0);
  let timerDisplaySeconds = $state(0); // For display only
  let timerPausedRemaining = $state(0); // Seconds remaining when paused
  let notificationPermission = $state<NotificationPermission>('default');

  // Components for compound recipes
  let components = $state<any[]>([]);
  let aggregatedNutrition = $state<any>(null);

  // AI nutrition calculation
  let calculatingNutrition = $state(false);
  let nutritionError = $state('');

  // AI features state
  let showSubstitutionModal = $state(false);
  let selectedIngredient = $state('');
  let showImprovementModal = $state(false);
  let showAdaptModal = $state(false);
  let showTechniqueTooltip = $state(false);
  let selectedTechnique = $state<{ term: string; definition: string; steps?: string[]; tips?: string[] } | null>(null);
  let loadingTechnique = $state(false);
  let showChat = $state(false);
  let showMoreMenu = $state(false);

  function closeMoreMenu() {
    showMoreMenu = false;
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.more-menu-container')) {
      showMoreMenu = false;
    }
  }

  async function handleCalculateNutrition() {
    if (!recipe) return;

    calculatingNutrition = true;
    nutritionError = '';

    try {
      const nutrition = await trpc.ai.calculateNutrition.mutate({
        ingredients: recipe.ingredients,
        servings: recipe.servings || 1,
        title: recipe.title,
      });

      // Round all nutrition values to nearest whole number
      const roundedNutrition: Record<string, number> = {};
      for (const [key, value] of Object.entries(nutrition)) {
        if (value != null) {
          roundedNutrition[key] = Math.round(value);
        }
      }

      // Update the recipe with the new nutrition
      await trpc.recipe.update.mutate({
        id: recipe.id,
        data: { nutrition: roundedNutrition },
      });

      // Reload to show new nutrition
      await loadRecipe();
    } catch (err: any) {
      nutritionError = err.message || 'Failed to calculate nutrition';
    } finally {
      calculatingNutrition = false;
    }
  }

  async function requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) {
        // Wake lock request failed (e.g., low battery)
      }
    }
  }

  async function releaseWakeLock() {
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      if (cookingMode) {
        requestWakeLock();
      }
      // Recalculate timer when returning to app (handles screen lock)
      if (timerRunning && timerEndTime) {
        updateTimerDisplay();
      }
    }
  }

  // Timer functions - uses end time so it survives screen lock
  function updateTimerDisplay() {
    if (timerEndTime && timerRunning) {
      const remaining = Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000));
      timerDisplaySeconds = remaining;
      if (remaining === 0) {
        timerComplete();
      }
    }
  }

  function startTimer(seconds: number) {
    stopTimer();
    timerInitialSeconds = seconds;
    timerEndTime = Date.now() + seconds * 1000;
    timerDisplaySeconds = seconds;
    timerRunning = true;
    timerInterval = setInterval(updateTimerDisplay, 250); // Update 4x per second for smoother display
  }

  function pauseTimer() {
    if (timerRunning && timerEndTime) {
      timerPausedRemaining = Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000));
      timerDisplaySeconds = timerPausedRemaining;
    }
    timerRunning = false;
    timerEndTime = null;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function resumeTimer() {
    if (timerPausedRemaining > 0 && !timerRunning) {
      timerEndTime = Date.now() + timerPausedRemaining * 1000;
      timerDisplaySeconds = timerPausedRemaining;
      timerRunning = true;
      timerInterval = setInterval(updateTimerDisplay, 250);
    }
  }

  function stopTimer() {
    timerRunning = false;
    timerEndTime = null;
    timerDisplaySeconds = 0;
    timerInitialSeconds = 0;
    timerPausedRemaining = 0;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function resetTimer() {
    pauseTimer();
    timerPausedRemaining = timerInitialSeconds;
    timerDisplaySeconds = timerInitialSeconds;
  }

  function timerComplete() {
    const wasRunning = timerRunning;
    timerRunning = false;
    timerEndTime = null;
    timerDisplaySeconds = 0;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    // Only notify if timer was actually running (not already completed)
    if (wasRunning && notificationPermission === 'granted') {
      new Notification('Timer Complete!', {
        body: `Step ${currentStep + 1} timer has finished`,
        icon: '/favicon.png',
        tag: 'recipe-timer',
        requireInteraction: true,
      });
    }
    // Also play a sound if possible
    if (wasRunning) {
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onraxu8HGy83Nzs7OzMrHwby3sq2on5iRi4WBfXp4d3d4eXt9gIOHi4+Tm5+kqa2xtLe5u73AwsXHysvMzc3Nzc3My8rJx8XDwL68ubWyrauopaKfnJmXlZSUlJSVl5manZ+ho6aoq62vsLGys7O0tLS0tLSzs7KxsK+urKuqqainp6enpqampqampqanp6eoqaqrrK2ur7CxsbKys7O0tLS0tLS0tLS0s7Ozs7OzsrKysbGwsK+vr6+vr6+vr6+vr6+vr6+vr6+vr6+vr6+vr6+vr6+vr6+vr6+vr6+vr6+vr6+vr66urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6t');
        audio.play().catch(() => {});
      } catch {}
    }
  }

  async function requestNotificationPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      notificationPermission = permission;
    }
  }

  // Trigger iOS Siri Shortcut for native timer
  function startSiriTimer(seconds: number) {
    const minutes = Math.ceil(seconds / 60);
    // Open shortcut without redirect - user swipes back from app switcher
    const shortcutUrl = `shortcuts://run-shortcut?name=${encodeURIComponent('Recipe Timer')}&input=text&text=${minutes}`;
    window.location.href = shortcutUrl;
  }

  // Get duration for current step
  const currentStepDuration = $derived(
    recipe?.instructions?.[currentStep]
      ? parseDurationFromText(recipe.instructions[currentStep])
      : null
  );

  onMount(() => {
    loadRecipe();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('click', handleClickOutside);
    // Check notification permission
    if ('Notification' in window) {
      notificationPermission = Notification.permission;
    }
  });

  onDestroy(() => {
    releaseWakeLock();
    stopTimer();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', handleClickOutside);
    }
  });

  async function loadRecipe() {
    loading = true;
    error = '';
    try {
      recipe = await trpc.recipe.get.query({ id: $page.params.id });
      scaledServings = recipe.servings;
      rating = recipe.rating || 0;
      notes = recipe.notes || '';

      // Load components for compound recipes
      const hierarchy = await trpc.recipe.getHierarchy.query({ recipeId: $page.params.id });
      components = hierarchy;

      // Load aggregated nutrition if has components
      if (components.length > 0) {
        aggregatedNutrition = await trpc.recipe.getAggregatedNutrition.query({ recipeId: $page.params.id });
      } else {
        aggregatedNutrition = null;
      }
    } catch (err: any) {
      error = err.message || 'Failed to load recipe';
    } finally {
      loading = false;
    }
  }

  async function handleToggleFavorite() {
    try {
      await trpc.recipe.toggleFavorite.mutate({ id: $page.params.id });
      loadRecipe();
    } catch (err: any) {
      alert('Failed to toggle favorite: ' + err.message);
    }
  }

  async function handleSaveRating() {
    try {
      await trpc.recipe.updateRating.mutate({
        id: $page.params.id,
        rating: rating > 0 ? rating : undefined,
        notes: notes.trim() || undefined,
      });
      showRatingForm = false;
      loadRecipe();
    } catch (err: any) {
      alert('Failed to save rating: ' + err.message);
    }
  }

  async function handleMarkAsCooked() {
    try {
      await trpc.recipe.markAsCooked.mutate({ id: $page.params.id });
      loadRecipe();
    } catch (err: any) {
      alert('Failed to mark as cooked: ' + err.message);
    }
  }

  function toggleCookingMode() {
    cookingMode = !cookingMode;
    currentStep = 0;
    if (cookingMode) {
      requestWakeLock();
    } else {
      releaseWakeLock();
      stopTimer();
    }
  }

  function nextStep() {
    if (currentStep < (recipe?.instructions?.length || 0) - 1) {
      currentStep++;
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
    }
  }

  const scaledIngredients = $derived(
    recipe && scaledServings && recipe.servings
      ? scaleRecipe(recipe.ingredients, recipe.servings, scaledServings)
      : recipe?.ingredients || []
  );

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    try {
      await trpc.recipe.delete.mutate({ id: $page.params.id });
      goto('/');
    } catch (err: any) {
      alert('Failed to delete recipe: ' + err.message);
    }
  }

  function handleEdit() {
    goto(`/recipe/${$page.params.id}/edit`);
  }

  function recipeToJsonLd(recipe: any): string {
    const jsonLd: Record<string, any> = {
      "@context": "https://schema.org",
      "@type": "Recipe",
      "name": recipe.title,
    };

    if (recipe.description) jsonLd["description"] = recipe.description;
    if (recipe.prepTime) jsonLd["prepTime"] = `PT${recipe.prepTime}M`;
    if (recipe.cookTime) jsonLd["cookTime"] = `PT${recipe.cookTime}M`;
    if (recipe.totalTime) jsonLd["totalTime"] = `PT${recipe.totalTime}M`;
    if (recipe.servings) jsonLd["recipeYield"] = `${recipe.servings} servings`;
    if (recipe.ingredients?.length) jsonLd["recipeIngredient"] = recipe.ingredients;
    if (recipe.instructions?.length) {
      jsonLd["recipeInstructions"] = recipe.instructions.map((step: string, i: number) => ({
        "@type": "HowToStep",
        "position": i + 1,
        "text": step
      }));
    }
    if (recipe.imageUrl) jsonLd["image"] = recipe.imageUrl;
    if (recipe.sourceUrl) jsonLd["url"] = recipe.sourceUrl;
    if (recipe.tags?.length) {
      jsonLd["recipeCategory"] = recipe.tags.map((t: any) => t.name);
      jsonLd["keywords"] = recipe.tags.map((t: any) => t.name).join(", ");
    }
    if (recipe.difficulty) jsonLd["difficulty"] = recipe.difficulty;

    // Add nutrition information
    if (recipe.nutrition && Object.keys(recipe.nutrition).length > 0) {
      const nutritionLd: Record<string, any> = {
        "@type": "NutritionInformation"
      };
      if (recipe.nutrition.calories !== undefined) nutritionLd["calories"] = `${recipe.nutrition.calories} calories`;
      if (recipe.nutrition.protein !== undefined) nutritionLd["proteinContent"] = `${recipe.nutrition.protein} g`;
      if (recipe.nutrition.carbohydrates !== undefined) nutritionLd["carbohydrateContent"] = `${recipe.nutrition.carbohydrates} g`;
      if (recipe.nutrition.fat !== undefined) nutritionLd["fatContent"] = `${recipe.nutrition.fat} g`;
      if (recipe.nutrition.saturatedFat !== undefined) nutritionLd["saturatedFatContent"] = `${recipe.nutrition.saturatedFat} g`;
      if (recipe.nutrition.fiber !== undefined) nutritionLd["fiberContent"] = `${recipe.nutrition.fiber} g`;
      if (recipe.nutrition.sugar !== undefined) nutritionLd["sugarContent"] = `${recipe.nutrition.sugar} g`;
      if (recipe.nutrition.sodium !== undefined) nutritionLd["sodiumContent"] = `${recipe.nutrition.sodium} mg`;
      if (recipe.nutrition.cholesterol !== undefined) nutritionLd["cholesterolContent"] = `${recipe.nutrition.cholesterol} mg`;
      jsonLd["nutrition"] = nutritionLd;
    }

    return JSON.stringify(jsonLd, null, 2);
  }

  async function copyAsJsonLd() {
    if (!recipe) return;
    const jsonLd = recipeToJsonLd(recipe);
    try {
      await navigator.clipboard.writeText(jsonLd);
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    } catch (err) {
      alert('Failed to copy to clipboard');
    }
  }

  // AI feature handlers
  function openSubstitutionModal(ingredient: string) {
    selectedIngredient = ingredient;
    showSubstitutionModal = true;
  }

  async function handleExplainTechnique(term: string, context?: string) {
    loadingTechnique = true;
    try {
      const result = await trpc.ai.explainTechnique.mutate({ term, context });
      selectedTechnique = result;
      showTechniqueTooltip = true;
    } catch (err: any) {
      alert('Failed to explain technique: ' + err.message);
    } finally {
      loadingTechnique = false;
    }
  }

  async function handleSaveAdaptedAsCopy(adapted: any) {
    try {
      const newRecipe = await trpc.recipe.create.mutate({
        title: adapted.title,
        description: recipe.description,
        ingredients: adapted.ingredients,
        instructions: adapted.instructions,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        totalTime: recipe.totalTime,
        servings: recipe.servings,
        imageUrl: recipe.imageUrl,
        sourceUrl: recipe.sourceUrl,
        tags: recipe.tags?.map((t: any) => t.name) || [],
      });
      showAdaptModal = false;
      goto(`/recipe/${newRecipe.id}`);
    } catch (err: any) {
      alert('Failed to save adapted recipe: ' + err.message);
    }
  }

  async function handleUpdateWithAdapted(adapted: any) {
    try {
      await trpc.recipe.update.mutate({
        id: recipe.id,
        data: {
          title: adapted.title,
          ingredients: adapted.ingredients,
          instructions: adapted.instructions,
        },
      });
      showAdaptModal = false;
      await loadRecipe();
    } catch (err: any) {
      alert('Failed to update recipe: ' + err.message);
    }
  }

  async function handleApplyImprovements(improved: { title: string; ingredients: string[]; instructions: string[] }) {
    try {
      await trpc.recipe.update.mutate({
        id: recipe.id,
        data: {
          title: improved.title,
          ingredients: improved.ingredients,
          instructions: improved.instructions,
          // Clear saved improvement ideas since they've been applied
          improvementIdeas: undefined,
        },
      });
      showImprovementModal = false;
      await loadRecipe();
    } catch (err: any) {
      alert('Failed to apply improvements: ' + err.message);
    }
  }
</script>

<Header />

<main>
  <div class="container">
    {#if loading}
      <div class="loading">Loading recipe...</div>
    {:else if error}
      <div class="error">{error}</div>
      <a href="/" class="btn-back">← Back to Recipes</a>
    {:else if recipe}
      <div class="recipe-header">
        <a href="/" class="btn-back">← Back to Recipes</a>
        <div class="actions">
          <!-- Primary actions - always visible -->
          <button onclick={toggleCookingMode} class="btn-cooking">
            <span class="icon">{cookingMode ? '📖' : '👨‍🍳'}</span>
            <span>{cookingMode ? 'View Recipe' : 'Cook'}</span>
          </button>
          <button onclick={handleEdit} class="btn-edit">
            <span class="icon">✏️</span>
            <span>Edit</span>
          </button>
          <button onclick={() => showChat = !showChat} class="btn-chat" class:active={showChat}>
            <span class="icon">💬</span>
            <span>Ask AI</span>
          </button>

          <!-- More menu for secondary actions -->
          <div class="more-menu-container">
            <button
              onclick={() => showMoreMenu = !showMoreMenu}
              class="btn-more"
              class:active={showMoreMenu}
            >
              <span class="icon">⋯</span>
              <span>More</span>
            </button>

            {#if showMoreMenu}
              <div class="more-menu" onclick={closeMoreMenu} role="menu">
                <button onclick={handleToggleFavorite} class="menu-item" role="menuitem">
                  <span class="menu-icon">{recipe.isFavorite ? '★' : '☆'}</span>
                  <span>{recipe.isFavorite ? 'Remove Favorite' : 'Add to Favorites'}</span>
                </button>
                <button onclick={() => { showImprovementModal = true; closeMoreMenu(); }} class="menu-item" role="menuitem">
                  <span class="menu-icon ai">AI</span>
                  <span>Suggest Improvements</span>
                </button>
                <button onclick={() => { showAdaptModal = true; closeMoreMenu(); }} class="menu-item" role="menuitem">
                  <span class="menu-icon ai">AI</span>
                  <span>Adapt for Diet</span>
                </button>
                <button onclick={copyAsJsonLd} class="menu-item" role="menuitem">
                  <span class="menu-icon">{copied ? '✓' : '📋'}</span>
                  <span>{copied ? 'Copied!' : 'Export as JSON-LD'}</span>
                </button>
                <div class="menu-divider"></div>
                <button onclick={handleDelete} class="menu-item danger" role="menuitem">
                  <span class="menu-icon">🗑️</span>
                  <span>Delete Recipe</span>
                </button>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Recipe Chat Panel -->
      {#if showChat && !cookingMode}
        <div class="chat-panel">
          <RecipeChat {recipe} onClose={() => showChat = false} />
        </div>
      {/if}

      {#if cookingMode}
        <!-- Cooking Mode View -->
        <div class="cooking-mode">
          <div class="cooking-header">
            <h2>Step {currentStep + 1} of {recipe.instructions.length}</h2>
            <button onclick={handleMarkAsCooked} class="btn-mark-cooked">
              <span class="icon">✓</span>
              <span>Mark as Cooked</span>
            </button>
          </div>

          <div class="cooking-step">
            <div class="step-number">{currentStep + 1}</div>
            <p class="step-text">{recipe.instructions[currentStep]}</p>
          </div>

          <!-- Timer Section -->
          {#if currentStepDuration || timerDisplaySeconds > 0 || timerPausedRemaining > 0}
            <div class="timer-section">
              {#if timerDisplaySeconds > 0 || timerRunning || timerPausedRemaining > 0}
                <!-- Active Timer Display -->
                <div class="timer-display" class:timer-complete={timerDisplaySeconds === 0 && timerInitialSeconds > 0 && !timerRunning && timerPausedRemaining === 0}>
                  <div class="timer-time">{formatTimerDisplay(timerDisplaySeconds || timerPausedRemaining)}</div>
                  <div class="timer-controls">
                    {#if timerRunning}
                      <button onclick={pauseTimer} class="btn-timer">
                        <span class="timer-icon">⏸</span>
                        Pause
                      </button>
                    {:else if timerDisplaySeconds > 0 || timerPausedRemaining > 0}
                      <button onclick={resumeTimer} class="btn-timer btn-timer-primary">
                        <span class="timer-icon">▶</span>
                        Resume
                      </button>
                    {/if}
                    <button onclick={resetTimer} class="btn-timer" disabled={timerPausedRemaining === timerInitialSeconds && !timerRunning}>
                      <span class="timer-icon">↺</span>
                      Reset
                    </button>
                    <button onclick={stopTimer} class="btn-timer btn-timer-danger">
                      <span class="timer-icon">✕</span>
                      Stop
                    </button>
                  </div>
                  {#if timerDisplaySeconds === 0 && timerInitialSeconds > 0 && !timerRunning && timerPausedRemaining === 0}
                    <div class="timer-complete-message">Timer complete!</div>
                  {/if}
                </div>
              {:else if currentStepDuration}
                <!-- Start Timer Button -->
                <div class="timer-start">
                  <div class="timer-buttons">
                    <button
                      onclick={() => startTimer(currentStepDuration)}
                      class="btn-start-timer"
                    >
                      <span class="timer-icon">⏱</span>
                      Start {formatTimerDisplay(currentStepDuration)} Timer
                    </button>
                    <button
                      onclick={() => startSiriTimer(currentStepDuration)}
                      class="btn-siri-timer"
                      title="Set native iOS timer via Siri Shortcut"
                    >
                      <span class="timer-icon">🍎</span>
                      iOS Timer
                    </button>
                  </div>
                  <p class="timer-hint">iOS Timer sets a native alarm that works when screen is locked</p>
                </div>
              {/if}
            </div>
          {/if}

          <div class="cooking-navigation">
            <button onclick={prevStep} disabled={currentStep === 0} class="btn-nav">
              <span class="icon">←</span>
              <span>Previous</span>
            </button>
            <button onclick={nextStep} disabled={currentStep === recipe.instructions.length - 1} class="btn-nav">
              <span>Next</span>
              <span class="icon">→</span>
            </button>
          </div>

          <div class="cooking-ingredients">
            <h3>Quick Reference - Ingredients</h3>
            <ul>
              {#each scaledIngredients as ingredient}
                <li>{ingredient}</li>
              {/each}
            </ul>
          </div>
        </div>
      {:else}

      <article class="recipe-detail">
        {#if recipe.imageUrl}
          <img src={recipe.imageUrl} alt={recipe.title} class="recipe-image" />
        {/if}

        <h1>{recipe.title}</h1>

        {#if recipe.description}
          <p class="description">{recipe.description}</p>
        {/if}

        <div class="meta">
          {#if recipe.prepTime}
            <div class="meta-item">
              <span class="label">⏱️ Prep Time:</span>
              <span class="value">{formatTime(recipe.prepTime)}</span>
            </div>
          {/if}
          {#if recipe.cookTime}
            <div class="meta-item">
              <span class="label">🔥 Cook Time:</span>
              <span class="value">{formatTime(recipe.cookTime)}</span>
            </div>
          {/if}
          {#if recipe.totalTime}
            <div class="meta-item">
              <span class="label">⏰ Total Time:</span>
              <span class="value">{formatTime(recipe.totalTime)}</span>
            </div>
          {/if}
          {#if recipe.servings}
            <div class="meta-item">
              <span class="label">👥 Servings:</span>
              <span class="value">{formatServings(recipe.servings)}</span>
            </div>
          {/if}
        </div>

        {#if recipe.tags && recipe.tags.length > 0}
          <div class="tags">
            {#each recipe.tags as tag}
              <span class="tag">{tag.name}</span>
            {/each}
          </div>
        {/if}

        <section class="ingredients">
          <h2>Ingredients</h2>
          <ul>
            {#each scaledIngredients as ingredient, i}
              <li class="ingredient-item">
                <span class="ingredient-text">{ingredient}</span>
                <button
                  class="btn-substitute"
                  onclick={() => openSubstitutionModal(recipe.ingredients[i])}
                  title="Find substitutes"
                >
                  <span class="sub-icon">↔</span>
                </button>
              </li>
            {/each}
          </ul>
        </section>

        <section class="instructions">
          <h2>Instructions</h2>
          <ol>
            {#each recipe.instructions as instruction}
              <li>{instruction}</li>
            {/each}
          </ol>
        </section>

        {#if recipe.sourceUrl}
          <div class="source">
            <strong>Source:</strong>
            <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
              {recipe.sourceUrl}
            </a>
          </div>
        {/if}

        <!-- Components (for compound recipes) -->
        {#if components.length > 0}
          <section class="components-section">
            <h2>Components</h2>
            <p class="components-description">
              This is a compound recipe made up of the following sub-recipes. Click to expand each component.
            </p>
            <div class="components-list">
              {#each components as component}
                <RecipeComponentView {component} />
              {/each}
            </div>
          </section>
        {/if}

        <!-- Nutrition Information -->
        {#if aggregatedNutrition && Object.keys(aggregatedNutrition).length > 0}
          <!-- Aggregated nutrition for compound recipes -->
          <section class="nutrition-section">
            <h2>Total Nutrition (per serving)</h2>
            <p class="nutrition-note">Aggregated from all components</p>
            <div class="nutrition-grid">
              {#if aggregatedNutrition.calories !== undefined}
                <div class="nutrition-item aggregated">
                  <span class="nutrition-value">{Math.round(aggregatedNutrition.calories)}</span>
                  <span class="nutrition-label">Calories</span>
                </div>
              {/if}
              {#if aggregatedNutrition.protein !== undefined}
                <div class="nutrition-item aggregated">
                  <span class="nutrition-value">{aggregatedNutrition.protein}g</span>
                  <span class="nutrition-label">Protein</span>
                </div>
              {/if}
              {#if aggregatedNutrition.carbohydrates !== undefined}
                <div class="nutrition-item aggregated">
                  <span class="nutrition-value">{aggregatedNutrition.carbohydrates}g</span>
                  <span class="nutrition-label">Carbs</span>
                </div>
              {/if}
              {#if aggregatedNutrition.fat !== undefined}
                <div class="nutrition-item aggregated">
                  <span class="nutrition-value">{aggregatedNutrition.fat}g</span>
                  <span class="nutrition-label">Fat</span>
                </div>
              {/if}
              {#if aggregatedNutrition.saturatedFat !== undefined}
                <div class="nutrition-item aggregated">
                  <span class="nutrition-value">{aggregatedNutrition.saturatedFat}g</span>
                  <span class="nutrition-label">Sat. Fat</span>
                </div>
              {/if}
              {#if aggregatedNutrition.fiber !== undefined}
                <div class="nutrition-item aggregated">
                  <span class="nutrition-value">{aggregatedNutrition.fiber}g</span>
                  <span class="nutrition-label">Fiber</span>
                </div>
              {/if}
              {#if aggregatedNutrition.sugar !== undefined}
                <div class="nutrition-item aggregated">
                  <span class="nutrition-value">{aggregatedNutrition.sugar}g</span>
                  <span class="nutrition-label">Sugar</span>
                </div>
              {/if}
              {#if aggregatedNutrition.sodium !== undefined}
                <div class="nutrition-item aggregated">
                  <span class="nutrition-value">{aggregatedNutrition.sodium}mg</span>
                  <span class="nutrition-label">Sodium</span>
                </div>
              {/if}
              {#if aggregatedNutrition.cholesterol !== undefined}
                <div class="nutrition-item aggregated">
                  <span class="nutrition-value">{aggregatedNutrition.cholesterol}mg</span>
                  <span class="nutrition-label">Cholesterol</span>
                </div>
              {/if}
            </div>
          </section>
        {:else if recipe.nutrition && Object.keys(recipe.nutrition).length > 0}
          <!-- Regular nutrition for non-compound recipes -->
          <section class="nutrition-section">
            <h2>Nutrition (per serving)</h2>
            <div class="nutrition-grid">
              {#if recipe.nutrition.calories !== undefined}
                <div class="nutrition-item">
                  <span class="nutrition-value">{recipe.nutrition.calories}</span>
                  <span class="nutrition-label">Calories</span>
                </div>
              {/if}
              {#if recipe.nutrition.protein !== undefined}
                <div class="nutrition-item">
                  <span class="nutrition-value">{recipe.nutrition.protein}g</span>
                  <span class="nutrition-label">Protein</span>
                </div>
              {/if}
              {#if recipe.nutrition.carbohydrates !== undefined}
                <div class="nutrition-item">
                  <span class="nutrition-value">{recipe.nutrition.carbohydrates}g</span>
                  <span class="nutrition-label">Carbs</span>
                </div>
              {/if}
              {#if recipe.nutrition.fat !== undefined}
                <div class="nutrition-item">
                  <span class="nutrition-value">{recipe.nutrition.fat}g</span>
                  <span class="nutrition-label">Fat</span>
                </div>
              {/if}
              {#if recipe.nutrition.saturatedFat !== undefined}
                <div class="nutrition-item">
                  <span class="nutrition-value">{recipe.nutrition.saturatedFat}g</span>
                  <span class="nutrition-label">Sat. Fat</span>
                </div>
              {/if}
              {#if recipe.nutrition.fiber !== undefined}
                <div class="nutrition-item">
                  <span class="nutrition-value">{recipe.nutrition.fiber}g</span>
                  <span class="nutrition-label">Fiber</span>
                </div>
              {/if}
              {#if recipe.nutrition.sugar !== undefined}
                <div class="nutrition-item">
                  <span class="nutrition-value">{recipe.nutrition.sugar}g</span>
                  <span class="nutrition-label">Sugar</span>
                </div>
              {/if}
              {#if recipe.nutrition.sodium !== undefined}
                <div class="nutrition-item">
                  <span class="nutrition-value">{recipe.nutrition.sodium}mg</span>
                  <span class="nutrition-label">Sodium</span>
                </div>
              {/if}
              {#if recipe.nutrition.cholesterol !== undefined}
                <div class="nutrition-item">
                  <span class="nutrition-value">{recipe.nutrition.cholesterol}mg</span>
                  <span class="nutrition-label">Cholesterol</span>
                </div>
              {/if}
            </div>
          </section>
        {:else}
          <!-- No nutrition data - show AI calculate option -->
          <section class="nutrition-section no-nutrition">
            <h2>Nutrition</h2>
            <p class="no-nutrition-text">No nutrition information available.</p>
            <button
              class="btn-ai-calculate"
              onclick={handleCalculateNutrition}
              disabled={calculatingNutrition}
            >
              {#if calculatingNutrition}
                <span class="spinner"></span>
                Calculating...
              {:else}
                <span class="ai-icon">AI</span>
                Calculate with AI
              {/if}
            </button>
            {#if nutritionError}
              <p class="nutrition-error">{nutritionError}</p>
            {/if}
          </section>
        {/if}

        <!-- Recipe Scaling -->
        {#if recipe.servings}
          <div class="scaling-section">
            <h3>Scale Recipe</h3>
            <div class="scaling-controls">
              <label for="servings">Servings:</label>
              <input
                id="servings"
                type="number"
                bind:value={scaledServings}
                min="1"
                max="99"
              />
              {#if scaledServings !== recipe.servings}
                <span class="scale-factor">
                  ({(scaledServings / recipe.servings).toFixed(1)}x)
                </span>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Rating and Notes -->
        <div class="rating-section">
          <div class="rating-header">
            <h3>My Rating & Notes</h3>
            <button onclick={() => showRatingForm = !showRatingForm} class="btn-toggle">
              {showRatingForm ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {#if showRatingForm}
            <div class="rating-form">
              <div class="star-rating">
                {#each [1, 2, 3, 4, 5] as star}
                  <button
                    class="star-btn"
                    class:active={rating >= star}
                    onclick={() => rating = star}
                  >
                    {rating >= star ? '★' : '☆'}
                  </button>
                {/each}
              </div>
              <textarea
                bind:value={notes}
                placeholder="Add your cooking notes..."
                rows="4"
              ></textarea>
              <button onclick={handleSaveRating} class="btn-save">Save</button>
            </div>
          {:else}
            <div class="rating-display">
              {#if recipe.rating}
                <div class="stars">
                  {'★'.repeat(recipe.rating)}{'☆'.repeat(5 - recipe.rating)}
                </div>
              {/if}
              {#if recipe.notes}
                <p class="notes">{recipe.notes}</p>
              {/if}
              {#if !recipe.rating && !recipe.notes}
                <p class="no-rating">No rating or notes yet</p>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Cooking Stats -->
        {#if recipe.timesCooked > 0}
          <div class="stats">
            <p>🍳 Cooked {recipe.timesCooked} time{recipe.timesCooked !== 1 ? 's' : ''}</p>
            {#if recipe.lastCookedAt}
              <p>Last cooked: {new Date(recipe.lastCookedAt).toLocaleDateString()}</p>
            {/if}
          </div>
        {/if}
      </article>

      <!-- Related Recipes -->
      {#if recipe}
        <RelatedRecipes recipeId={recipe.id} />
      {/if}
      {/if}
    {/if}
  </div>
</main>

<!-- AI Feature Modals -->
{#if showSubstitutionModal && selectedIngredient}
  <SubstitutionModal
    ingredient={selectedIngredient}
    recipeTitle={recipe?.title}
    onClose={() => showSubstitutionModal = false}
  />
{/if}

{#if showImprovementModal && recipe}
  <ImprovementModal
    recipe={{
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
    }}
    savedIdeas={recipe.improvementIdeas}
    onClose={() => showImprovementModal = false}
    onSave={() => loadRecipe()}
    onApply={handleApplyImprovements}
  />
{/if}

{#if showAdaptModal && recipe}
  <AdaptRecipeModal
    recipe={{
      id: recipe.id,
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
    }}
    onClose={() => showAdaptModal = false}
    onSaveAsCopy={handleSaveAdaptedAsCopy}
    onUpdateOriginal={handleUpdateWithAdapted}
  />
{/if}

{#if showTechniqueTooltip && selectedTechnique}
  <TechniqueTooltip
    explanation={selectedTechnique}
    onClose={() => { showTechniqueTooltip = false; selectedTechnique = null; }}
  />
{/if}

<style>
  main {
    flex: 1;
    padding: var(--spacing-12) 0;
  }

  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 0 var(--spacing-6);
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: #666;
  }

  .error {
    background: #fee;
    color: #c33;
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
  }

  .btn-back {
    color: #4a9eff;
    text-decoration: none;
    font-weight: 500;
  }

  .btn-back:hover {
    text-decoration: underline;
  }

  .recipe-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-4);
    flex-wrap: wrap;
    gap: var(--spacing-4);
  }

  .actions {
    display: flex;
    gap: var(--spacing-3);
  }

  .btn-edit,
  .btn-more {
    padding: var(--spacing-2-5) var(--spacing-4);
    border-radius: var(--radius-lg);
    font-weight: var(--font-medium);
    cursor: pointer;
    border: 2px solid transparent;
    font-size: var(--text-sm);
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    transition: var(--transition-normal);
  }

  .btn-edit {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  .btn-edit:hover {
    background: var(--color-primary-dark);
    border-color: var(--color-primary-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .btn-more {
    background: var(--color-surface);
    color: var(--color-text);
    border-color: var(--color-border);
  }

  .btn-more:hover,
  .btn-more.active {
    background: var(--color-bg-subtle);
    border-color: var(--color-text-light);
  }

  .btn-chat {
    padding: var(--spacing-2-5) var(--spacing-4);
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    border: 2px solid transparent;
    border-radius: var(--radius-lg);
    font-weight: var(--font-medium);
    cursor: pointer;
    font-size: var(--text-sm);
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    transition: var(--transition-normal);
  }

  .btn-chat:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .btn-chat.active {
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    box-shadow: var(--shadow-md);
  }

  /* More menu dropdown */
  .more-menu-container {
    position: relative;
  }

  .more-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: var(--spacing-2);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    min-width: 220px;
    z-index: 100;
    overflow: hidden;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    width: 100%;
    padding: var(--spacing-3) var(--spacing-4);
    background: none;
    border: none;
    font-size: var(--text-sm);
    color: var(--color-text);
    cursor: pointer;
    text-align: left;
    transition: var(--transition-fast);
  }

  .menu-item:hover {
    background: var(--color-bg-subtle);
  }

  .menu-item.danger {
    color: var(--color-error);
  }

  .menu-item.danger:hover {
    background: #fef2f2;
  }

  .menu-icon {
    width: 20px;
    text-align: center;
    flex-shrink: 0;
  }

  .menu-icon.ai {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    padding: 2px 4px;
    border-radius: var(--radius-sm);
  }

  .menu-divider {
    height: 1px;
    background: var(--color-border);
    margin: var(--spacing-2) 0;
  }

  .chat-panel {
    margin-bottom: var(--spacing-6);
    animation: slideDown 0.2s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .recipe-detail {
    background: var(--color-surface);
    padding: var(--spacing-8);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--color-border-light);
  }

  .recipe-image {
    width: 100%;
    max-height: 400px;
    object-fit: cover;
    border-radius: var(--radius-xl);
    margin-bottom: var(--spacing-6);
  }

  h1 {
    margin: 0 0 var(--spacing-4);
    font-size: var(--text-4xl);
    color: var(--color-text);
    font-weight: var(--font-extrabold);
    letter-spacing: -0.025em;
  }

  .description {
    font-size: var(--text-lg);
    line-height: var(--leading-relaxed);
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-6);
  }

  .meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-4);
    padding: var(--spacing-6);
    background: var(--color-bg-subtle);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-6);
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }

  .meta-item .label {
    font-size: var(--text-sm);
    color: var(--color-text-light);
    font-weight: var(--font-medium);
  }

  .meta-item .value {
    font-weight: var(--font-semibold);
    color: var(--color-text);
    font-size: var(--text-base);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-8);
  }

  .tag {
    background: var(--color-bg-subtle);
    color: var(--color-text);
    padding: var(--spacing-1) var(--spacing-2-5);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    border: 1px solid var(--color-border);
  }

  section {
    margin-bottom: var(--spacing-8);
  }

  h2 {
    font-size: var(--text-2xl);
    margin: 0 0 var(--spacing-4);
    color: var(--color-text);
    padding-bottom: var(--spacing-2);
    border-bottom: 1px solid var(--color-border);
    font-weight: var(--font-semibold);
  }

  .ingredients ul,
  .instructions ol {
    margin: 0;
    padding-left: var(--spacing-6);
  }

  .ingredients li,
  .instructions li {
    margin-bottom: var(--spacing-3);
    line-height: var(--leading-relaxed);
    font-size: var(--text-base);
    color: var(--color-text-secondary);
  }

  .ingredient-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
  }

  .ingredient-text {
    flex: 1;
  }

  .btn-substitute {
    opacity: 0;
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 0.125rem 0.375rem;
    cursor: pointer;
    transition: var(--transition-fast);
    color: var(--color-text-light);
    font-size: var(--text-xs);
  }

  .ingredient-item:hover .btn-substitute {
    opacity: 1;
  }

  .btn-substitute:hover {
    background: var(--color-bg-subtle);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .sub-icon {
    font-size: 0.75rem;
  }

  .instructions li {
    padding-left: var(--spacing-2);
  }

  .source {
    padding-top: 1.5rem;
    border-top: 1px solid #e0e0e0;
    color: #666;
  }

  .source a {
    color: #4a9eff;
    word-break: break-all;
  }

  .cooking-mode {
    background: var(--color-surface);
    padding: var(--spacing-8);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
  }

  .cooking-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-6);
  }

  .cooking-header h2 {
    margin: 0;
    color: var(--color-primary);
  }

  .btn-mark-cooked {
    padding: var(--spacing-2-5) var(--spacing-4);
    background: var(--color-success);
    color: white;
    border: 2px solid var(--color-success);
    border-radius: var(--radius-lg);
    font-weight: var(--font-medium);
    cursor: pointer;
    font-size: var(--text-sm);
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    transition: var(--transition-normal);
  }

  .btn-mark-cooked:hover {
    background: #059669;
    border-color: #059669;
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .cooking-step {
    background: var(--color-bg-subtle);
    padding: var(--spacing-8);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-6);
    display: flex;
    gap: var(--spacing-6);
    align-items: flex-start;
  }

  .step-number {
    font-size: 3rem;
    font-weight: 800;
    color: var(--color-primary);
    line-height: 1;
  }

  .step-text {
    font-size: 1.5rem;
    line-height: 1.6;
    margin: 0;
    flex: 1;
  }

  .cooking-navigation {
    display: flex;
    gap: var(--spacing-4);
    margin-bottom: var(--spacing-6);
  }

  .btn-nav {
    flex: 1;
    padding: var(--spacing-4);
    background: var(--color-primary);
    color: white;
    border: 2px solid var(--color-primary);
    border-radius: var(--radius-lg);
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2);
    transition: var(--transition-normal);
  }

  .btn-nav:hover:not(:disabled) {
    background: var(--color-primary-dark);
    border-color: var(--color-primary-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .btn-nav:disabled {
    background: var(--color-border);
    border-color: var(--color-border);
    color: var(--color-text-light);
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .cooking-ingredients {
    background: white;
    padding: var(--spacing-6);
    border-radius: var(--radius-md);
    border: 2px solid var(--color-border);
  }

  .cooking-ingredients h3 {
    margin-top: 0;
    font-size: 1.125rem;
  }

  .cooking-ingredients ul {
    margin: 0;
    padding-left: var(--spacing-6);
  }

  .btn-cooking {
    padding: var(--spacing-2-5) var(--spacing-4);
    background: var(--color-accent);
    color: white;
    border: 2px solid var(--color-accent);
    border-radius: var(--radius-lg);
    font-weight: var(--font-medium);
    cursor: pointer;
    font-size: var(--text-sm);
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    transition: var(--transition-normal);
  }

  .btn-cooking:hover {
    background: #20a39e;
    border-color: #20a39e;
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .scaling-section {
    background: var(--color-bg-subtle);
    padding: var(--spacing-6);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-6);
    border: 1px solid var(--color-border-light);
  }

  .scaling-section h3 {
    margin-top: 0;
    margin-bottom: var(--spacing-3);
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }

  .scaling-controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
  }

  .scaling-controls input {
    width: 80px;
    padding: var(--spacing-2);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    text-align: center;
    font-weight: var(--font-medium);
  }

  .scale-factor {
    color: var(--color-primary);
    font-weight: var(--font-semibold);
    font-size: var(--text-sm);
  }

  .rating-section {
    background: var(--color-surface);
    padding: var(--spacing-6);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
    margin-top: var(--spacing-6);
    box-shadow: var(--shadow-xs);
  }

  .rating-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-4);
  }

  .rating-header h3 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }

  .btn-toggle {
    padding: var(--spacing-1) var(--spacing-4);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.875rem;
  }

  .star-rating {
    display: flex;
    gap: var(--spacing-1);
    margin-bottom: var(--spacing-4);
  }

  .star-btn {
    font-size: var(--text-2xl);
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-border);
    transition: var(--transition-fast);
    padding: var(--spacing-1);
  }

  .star-btn.active {
    color: var(--color-secondary);
  }

  .rating-form textarea {
    width: 100%;
    padding: var(--spacing-3);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-family: inherit;
    margin-bottom: var(--spacing-4);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    resize: vertical;
  }

  .btn-save {
    padding: var(--spacing-2) var(--spacing-6);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
  }

  .rating-display .stars {
    color: var(--color-secondary);
    font-size: var(--text-xl);
    margin-bottom: var(--spacing-3);
  }

  .notes {
    color: var(--color-text-secondary);
    font-style: italic;
    margin: 0;
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    padding: var(--spacing-3);
    background: var(--color-bg-subtle);
    border-radius: var(--radius-md);
    border-left: 3px solid var(--color-primary);
  }

  .no-rating {
    color: var(--color-text-light);
    font-style: italic;
    margin: 0;
    font-size: var(--text-sm);
  }

  .stats {
    background: var(--color-bg-subtle);
    padding: var(--spacing-4);
    border-radius: var(--radius-lg);
    margin-top: var(--spacing-6);
    color: var(--color-text-light);
    border: 1px solid var(--color-border-light);
  }

  .stats p {
    margin: var(--spacing-1) 0;
    font-size: var(--text-sm);
  }

  /* Nutrition section styles */
  .nutrition-section {
    margin-bottom: var(--spacing-8);
  }

  .nutrition-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: var(--spacing-3);
    padding: var(--spacing-4);
    background: var(--color-bg-subtle);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border-light);
  }

  .nutrition-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-3);
    background: var(--color-surface);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .nutrition-value {
    font-size: var(--text-xl);
    font-weight: var(--font-bold);
    color: var(--color-primary);
    line-height: 1.2;
  }

  .nutrition-label {
    font-size: var(--text-xs);
    color: var(--color-text-light);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: var(--spacing-1);
  }

  .nutrition-note {
    font-size: var(--text-sm);
    color: var(--color-text-light);
    margin-bottom: var(--spacing-3);
    font-style: italic;
  }

  .nutrition-item.aggregated {
    background: rgba(255, 107, 53, 0.05);
    border: 1px solid rgba(255, 107, 53, 0.2);
  }

  .no-nutrition {
    text-align: center;
    padding: var(--spacing-6);
    background: var(--color-bg-subtle);
    border-radius: var(--radius-lg);
  }

  .no-nutrition-text {
    color: var(--color-text-light);
    margin-bottom: var(--spacing-4);
  }

  .btn-ai-calculate {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-3) var(--spacing-5);
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    font-weight: var(--font-semibold);
    font-size: var(--text-base);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-ai-calculate:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }

  .btn-ai-calculate:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  .ai-icon {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    font-weight: var(--font-bold);
  }

  .spinner {
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

  .nutrition-error {
    color: var(--color-error);
    font-size: var(--text-sm);
    margin-top: var(--spacing-3);
  }

  /* Components section styles */
  .components-section {
    margin-bottom: var(--spacing-8);
  }

  .components-description {
    font-size: var(--text-sm);
    color: var(--color-text-light);
    margin-bottom: var(--spacing-4);
  }

  .components-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  /* Icon styling for buttons */
  .icon {
    font-style: normal;
    line-height: 1;
  }

  /* Timer styles */
  .timer-section {
    background: var(--color-surface);
    border: 2px solid var(--color-primary);
    border-radius: var(--radius-lg);
    padding: var(--spacing-6);
    margin-bottom: var(--spacing-6);
    text-align: center;
  }

  .timer-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-4);
  }

  .timer-display.timer-complete {
    background: linear-gradient(135deg, #10b981, #059669);
    border-radius: var(--radius-lg);
    padding: var(--spacing-6);
    margin: calc(-1 * var(--spacing-6));
  }

  .timer-time {
    font-size: 4rem;
    font-weight: 800;
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
    color: var(--color-primary);
    line-height: 1;
    letter-spacing: 0.05em;
  }

  .timer-complete .timer-time {
    color: white;
  }

  .timer-controls {
    display: flex;
    gap: var(--spacing-3);
    flex-wrap: wrap;
    justify-content: center;
  }

  .btn-timer {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-3) var(--spacing-5);
    background: var(--color-bg-subtle);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-weight: var(--font-semibold);
    font-size: var(--text-base);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-timer:hover:not(:disabled) {
    background: var(--color-surface);
    border-color: var(--color-primary);
    transform: translateY(-1px);
  }

  .btn-timer:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-timer-primary {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  .btn-timer-primary:hover:not(:disabled) {
    background: var(--color-primary-dark);
    border-color: var(--color-primary-dark);
  }

  .btn-timer-danger {
    background: #fef2f2;
    color: var(--color-error);
    border-color: #fecaca;
  }

  .btn-timer-danger:hover:not(:disabled) {
    background: var(--color-error);
    color: white;
    border-color: var(--color-error);
  }

  .timer-complete .btn-timer {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
    color: white;
  }

  .timer-complete .btn-timer:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.3);
    border-color: white;
  }

  .timer-icon {
    font-size: 1.25rem;
    line-height: 1;
  }

  .timer-complete-message {
    font-size: var(--text-xl);
    font-weight: var(--font-bold);
    color: white;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .timer-start {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-3);
  }

  .timer-buttons {
    display: flex;
    gap: var(--spacing-3);
    flex-wrap: wrap;
    justify-content: center;
  }

  .timer-hint {
    font-size: var(--text-sm);
    color: var(--color-text-light);
    margin: 0;
  }

  .btn-start-timer {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-4) var(--spacing-8);
    background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
    color: white;
    border: none;
    border-radius: var(--radius-xl);
    font-weight: var(--font-bold);
    font-size: var(--text-xl);
    cursor: pointer;
    transition: var(--transition-normal);
    box-shadow: var(--shadow-md);
  }

  .btn-start-timer:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }

  .btn-start-timer:active {
    transform: translateY(0);
  }

  .btn-siri-timer {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-4) var(--spacing-6);
    background: linear-gradient(135deg, #1a1a1a, #333);
    color: white;
    border: none;
    border-radius: var(--radius-xl);
    font-weight: var(--font-bold);
    font-size: var(--text-lg);
    cursor: pointer;
    transition: var(--transition-normal);
    box-shadow: var(--shadow-md);
  }

  .btn-siri-timer:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
    background: linear-gradient(135deg, #333, #444);
  }

  .btn-siri-timer:active {
    transform: translateY(0);
  }

  .btn-notify {
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-notify:hover {
    background: var(--color-surface);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .notify-hint {
    font-size: var(--text-sm);
    color: var(--color-text-light);
    margin: 0;
  }

  @media (max-width: 640px) {
    main {
      padding: var(--spacing-4) 0;
    }

    .container {
      padding: 0 var(--spacing-4);
    }

    .recipe-header {
      margin-bottom: var(--spacing-4);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-2);
    }

    .actions button,
    .actions :global(.ai-btn) {
      padding: var(--spacing-3);
      font-size: var(--text-sm);
      min-height: 48px;
      justify-content: center;
      flex: 1 1 auto;
      min-width: 60px;
    }

    /* Hide text labels on mobile, show only icons */
    .actions button span:not(.icon),
    .actions :global(.ai-btn .label) {
      display: none !important;
    }

    .recipe-detail {
      padding: var(--spacing-4);
      border-radius: var(--radius-lg);
    }

    .recipe-image {
      border-radius: var(--radius-lg);
      max-height: 250px;
      margin-bottom: var(--spacing-4);
    }

    h1 {
      font-size: var(--text-2xl);
      margin-bottom: var(--spacing-3);
    }

    .description {
      font-size: var(--text-base);
      margin-bottom: var(--spacing-4);
    }

    .meta {
      grid-template-columns: repeat(2, 1fr);
      gap: var(--spacing-3);
      padding: var(--spacing-4);
      margin-bottom: var(--spacing-4);
    }

    .meta-item .label {
      font-size: var(--text-xs);
    }

    .meta-item .value {
      font-size: var(--text-sm);
    }

    .tags {
      margin-bottom: var(--spacing-4);
    }

    section {
      margin-bottom: var(--spacing-5);
    }

    h2 {
      font-size: var(--text-xl);
      margin-bottom: var(--spacing-3);
    }

    .ingredients li,
    .instructions li {
      font-size: var(--text-sm);
      margin-bottom: var(--spacing-2);
    }

    .btn-substitute {
      opacity: 0.6;
    }

    .scaling-section,
    .rating-section {
      padding: var(--spacing-4);
      margin-top: var(--spacing-4);
    }

    .scaling-section h3,
    .rating-header h3 {
      font-size: var(--text-base);
    }

    /* Cooking mode mobile */
    .cooking-mode {
      padding: var(--spacing-4);
    }

    .cooking-header {
      flex-direction: column;
      gap: var(--spacing-3);
      margin-bottom: var(--spacing-4);
    }

    .cooking-header h2 {
      font-size: var(--text-lg);
    }

    .btn-mark-cooked {
      width: 100%;
      padding: var(--spacing-3);
      min-height: 48px;
      justify-content: center;
    }

    .cooking-step {
      flex-direction: column;
      padding: var(--spacing-4);
      gap: var(--spacing-3);
      margin-bottom: var(--spacing-4);
    }

    .step-number {
      font-size: 2rem;
    }

    .step-text {
      font-size: var(--text-lg);
    }

    .cooking-navigation {
      gap: var(--spacing-2);
      margin-bottom: var(--spacing-4);
    }

    .btn-nav {
      padding: var(--spacing-3);
      font-size: var(--text-base);
      min-height: 48px;
    }

    .cooking-ingredients {
      padding: var(--spacing-4);
    }

    .cooking-ingredients h3 {
      font-size: var(--text-base);
    }

    /* Timer mobile styles */
    .timer-section {
      padding: var(--spacing-4);
      margin-bottom: var(--spacing-4);
    }

    .timer-time {
      font-size: 3rem;
    }

    .timer-controls {
      gap: var(--spacing-2);
    }

    .btn-timer {
      padding: var(--spacing-2) var(--spacing-3);
      font-size: var(--text-sm);
      min-height: 44px;
    }

    .btn-start-timer {
      padding: var(--spacing-3) var(--spacing-6);
      font-size: var(--text-lg);
      flex: 1;
      justify-content: center;
    }

    .btn-siri-timer {
      padding: var(--spacing-3) var(--spacing-4);
      font-size: var(--text-base);
    }

    .timer-buttons {
      width: 100%;
    }
  }
</style>
