<script lang="ts">
  type ComponentData = {
    id: string;
    childRecipeId: string;
    servingsNeeded: number;
    sortOrder: number;
    childRecipe: {
      id: string;
      title: string;
      servings?: number | null;
      ingredients: string[];
      instructions: string[];
      tags?: { id: string; name: string }[];
      components?: ComponentData[];
    };
  };

  let {
    component,
    depth = 0,
  }: {
    component: ComponentData;
    depth?: number;
  } = $props();

  let expanded = $state(false);

  const scale = $derived(
    component.childRecipe.servings
      ? component.servingsNeeded / component.childRecipe.servings
      : 1
  );

  function scaleIngredient(ingredient: string, scale: number): string {
    if (scale === 1) return ingredient;

    // Match numbers (including fractions and decimals) at the start
    const match = ingredient.match(/^([\d./]+)\s*/);
    if (match) {
      const numStr = match[1];
      let num: number;

      if (numStr.includes('/')) {
        const [num1, denom] = numStr.split('/');
        num = parseFloat(num1) / parseFloat(denom);
      } else {
        num = parseFloat(numStr);
      }

      const scaled = num * scale;
      const rounded = Math.round(scaled * 100) / 100;
      return ingredient.replace(match[0], `${rounded} `);
    }

    return ingredient;
  }
</script>

<div class="component-view" style="--depth: {depth}">
  <button
    class="component-header"
    onclick={() => expanded = !expanded}
  >
    <span class="expand-icon">{expanded ? '▼' : '▶'}</span>
    <span class="component-title">{component.childRecipe.title}</span>
    <span class="component-servings">
      {component.servingsNeeded} {component.servingsNeeded === 1 ? 'serving' : 'servings'}
      {#if scale !== 1}
        <span class="scale-indicator">({scale.toFixed(2)}x)</span>
      {/if}
    </span>
  </button>

  {#if expanded}
    <div class="component-content">
      <!-- Nested components first -->
      {#if component.childRecipe.components && component.childRecipe.components.length > 0}
        <div class="nested-components">
          <h5>Sub-components:</h5>
          {#each component.childRecipe.components as nestedComp}
            <svelte:self component={nestedComp} depth={depth + 1} />
          {/each}
        </div>
      {/if}

      <!-- Ingredients -->
      <div class="component-ingredients">
        <h5>Ingredients:</h5>
        <ul>
          {#each component.childRecipe.ingredients as ingredient}
            <li>{scaleIngredient(ingredient, scale)}</li>
          {/each}
        </ul>
      </div>

      <!-- Instructions -->
      <div class="component-instructions">
        <h5>Instructions:</h5>
        <ol>
          {#each component.childRecipe.instructions as instruction}
            <li>{instruction}</li>
          {/each}
        </ol>
      </div>

      <!-- Link to full recipe -->
      <a href="/recipe/{component.childRecipe.id}" class="view-recipe-link">
        View full recipe →
      </a>
    </div>
  {/if}
</div>

<style>
  .component-view {
    margin-left: calc(var(--depth) * var(--spacing-4));
    margin-bottom: var(--spacing-2);
  }

  .component-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    width: 100%;
    padding: var(--spacing-3);
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: var(--transition-fast);
    text-align: left;
  }

  .component-header:hover {
    background: var(--color-border-light);
    border-color: var(--color-border);
  }

  .expand-icon {
    color: var(--color-text-light);
    font-size: var(--text-sm);
    width: 16px;
  }

  .component-title {
    flex: 1;
    font-weight: var(--font-medium);
    color: var(--color-text);
  }

  .component-servings {
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .scale-indicator {
    color: var(--color-primary);
    font-weight: var(--font-medium);
  }

  .component-content {
    margin-top: var(--spacing-2);
    margin-left: var(--spacing-6);
    padding: var(--spacing-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-lg);
  }

  .nested-components {
    margin-bottom: var(--spacing-4);
    padding-bottom: var(--spacing-4);
    border-bottom: 1px solid var(--color-border-light);
  }

  .nested-components h5 {
    margin: 0 0 var(--spacing-2) 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text-light);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .component-ingredients,
  .component-instructions {
    margin-bottom: var(--spacing-4);
  }

  .component-ingredients h5,
  .component-instructions h5 {
    margin: 0 0 var(--spacing-2) 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text-light);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .component-ingredients ul {
    margin: 0;
    padding-left: var(--spacing-5);
  }

  .component-ingredients li {
    margin-bottom: var(--spacing-1);
    font-size: var(--text-sm);
  }

  .component-instructions ol {
    margin: 0;
    padding-left: var(--spacing-5);
  }

  .component-instructions li {
    margin-bottom: var(--spacing-2);
    font-size: var(--text-sm);
    line-height: 1.5;
  }

  .view-recipe-link {
    display: inline-block;
    font-size: var(--text-sm);
    color: var(--color-primary);
    text-decoration: none;
    font-weight: var(--font-medium);
  }

  .view-recipe-link:hover {
    text-decoration: underline;
  }
</style>
