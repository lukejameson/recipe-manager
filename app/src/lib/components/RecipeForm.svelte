<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { apiClient } from '$lib/api/client';
  import AddComponentModal from './AddComponentModal.svelte';
  import ImageSearchModal from './ImageSearchModal.svelte';
  import AIButton from './ai/AIButton.svelte';
  import TagSuggestionsPanel from './ai/TagSuggestionsPanel.svelte';
  import ExpandableSection from './ExpandableSection.svelte';
  import DynamicListInput from './DynamicListInput.svelte';
  import PhotoGallery from './PhotoGallery.svelte';
  import PhotoPicker from './PhotoPicker.svelte';
  import type { RecipeItem } from '$lib/server/db/schema';
  import { Sparkles, Search, X, Plus } from 'lucide-svelte';

  type TimeUnit = 'minutes' | 'hours';

  let {
    recipe = null,
    onSubmit,
    onCancel,
  }: {
    recipe?: any;
    onSubmit: (data: any) => Promise<void>;
    onCancel: () => void;
  } = $props();

  // Helper to convert old format to new format
  function toItemList(items: string[] | { items: RecipeItem[] } | undefined): RecipeItem[] {
    if (!items) return [{ id: crypto.randomUUID(), text: '', order: 0 }];
    if (Array.isArray(items)) {
      return items.filter(s => s.trim()).map((text, i) => ({
        id: crypto.randomUUID(),
        text,
        order: i
      }));
    }
    return items.items.length > 0 ? items.items : [{ id: crypto.randomUUID(), text: '', order: 0 }];
  }

  // Core fields (always visible)
  let title = $state(recipe?.title || '');
  let ingredients = $state<RecipeItem[]>(toItemList(recipe?.ingredients));
  let instructions = $state<RecipeItem[]>(toItemList(recipe?.instructions));

  // Additional fields (in expandable section)
  let description = $state(recipe?.description || '');
  let prepTime = $state(recipe?.prepTime || '');
  let cookTime = $state(recipe?.cookTime || '');
  let totalTime = $state(recipe?.totalTime || '');
  let servings = $state(recipe?.servings || '');

  // Time unit preferences (minutes or hours)
  let prepTimeUnit = $state<TimeUnit>('minutes');
  let cookTimeUnit = $state<TimeUnit>('minutes');
let totalTimeUnit = $state<TimeUnit>('minutes');
  let totalTimeManuallyEdited = $state(false);
  let imageUrl = $state(recipe?.imageUrl || '');
  let sourceUrl = $state(recipe?.sourceUrl || '');
  let photos = $state<Array<{
    id: string;
    urls: { thumbnail?: string | null; medium?: string | null; original: string };
    width?: number;
    height?: number;
    isMain?: boolean;
  }>>([]);
  let photoPickerOpen = $state(false);
  let changingCoverPhoto = $state(false);
  let loadingPhotos = $state(false);
  let tags = $state(recipe?.tags?.map((t: any) => t.name).join(', ') || '');

  // UI state
  let loading = $state(false);
  let error = $state('');
  let detailsExpanded = $state(false);

  // Check if we should auto-expand details (if editing with additional data)
  $effect(() => {
    if (recipe?.id) {
      const hasAdditionalData = description || prepTime || cookTime || totalTime || servings || imageUrl || sourceUrl || tags;
      const hasNutrition = recipe?.nutrition;
      const hasComponents = components.length > 0;
      if (hasAdditionalData || hasNutrition || hasComponents) {
        detailsExpanded = true;
      }
    }
  });

  // Components for compound recipes
  let showComponents = $state(false);
  let showComponentModal = $state(false);

  // Image search modal
  let showImageSearch = $state(false);
  let components = $state<Array<{ childRecipeId: string; servingsNeeded: number; childRecipe: any }>>([]);

  // Load existing components when editing
onMount(async () => {
    if (recipe?.id) {
      try {
        const existingComponents = await apiClient.getComponents(recipe.id);
        if (existingComponents.length > 0) {
          components = existingComponents.map((c: any) => ({
            childRecipeId: c.childRecipeId,
            servingsNeeded: c.servingsNeeded,
            childRecipe: c.childRecipe,
          }));
          showComponents = true;
        }
      } catch (err) {
      }
      try {
        const recipePhotos = await apiClient.getRecipePhotos(recipe.id);
        if (recipePhotos.length > 0) {
          photos = recipePhotos;
        }
      } catch (err) {
        console.error('Failed to load recipe photos:', err);
      }
    }
  });

  async function handleAddPhotos(selectedPhotos: any[]) {
    if (changingCoverPhoto) {
      changingCoverPhoto = false;
      if (selectedPhotos.length > 0) {
        const first = selectedPhotos[0];
        imageUrl = first.urls?.medium || first.urls?.original || first.pexelsUrl || '';
      }
      if (!recipe?.id) return;
    }
    if (!recipe?.id) return;
    for (const photo of selectedPhotos) {
      try {
        await apiClient.addPhotoToRecipe(recipe.id, photo.id);
        const isFirst = photos.length === 0;
        photos = [...photos, { ...photo, isMain: isFirst }];
        if (!imageUrl && (photo.urls?.medium || photo.urls?.original)) {
          imageUrl = photo.urls.medium || photo.urls.original;
        }
      } catch (err) {
        console.error('Failed to add photo to recipe:', err);
      }
    }
  }

  function handleChangeCoverPhoto() {
    changingCoverPhoto = true;
    photoPickerOpen = true;
  }

  async function handleSetMainPhoto(photoId: string) {
    if (!recipe?.id) return;
    try {
      await apiClient.setMainPhoto(recipe.id, photoId);
      photos = photos.map(p => ({ ...p, isMain: p.id === photoId }));
    } catch (err) {
      console.error('Failed to set main photo:', err);
    }
  }

  async function handleRemovePhoto(photoId: string) {
    if (!recipe?.id) return;
    try {
      await apiClient.removePhotoFromRecipe(recipe.id, photoId);
      photos = photos.filter(p => p.id !== photoId);
    } catch (err) {
      console.error('Failed to remove photo:', err);
    }
  }

  function handleAddComponent(childRecipe: any, servingsNeeded: number) {
    components = [...components, { childRecipeId: childRecipe.id, servingsNeeded, childRecipe }];
    showComponentModal = false;
  }

  function handleRemoveComponent(index: number) {
    components = components.filter((_, i) => i !== index);
  }

  function handleUpdateServings(index: number, value: string) {
    const newServings = parseFloat(value);
    if (!isNaN(newServings) && newServings > 0) {
      components = components.map((c, i) =>
        i === index ? { ...c, servingsNeeded: newServings } : c
      );
    }
  }

  // Get IDs to exclude from the add modal (current recipe + already added)
  const excludeRecipeIds = $derived([
    ...(recipe?.id ? [recipe.id] : []),
    ...components.map((c) => c.childRecipeId),
  ]);

  // Nutrition fields (per serving)
  let showNutrition = $state(!!recipe?.nutrition);
  let calories = $state(recipe?.nutrition?.calories || '');
  let protein = $state(recipe?.nutrition?.protein || '');
  let carbohydrates = $state(recipe?.nutrition?.carbohydrates || '');
  let fat = $state(recipe?.nutrition?.fat || '');
  let saturatedFat = $state(recipe?.nutrition?.saturatedFat || '');
  let fiber = $state(recipe?.nutrition?.fiber || '');
  let sugar = $state(recipe?.nutrition?.sugar || '');
  let sodium = $state(recipe?.nutrition?.sodium || '');
  let cholesterol = $state(recipe?.nutrition?.cholesterol || '');

  // AI nutrition calculation
  let calculatingNutrition = $state(false);
  let nutritionError = $state('');

  // AI tag suggestions
  let loadingTagSuggestions = $state(false);
  let tagSuggestions = $state<Array<{ tag: string; confidence: number; reason: string }>>([]);
  let tagSuggestionsError = $state('');

  async function handleCalculateNutrition() {
    const ingredientList = ingredients
      .map((i) => i.text.trim())
      .filter(Boolean);

    if (ingredientList.length === 0) {
      nutritionError = 'Please add ingredients first';
      return;
    }

    const servingsNum = parseInt(servings) || 1;

    calculatingNutrition = true;
    nutritionError = '';

    try {
      const nutrition = await apiClient.calculateNutrition({
        ingredients: ingredientList,
        servings: servingsNum,
        title: title.trim() || undefined,
      });

      // Fill in the nutrition fields (rounded to nearest whole number)
      calories = nutrition.calories != null ? Math.round(nutrition.calories).toString() : '';
      protein = nutrition.protein != null ? Math.round(nutrition.protein).toString() : '';
      carbohydrates = nutrition.carbohydrates != null ? Math.round(nutrition.carbohydrates).toString() : '';
      fat = nutrition.fat != null ? Math.round(nutrition.fat).toString() : '';
      saturatedFat = nutrition.saturatedFat != null ? Math.round(nutrition.saturatedFat).toString() : '';
      fiber = nutrition.fiber != null ? Math.round(nutrition.fiber).toString() : '';
      sugar = nutrition.sugar != null ? Math.round(nutrition.sugar).toString() : '';
      sodium = nutrition.sodium != null ? Math.round(nutrition.sodium).toString() : '';
      cholesterol = nutrition.cholesterol != null ? Math.round(nutrition.cholesterol).toString() : '';

      showNutrition = true;
    } catch (err: any) {
      nutritionError = err.message || 'Failed to calculate nutrition';
    } finally {
      calculatingNutrition = false;
    }
  }

  async function handleSuggestTags() {
    const ingredientList = ingredients
      .map((i) => i.text.trim())
      .filter(Boolean);

    const instructionList = instructions
      .map((i) => i.text.trim())
      .filter(Boolean);

    if (!title.trim() && ingredientList.length === 0) {
      tagSuggestionsError = 'Add a title or ingredients first';
      return;
    }

    loadingTagSuggestions = true;
    tagSuggestionsError = '';

    try {
      // Get existing tags from the system for consistency
      const existingTags = await apiClient.getTags();
      const existingTagNames = existingTags.map((t: any) => t.name);

      const result = await apiClient.suggestTags({
        recipe: {
          title: title.trim() || 'Untitled',
          description: description.trim() || undefined,
          ingredients: ingredientList,
          instructions: instructionList,
        },
        existingTags: existingTagNames,
      });

      tagSuggestions = (result.suggestedTags || []).map((tag: string) => ({
        tag,
        confidence: 0.8,
        reason: 'Suggested based on recipe content',
      }));
    } catch (err: any) {
      tagSuggestionsError = err.message || 'Failed to suggest tags';
    } finally {
      loadingTagSuggestions = false;
    }
  }

  function handleSelectSuggestedTag(tag: string) {
    const currentTags = tags
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean);

    if (!currentTags.some((t: string) => t.toLowerCase() === tag.toLowerCase())) {
      tags = [...currentTags, tag].join(', ');
    }
  }

  function dismissTagSuggestions() {
    tagSuggestions = [];
  }

  // Auto-calculate total time when prep or cook time changes (only if not manually edited)
  $effect(() => {
    if (totalTimeManuallyEdited) return;

    const prep = parseInt(prepTime) || 0;
    const cook = parseInt(cookTime) || 0;
    if (prep > 0 || cook > 0) {
      totalTime = (prep + cook).toString();
    }
  });

  // Sync form fields when recipe prop changes (for JSON-LD update feature)
  $effect(() => {
    // Access recipe to track it
    const r = recipe;
    if (!r) return;

    // Use untrack to avoid circular updates when we set state
    untrack(() => {
      title = r.title || '';
      description = r.description || '';
      prepTime = r.prepTime || '';
      cookTime = r.cookTime || '';
      totalTime = r.totalTime || '';
      servings = r.servings || '';
      imageUrl = r.imageUrl || '';
      sourceUrl = r.sourceUrl || '';
      ingredients = toItemList(r.ingredients);
      instructions = toItemList(r.instructions);
      tags = r.tags?.map((t: any) => typeof t === 'string' ? t : t.name).join(', ') || '';

      // Update nutrition fields
      if (r.nutrition) {
        showNutrition = true;
        calories = r.nutrition.calories ?? '';
        protein = r.nutrition.protein ?? '';
        carbohydrates = r.nutrition.carbohydrates ?? '';
        fat = r.nutrition.fat ?? '';
        saturatedFat = r.nutrition.saturatedFat ?? '';
        fiber = r.nutrition.fiber ?? '';
        sugar = r.nutrition.sugar ?? '';
        sodium = r.nutrition.sodium ?? '';
        cholesterol = r.nutrition.cholesterol ?? '';
      }
    });
  });

  async function handleSubmit() {
    error = '';

    // Validation
    if (!title.trim()) {
      error = 'Title is required';
      return;
    }

    const ingredientList = ingredients
      .filter((i) => i.text.trim())
      .map((i, idx) => ({ ...i, order: idx }));

    if (ingredientList.length === 0) {
      error = 'At least one ingredient is required';
      return;
    }

    const instructionList = instructions
      .filter((i) => i.text.trim())
      .map((i, idx) => ({ ...i, order: idx }));

    if (instructionList.length === 0) {
      error = 'At least one instruction is required';
      return;
    }

    const tagList = tags
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean);

    // Build nutrition object only if any nutrition values are provided
    let nutrition: Record<string, number> | undefined = undefined;
    if (showNutrition) {
      const nutritionData: Record<string, number> = {};
      if (calories) nutritionData.calories = parseFloat(calories);
      if (protein) nutritionData.protein = parseFloat(protein);
      if (carbohydrates) nutritionData.carbohydrates = parseFloat(carbohydrates);
      if (fat) nutritionData.fat = parseFloat(fat);
      if (saturatedFat) nutritionData.saturatedFat = parseFloat(saturatedFat);
      if (fiber) nutritionData.fiber = parseFloat(fiber);
      if (sugar) nutritionData.sugar = parseFloat(sugar);
      if (sodium) nutritionData.sodium = parseFloat(sodium);
      if (cholesterol) nutritionData.cholesterol = parseFloat(cholesterol);

      if (Object.keys(nutritionData).length > 0) {
        nutrition = nutritionData;
      }
    }

    const data: any = {
      title: title.trim(),
      description: description.trim() || undefined,
      prepTime: prepTime ? parseInt(prepTime) : undefined,
      cookTime: cookTime ? parseInt(cookTime) : undefined,
      totalTime: totalTime ? parseInt(totalTime) : undefined,
      servings: servings ? parseFloat(servings) : undefined,
      imageUrl: imageUrl.trim() || undefined,
      sourceUrl: sourceUrl.trim() || undefined,
      ingredients: { items: ingredientList },
      instructions: { items: instructionList },
      tags: tagList,
      nutrition,
      // Include components data for the parent to handle
      components: components.map((c) => ({
        childRecipeId: c.childRecipeId,
        servingsNeeded: typeof c.servingsNeeded === 'number' ? c.servingsNeeded : parseFloat(c.servingsNeeded) || 1,
      })),
    };

    // Include recipe ID if editing/updating
    if (recipe?.id) {
      data.id = recipe.id;
    }

    loading = true;
    try {
      await onSubmit(data);
    } catch (err: any) {
      error = err.message || 'Failed to save recipe';
      loading = false;
    }
  }
</script>

<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="recipe-form">
  {#if error}
    <div class="error">{error}</div>
  {/if}

  <!-- Core Recipe Section (Always Visible) -->
  <section class="core-section">
    <div class="form-group">
      <label for="title">Title *</label>
      <input
        id="title"
        type="text"
        bind:value={title}
        required
        maxlength="200"
        placeholder="Recipe name (e.g., Grandma's Apple Pie)"
      />
    </div>

    <div class="form-group">
      <DynamicListInput
        label="Ingredients"
        required={true}
        items={ingredients}
        placeholder="e.g., 2 cups flour"
        onChange={(newItems) => ingredients = newItems}
      />
    </div>

    <div class="form-group">
      <DynamicListInput
        label="Instructions"
        required={true}
        items={instructions}
        placeholder="e.g., Preheat oven to 350°F"
        onChange={(newItems) => instructions = newItems}
      />
    </div>
  </section>

  <!-- Quick Stats Row (Mobile) / Desktop Time Row -->
  <section class="quick-stats-section">
    <div class="form-row quick-stats">
      <div class="form-group time-field desktop-only">
        <div class="label-with-toggle">
          <label for="prepTime">Prep</label>
          <div class="unit-toggle">
            <button
              type="button"
              class="unit-btn"
              class:active={prepTimeUnit === 'minutes'}
              onclick={() => prepTimeUnit = 'minutes'}
            >min</button>
            <button
              type="button"
              class="unit-btn"
              class:active={prepTimeUnit === 'hours'}
              onclick={() => prepTimeUnit = 'hours'}
            >hr</button>
          </div>
        </div>
        <input
          id="prepTime"
          type="number"
          bind:value={prepTime}
          min="0"
          step={prepTimeUnit === 'hours' ? '0.1' : '1'}
          placeholder={prepTimeUnit === 'hours' ? '0.5' : '30'}
        />
      </div>

      <div class="form-group time-field desktop-only">
        <div class="label-with-toggle">
          <label for="cookTime">Cook</label>
          <div class="unit-toggle">
            <button
              type="button"
              class="unit-btn"
              class:active={cookTimeUnit === 'minutes'}
              onclick={() => cookTimeUnit = 'minutes'}
            >min</button>
            <button
              type="button"
              class="unit-btn"
              class:active={cookTimeUnit === 'hours'}
              onclick={() => cookTimeUnit = 'hours'}
            >hr</button>
          </div>
        </div>
        <input
          id="cookTime"
          type="number"
          bind:value={cookTime}
          min="0"
          step={cookTimeUnit === 'hours' ? '0.1' : '1'}
          placeholder={cookTimeUnit === 'hours' ? '0.5' : '30'}
        />
      </div>

      <div class="form-group">
        <div class="label-with-toggle">
          <label for="totalTime">Total Time</label>
          <div class="unit-toggle">
            <button
              type="button"
              class="unit-btn"
              class:active={totalTimeUnit === 'minutes'}
              onclick={() => { totalTimeUnit = 'minutes'; totalTimeManuallyEdited = true; }}
            >min</button>
            <button
              type="button"
              class="unit-btn"
              class:active={totalTimeUnit === 'hours'}
              onclick={() => { totalTimeUnit = 'hours'; totalTimeManuallyEdited = true; }}
            >hr</button>
          </div>
        </div>
        <input
          id="totalTime"
          type="number"
          bind:value={totalTime}
          oninput={() => totalTimeManuallyEdited = true}
          min="0"
          step={totalTimeUnit === 'hours' ? '0.1' : '1'}
          placeholder={totalTimeUnit === 'hours' ? '1.5' : '90'}
        />
      </div>

      <div class="form-group">
        <label for="servings">Servings</label>
        <input id="servings" type="number" bind:value={servings} min="0.1" step="0.1" />
      </div>
    </div>
  </section>

  <!-- Additional Details Expandable Section -->
  <ExpandableSection title="Add Details" bind:expanded={detailsExpanded}>
    <div class="details-content">
      <div class="form-group">
        <label for="description">Description</label>
        <textarea
          id="description"
          bind:value={description}
          rows="2"
          maxlength="1000"
          placeholder="A brief description of your recipe..."
        ></textarea>
      </div>

      <!-- Prep/Cook time for mobile -->
      <div class="form-row mobile-time-row">
        <div class="form-group">
          <div class="label-with-toggle">
            <label for="prepTimeMobile">Prep Time</label>
            <div class="unit-toggle">
              <button
                type="button"
                class="unit-btn"
                class:active={prepTimeUnit === 'minutes'}
                onclick={() => prepTimeUnit = 'minutes'}
              >min</button>
              <button
                type="button"
                class="unit-btn"
                class:active={prepTimeUnit === 'hours'}
                onclick={() => prepTimeUnit = 'hours'}
              >hr</button>
            </div>
          </div>
          <input
            id="prepTimeMobile"
            type="number"
            bind:value={prepTime}
            min="0"
            step={prepTimeUnit === 'hours' ? '0.1' : '1'}
            placeholder={prepTimeUnit === 'hours' ? '0.5' : '30'}
          />
        </div>

        <div class="form-group">
          <div class="label-with-toggle">
            <label for="cookTimeMobile">Cook Time</label>
            <div class="unit-toggle">
              <button
                type="button"
                class="unit-btn"
                class:active={cookTimeUnit === 'minutes'}
                onclick={() => cookTimeUnit = 'minutes'}
              >min</button>
              <button
                type="button"
                class="unit-btn"
                class:active={cookTimeUnit === 'hours'}
                onclick={() => cookTimeUnit = 'hours'}
              >hr</button>
            </div>
          </div>
          <input
            id="cookTimeMobile"
            type="number"
            bind:value={cookTime}
            min="0"
            step={cookTimeUnit === 'hours' ? '0.1' : '1'}
            placeholder={cookTimeUnit === 'hours' ? '0.5' : '30'}
          />
        </div>
      </div>

      <div class="form-group">
        <div class="label-with-action">
          <label for="tags">Tags</label>
          <AIButton
            onclick={handleSuggestTags}
            loading={loadingTagSuggestions}
            label="Suggest"
            loadingLabel="..."
            size="sm"
            variant="subtle"
          />
        </div>
        <input
          id="tags"
          type="text"
          bind:value={tags}
          placeholder="dessert, chocolate, cookies"
        />
        {#if tagSuggestionsError}
          <span class="field-error">{tagSuggestionsError}</span>
        {/if}
        {#if tagSuggestions.length > 0}
          <TagSuggestionsPanel
            suggestions={tagSuggestions}
            selectedTags={tags.split(',').map((t: string) => t.trim()).filter(Boolean)}
            onSelect={handleSelectSuggestedTag}
            onDismiss={dismissTagSuggestions}
          />
        {/if}
      </div>

      <div class="form-group">
        <label>Cover Photo</label>
        {#if imageUrl}
          <div class="cover-photo-preview">
            <img src={imageUrl} alt="Cover photo" class="cover-photo-img" />
            <div class="cover-photo-actions">
              <button type="button" class="btn-cover-change" onclick={handleChangeCoverPhoto}>Change</button>
              <button type="button" class="btn-cover-remove" onclick={() => imageUrl = ''}>Remove</button>
            </div>
          </div>
        {:else}
          <button type="button" class="btn-add-cover" onclick={handleChangeCoverPhoto}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            Add Cover Photo
          </button>
        {/if}
      </div>
      {#if recipe?.id}
      <div class="form-group">
        <label>Gallery Photos</label>
        <PhotoGallery
          photos={photos}
          recipeId={recipe?.id || ''}
          editable={true}
          onaddphotos={() => photoPickerOpen = true}
          onremovephoto={handleRemovePhoto}
          onselectmain={handleSetMainPhoto}
        />
      </div>
      {/if}

      <div class="form-group">
        <label for="sourceUrl">Source URL</label>
        <input id="sourceUrl" type="url" bind:value={sourceUrl} placeholder="Where did this recipe come from?" />
      </div>
    </div>
  </ExpandableSection>

  <!-- Nutrition Section -->
  <div class="nutrition-section">
    <button
      type="button"
      class="nutrition-toggle"
      onclick={() => showNutrition = !showNutrition}
    >
      <span class="toggle-icon">{showNutrition ? '▼' : '▶'}</span>
      <span>Nutrition Information (per serving)</span>
    </button>

    {#if showNutrition}
      <div class="nutrition-fields">
        <div class="ai-calculate-section">
          <button
            type="button"
            class="btn-secondary btn-sm"
            onclick={handleCalculateNutrition}
            disabled={calculatingNutrition}
          >
            {#if calculatingNutrition}
              <span class="spinner"></span>
              Calculating...
            {:else}
              <Sparkles size={16} />
              Calculate with AI
            {/if}
          </button>
          {#if nutritionError}
            <span class="nutrition-error">{nutritionError}</span>
          {/if}
        </div>

        <div class="nutrition-row">
          <div class="form-group">
            <label for="calories">Calories (kcal)</label>
            <input id="calories" type="number" bind:value={calories} min="0" step="1" />
          </div>
          <div class="form-group">
            <label for="protein">Protein (g)</label>
            <input id="protein" type="number" bind:value={protein} min="0" step="0.1" />
          </div>
          <div class="form-group">
            <label for="carbohydrates">Carbs (g)</label>
            <input id="carbohydrates" type="number" bind:value={carbohydrates} min="0" step="0.1" />
          </div>
        </div>

        <div class="nutrition-row">
          <div class="form-group">
            <label for="fat">Fat (g)</label>
            <input id="fat" type="number" bind:value={fat} min="0" step="0.1" />
          </div>
          <div class="form-group">
            <label for="saturatedFat">Sat Fat (g)</label>
            <input id="saturatedFat" type="number" bind:value={saturatedFat} min="0" step="0.1" />
          </div>
          <div class="form-group">
            <label for="fiber">Fiber (g)</label>
            <input id="fiber" type="number" bind:value={fiber} min="0" step="0.1" />
          </div>
        </div>

        <div class="nutrition-row">
          <div class="form-group">
            <label for="sugar">Sugar (g)</label>
            <input id="sugar" type="number" bind:value={sugar} min="0" step="0.1" />
          </div>
          <div class="form-group">
            <label for="sodium">Sodium (mg)</label>
            <input id="sodium" type="number" bind:value={sodium} min="0" step="0.1" />
          </div>
          <div class="form-group">
            <label for="cholesterol">Cholesterol (mg)</label>
            <input id="cholesterol" type="number" bind:value={cholesterol} min="0" step="0.1" />
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Components Section (for compound recipes) -->
  <div class="components-section">
    <button
      type="button"
      class="components-toggle"
      onclick={() => showComponents = !showComponents}
    >
      <span class="toggle-icon">{showComponents ? '▼' : '▶'}</span>
      <span>Components (Compound Recipe)</span>
      {#if components.length > 0}
        <span class="component-count">{components.length}</span>
      {/if}
    </button>

    {#if showComponents}
      <div class="components-content">
        <p class="components-hint">
          Add other recipes as components to create a compound recipe. Each component will be displayed as a collapsible section.
        </p>

        {#if components.length > 0}
          <div class="component-list">
            {#each components as comp, index}
              <div class="component-item">
                <div class="component-info">
                  <span class="component-title">{comp.childRecipe.title}</span>
                  {#if comp.childRecipe.servings}
                    <span class="component-recipe-servings">
                      (recipe makes {comp.childRecipe.servings} servings)
                    </span>
                  {/if}
                </div>
                <div class="component-controls">
                  <label class="servings-label">
                    Servings:
                    <input
                      type="number"
                      value={comp.servingsNeeded}
                      onchange={(e) => handleUpdateServings(index, e.currentTarget.value)}
                      min="0.1"
                      step="0.5"
                      class="servings-input"
                    />
                  </label>
                  <button
                    type="button"
                    class="btn-icon btn-sm"
                    onclick={() => handleRemoveComponent(index)}
                    title="Remove component"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <button
          type="button"
          class="btn-secondary"
          onclick={() => showComponentModal = true}
        >
          <Plus size={18} />
          Add Component Recipe
        </button>
      </div>
    {/if}
  </div>

  <div class="form-actions">
    <button type="submit" class="btn-primary btn-md" disabled={loading}>
      {loading ? 'Saving...' : recipe?.id ? 'Update Recipe' : 'Create Recipe'}
    </button>
    <button type="button" class="btn-secondary btn-md" onclick={onCancel}>Cancel</button>
  </div>
</form>

{#if showComponentModal}
  <AddComponentModal
    onAdd={handleAddComponent}
    onClose={() => showComponentModal = false}
    {excludeRecipeIds}
  />
{/if}

{#if showImageSearch}
  <ImageSearchModal
    recipeName={title}
    tags={tags.split(',').map((t: string) => t.trim()).filter(Boolean)}
    onSelect={(url) => { imageUrl = url; showImageSearch = false; }}
    onClose={() => showImageSearch = false}
  />
{/if}
{#if photoPickerOpen}
  <PhotoPicker
    recipeId={recipe?.id || ''}
    maxSelectable={5}
    initialTab={changingCoverPhoto ? 'existing' : 'upload'}
    onclose={() => { photoPickerOpen = false; changingCoverPhoto = false; }}
    onselect={handleAddPhotos}
  />
{/if}
<style>
  .recipe-form {
    max-width: 800px;
    margin: 0 auto;
  }

  .error {
    background: #fef2f2;
    color: var(--color-error);
    padding: var(--spacing-3);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-6);
    border: 1px solid #fecaca;
    font-weight: var(--font-medium);
    font-size: var(--text-sm);
  }

  /* Core section styling */
  .core-section {
    margin-bottom: var(--spacing-5);
  }

  .form-group {
    margin-bottom: var(--spacing-5);
  }
  .form-group:last-child {
    margin-bottom: 0;
  }
  .cover-photo-preview {
    position: relative;
    width: 100%;
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--color-bg-subtle);
  }
  .cover-photo-img {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    display: block;
  }
  .cover-photo-actions {
    position: absolute;
    bottom: var(--spacing-3);
    right: var(--spacing-3);
    display: flex;
    gap: var(--spacing-2);
  }
  .btn-cover-change,
  .btn-cover-remove {
    padding: var(--spacing-1) var(--spacing-3);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    border: none;
  }
  .btn-cover-change {
    background: rgba(0, 0, 0, 0.6);
    color: white;
  }
  .btn-cover-change:hover {
    background: rgba(0, 0, 0, 0.8);
  }
  .btn-cover-remove {
    background: rgba(220, 38, 38, 0.8);
    color: white;
  }
  .btn-cover-remove:hover {
    background: rgba(220, 38, 38, 1);
  }
  .btn-add-cover {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    width: 100%;
    padding: var(--spacing-5);
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg-subtle);
    color: var(--color-text-light);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    justify-content: center;
    transition: var(--transition-normal);
  }
  .btn-add-cover:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: rgba(224, 122, 82, 0.05);
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  label {
    display: block;
    font-weight: var(--font-semibold);
    margin-bottom: var(--spacing-2);
    color: var(--color-text);
    font-size: var(--text-sm);
  }

  .hint {
    font-weight: var(--font-normal);
    color: var(--color-text-light);
    font-size: var(--text-xs);
  }

  input,
  textarea {
    width: 100%;
    padding: var(--spacing-3);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: var(--text-base);
    font-family: inherit;
    background: var(--color-surface);
    color: var(--color-text);
    transition: var(--transition-normal);
    min-height: 48px;
  }

  textarea {
    resize: vertical;
  }

  input:focus,
  textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(224, 122, 82, 0.1);
  }

  input::placeholder,
  textarea::placeholder {
    color: var(--color-text-light);
    opacity: 0.6;
  }

  /* Quick stats row */
  .quick-stats-section {
    margin-bottom: var(--spacing-5);
  }

  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--spacing-4);
  }

  .quick-stats {
    grid-template-columns: repeat(4, 1fr);
  }

  .mobile-time-row {
    display: none;
  }

  /* Details section */
  .details-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .label-with-action {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-2);
  }

  .label-with-action label {
    margin-bottom: 0;
  }

  .label-with-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-2);
  }

  .label-with-toggle label {
    margin-bottom: 0;
  }

  .unit-toggle {
    display: flex;
    gap: 0;
    background: var(--color-bg-subtle);
    border-radius: var(--radius-md);
    padding: 2px;
  }

  .unit-btn {
    padding: var(--spacing-1) var(--spacing-2);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    border: none;
    background: transparent;
    color: var(--color-text-light);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: var(--transition-fast);
    min-width: 32px;
  }

  .unit-btn.active {
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: var(--shadow-xs);
  }

  .unit-btn:hover:not(.active) {
    color: var(--color-text);
  }

  .unit-btn:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .field-error {
    display: block;
    color: var(--color-error);
    font-size: var(--text-sm);
    margin-top: var(--spacing-1);
  }

  /* Form actions */
  .form-actions {
    display: flex;
    gap: var(--spacing-4);
    margin-top: var(--spacing-8);
    padding-bottom: var(--spacing-4);
  }

  .btn-primary,
  .btn-secondary {
    padding: var(--spacing-3) var(--spacing-5);
    border-radius: var(--radius-lg);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    cursor: pointer;
    border: 2px solid transparent;
    transition: var(--transition-normal);
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2);
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
    flex: 1;
    border-color: var(--color-primary);
    box-shadow: var(--shadow-sm);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-dark);
    border-color: var(--color-primary-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-lg);
  }

  .btn-primary:disabled {
    background: var(--color-border);
    border-color: var(--color-border);
    color: var(--color-text-light);
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .btn-secondary {
    background: var(--color-surface);
    color: var(--color-text-secondary);
    border-color: var(--color-border);
    box-shadow: var(--shadow-xs);
  }

  .btn-secondary:hover {
    background: var(--color-bg-subtle);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .btn-sm {
    padding: var(--spacing-2) var(--spacing-3);
    font-size: var(--text-sm);
    min-height: 36px;
  }

  /* Nutrition section styles */
  .nutrition-section {
    margin-bottom: var(--spacing-5);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .nutrition-toggle {
    width: 100%;
    padding: var(--spacing-4);
    background: var(--color-bg-subtle);
    border: none;
    text-align: left;
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--color-text);
    cursor: pointer;
    transition: var(--transition-normal);
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
  }

  .nutrition-toggle:hover {
    background: var(--color-border-light);
  }

  .toggle-icon {
    display: inline-block;
    transition: transform 0.2s ease;
  }

  .nutrition-fields {
    padding: var(--spacing-4);
    background: var(--color-surface);
  }

  .ai-calculate-section {
    display: flex;
    align-items: center;
    gap: var(--spacing-4);
    margin-bottom: var(--spacing-4);
    padding-bottom: var(--spacing-4);
    border-bottom: 1px solid var(--color-border-light);
  }

  .spinner {
    width: 16px;
    height: 16px;
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
  }

  .nutrition-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-4);
    margin-bottom: var(--spacing-4);
  }

  .nutrition-row:last-child {
    margin-bottom: 0;
  }

  .nutrition-row .form-group {
    margin-bottom: 0;
  }

  .nutrition-row input {
    text-align: right;
  }

  /* Components section styles */
  .components-section {
    margin-bottom: var(--spacing-5);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .components-toggle {
    width: 100%;
    padding: var(--spacing-4);
    background: var(--color-bg-subtle);
    border: none;
    text-align: left;
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--color-text);
    cursor: pointer;
    transition: var(--transition-normal);
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
  }

  .components-toggle:hover {
    background: var(--color-border-light);
  }

  .component-count {
    background: var(--color-primary);
    color: white;
    padding: var(--spacing-1) var(--spacing-2);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    min-width: 20px;
    text-align: center;
    margin-left: auto;
  }

  .components-content {
    padding: var(--spacing-4);
    background: var(--color-surface);
  }

  .components-hint {
    font-size: var(--text-sm);
    color: var(--color-text-light);
    margin: 0 0 var(--spacing-4) 0;
    line-height: 1.5;
  }

  .component-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
    margin-bottom: var(--spacing-4);
  }

  .component-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-3);
    background: var(--color-bg-subtle);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border-light);
  }

  .component-info {
    flex: 1;
    min-width: 0;
  }

  .component-title {
    font-weight: var(--font-medium);
    color: var(--color-text);
    display: block;
  }

  .component-recipe-servings {
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .component-controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
  }

  .servings-label {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-secondary);
  }

  .servings-input {
    width: 70px;
    padding: var(--spacing-2);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    text-align: center;
  }

  /* Desktop only */
  .desktop-only {
    display: block;
  }

  /* Button icon */
  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border-radius: var(--radius-md);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-icon:hover {
    background: var(--color-bg-subtle);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .btn-icon.btn-sm {
    width: 32px;
    height: 32px;
  }

  /* Mobile optimizations */
  @media (max-width: 768px) {
    .recipe-form {
      padding: var(--spacing-2);
    }

    .form-group {
      margin-bottom: var(--spacing-4);
    }

    .form-row {
      grid-template-columns: repeat(2, 1fr);
      gap: var(--spacing-3);
    }

    .quick-stats {
      grid-template-columns: repeat(2, 1fr);
    }

    .desktop-only {
      display: none;
    }

    .mobile-time-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--spacing-3);
    }

    .nutrition-row {
      grid-template-columns: repeat(2, 1fr);
    }

    input,
    textarea {
      font-size: 16px; /* Prevent iOS zoom on focus */
    }
  }

  @media (max-width: 640px) {
    .form-actions {
      position: sticky;
      bottom: calc(64px + env(safe-area-inset-bottom));
      background: var(--color-bg);
      padding: var(--spacing-4) 0;
      margin-top: var(--spacing-4);
      border-top: 1px solid var(--color-border);
      z-index: 10;
    }

    .nutrition-row {
      grid-template-columns: 1fr;
    }

    .component-item {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-3);
    }

    .component-controls {
      width: 100%;
      justify-content: space-between;
      align-items: center;
    }

    .servings-label {
      flex: 1;
      justify-content: flex-start;
    }

    .servings-input {
      width: 80px;
      min-height: 44px;
      padding: var(--spacing-3);
      font-size: var(--text-base);
    }

    .btn-label {
      display: none;
    }
  }

  @media (max-width: 480px) {
    .form-row,
    .quick-stats {
      grid-template-columns: 1fr;
    }

    .mobile-time-row {
      grid-template-columns: 1fr;
    }

    .form-row .form-group,
    .quick-stats .form-group {
      margin-bottom: var(--spacing-3);
    }

    .form-row .form-group:last-child,
    .quick-stats .form-group:last-child {
      margin-bottom: 0;
    }

    .nutrition-fields,
    .components-content {
      padding: var(--spacing-3);
    }

    .nutrition-toggle,
    .components-toggle {
      padding: var(--spacing-3);
      font-size: var(--text-sm);
    }
  }

  /* Touch target improvements */
  input[type="number"],
  .servings-input {
    min-height: 48px;
  }

  /* Ensure safe area padding for sticky actions */
  @supports (padding-bottom: env(safe-area-inset-bottom)) {
    @media (max-width: 640px) {
      .form-actions {
        padding-bottom: calc(var(--spacing-4) + env(safe-area-inset-bottom));
      }
    }
  }
</style>
