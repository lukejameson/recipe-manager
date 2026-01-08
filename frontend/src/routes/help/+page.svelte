<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import { authStore } from '$lib/stores/auth.svelte';

  let expandedSection = $state<string | null>(null);

  function toggleSection(section: string) {
    expandedSection = expandedSection === section ? null : section;
  }

  const sections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      content: [
        {
          subtitle: 'Your Recipe Library',
          text: 'The home page shows all your recipes. Click on any recipe card to view its full details, or use the search bar to find specific recipes by name or ingredients.'
        },
        {
          subtitle: 'Adding Your First Recipe',
          text: 'Click the "+" button or "New Recipe" to create a recipe manually. Fill in the title, ingredients, instructions, and optionally add prep/cook times, servings, and tags.'
        },
        {
          subtitle: 'Importing Recipes',
          text: 'Already have recipes from websites? Use "Import Recipe" to paste a URL and automatically extract recipe details. You can also import from photos of handwritten or printed recipes.'
        }
      ]
    },
    {
      id: 'organizing',
      title: 'Organizing Recipes',
      content: [
        {
          subtitle: 'Tags',
          text: 'Add tags to categorize your recipes (e.g., "breakfast", "quick", "vegetarian"). You can filter recipes by tags from the Tags page or use the search to find tagged recipes.'
        },
        {
          subtitle: 'Collections',
          text: 'Create collections to group related recipes together. Perfect for meal planning, holiday menus, or organizing by cuisine. A recipe can belong to multiple collections.'
        },
        {
          subtitle: 'Search',
          text: 'Use the search bar to find recipes by name, ingredients, or tags. The search looks across all your recipe content to help you find what you\'re looking for.'
        }
      ]
    },
    {
      id: 'cooking',
      title: 'Cooking Features',
      content: [
        {
          subtitle: 'Recipe View',
          text: 'When viewing a recipe, you\'ll see all the details including ingredients with checkboxes to track progress, step-by-step instructions, and nutrition information if available.'
        },
        {
          subtitle: 'Shopping List',
          text: 'Add recipe ingredients to your shopping list with one click. The shopping list automatically categorizes items and you can check them off as you shop.'
        },
        {
          subtitle: 'Scaling Recipes',
          text: 'Need to cook for more or fewer people? Adjust the servings on any recipe and the ingredient quantities will automatically scale.'
        }
      ]
    },
    {
      id: 'smart-features',
      title: 'Smart Features',
      content: [
        {
          subtitle: 'Recipe Assistant',
          text: 'Have questions about a recipe? Use the chat feature to ask about substitutions, cooking techniques, or get helpful tips tailored to your recipe.'
        },
        {
          subtitle: 'Create Recipes',
          text: 'Describe what you want to cook and get a complete recipe created for you. Great for using up ingredients in your fridge or trying new cuisines.'
        },
        {
          subtitle: 'Photo Import',
          text: 'Take a photo of a recipe from a cookbook, magazine, or handwritten note and it will be converted into a digital recipe automatically.'
        },
        {
          subtitle: 'Nutrition Info',
          text: 'Get estimated nutrition information for your recipes including calories, protein, carbs, and fat per serving.'
        },
        {
          subtitle: 'Tag Suggestions',
          text: 'Get automatic tag suggestions based on your recipe\'s ingredients, cooking method, and cuisine type.'
        },
        {
          subtitle: 'What Can I Make?',
          text: 'Enter the ingredients you have on hand and find which of your saved recipes you can make with what\'s available.'
        }
      ]
    },
    {
      id: 'settings',
      title: 'Settings & Preferences',
      content: [
        {
          subtitle: 'My Preferences',
          text: 'Add your dietary restrictions, allergies, or cooking preferences to get personalized suggestions. For example: "I\'m vegetarian" or "Allergic to nuts".'
        },
        {
          subtitle: 'Profile & Security',
          text: 'Manage your account, change your password, and view your active sessions. Your recipes are private and only visible to you.'
        }
      ]
    }
  ];
</script>

<Header />

<main>
  <div class="container">
    <h1>Help & Guide</h1>
    <p class="intro">
      Welcome to Recipe Manager! This guide will help you get the most out of the app.
    </p>

    <div class="sections">
      {#each sections as section (section.id)}
        <div class="section" class:expanded={expandedSection === section.id}>
          <button class="section-header" onclick={() => toggleSection(section.id)}>
            <h2>{section.title}</h2>
            <span class="expand-icon">{expandedSection === section.id ? '-' : '+'}</span>
          </button>

          {#if expandedSection === section.id}
            <div class="section-content">
              {#each section.content as item}
                <div class="item">
                  <h3>{item.subtitle}</h3>
                  <p>{item.text}</p>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    {#if authStore.isAdmin}
      <section class="admin-help">
        <h2>Admin Features</h2>
        <p class="section-description">
          As an admin, you have access to additional features for managing users and the system.
        </p>

        <div class="admin-items">
          <div class="item">
            <h3>User Management</h3>
            <p>
              View all users, manage their feature access, promote users to admin, or remove accounts.
              Go to <a href="/admin/users">Admin > Users</a>.
            </p>
          </div>

          <div class="item">
            <h3>Invite Codes</h3>
            <p>
              Generate single-use invite codes to allow new users to register. Codes can have optional
              expiration dates. Go to <a href="/admin/invites">Admin > Invite Codes</a>.
            </p>
          </div>

          <div class="item">
            <h3>Smart Features Setup</h3>
            <p>
              Configure the settings needed to enable smart features like recipe creation and nutrition info.
              Go to <a href="/settings">Settings</a>.
            </p>
          </div>

          <div class="item">
            <h3>Feature Access</h3>
            <p>
              Control which features each user can access. Useful for managing what family members or guests can do.
            </p>
          </div>
        </div>
      </section>
    {/if}

    <section class="tips">
      <h2>Quick Tips</h2>
      <ul>
        <li>Use keyboard shortcut <kbd>/</kbd> to quickly focus the search bar</li>
        <li>Double-click an ingredient while cooking to mark it as used</li>
        <li>Add recipes to collections for easy meal planning</li>
        <li>Add your dietary preferences in Settings for personalized suggestions</li>
      </ul>
    </section>
  </div>
</main>

<style>
  main {
    flex: 1;
    padding: 2rem 0;
  }

  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  h1 {
    font-size: 2rem;
    margin: 0 0 0.5rem;
    color: var(--color-text);
  }

  .intro {
    color: var(--color-text-light);
    margin: 0 0 2rem;
    font-size: 1.125rem;
    line-height: 1.6;
  }

  .sections {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .section {
    background: white;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .section-header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.2s;
  }

  .section-header:hover {
    background: var(--color-bg-subtle);
  }

  .section-header h2 {
    font-size: 1.125rem;
    margin: 0;
    color: var(--color-text);
  }

  .expand-icon {
    font-size: 1.5rem;
    color: var(--color-text-light);
    font-weight: 300;
    line-height: 1;
  }

  .section-content {
    padding: 0 1.5rem 1.5rem;
    border-top: 1px solid var(--color-border);
  }

  .item {
    padding: 1rem 0;
    border-bottom: 1px solid var(--color-border-light);
  }

  .item:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .item h3 {
    font-size: 1rem;
    margin: 0 0 0.5rem;
    color: var(--color-text);
  }

  .item p {
    font-size: 0.9375rem;
    color: var(--color-text-secondary);
    margin: 0;
    line-height: 1.6;
  }

  .admin-help {
    background: var(--color-primary-light);
    padding: 2rem;
    border-radius: var(--radius-lg);
    margin-bottom: 2rem;
  }

  .admin-help h2 {
    font-size: 1.25rem;
    margin: 0 0 0.5rem;
    color: var(--color-text);
  }

  .section-description {
    color: var(--color-text-secondary);
    margin: 0 0 1.5rem;
  }

  .admin-items {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .admin-items .item {
    background: white;
    padding: 1rem;
    border-radius: var(--radius-md);
    border-bottom: none;
  }

  .admin-items a {
    color: var(--color-primary);
    font-weight: 500;
  }

  .tips {
    background: white;
    padding: 2rem;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }

  .tips h2 {
    font-size: 1.25rem;
    margin: 0 0 1rem;
    color: var(--color-text);
  }

  .tips ul {
    margin: 0;
    padding-left: 1.5rem;
  }

  .tips li {
    margin-bottom: 0.75rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .tips li:last-child {
    margin-bottom: 0;
  }

  kbd {
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 0.125rem 0.375rem;
    font-family: monospace;
    font-size: 0.875rem;
  }
</style>
