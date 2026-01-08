import { pgTable, text, integer, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

// Users table for authentication
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Nutrition type for storing per-serving nutritional information
export type NutritionInfo = {
  calories?: number;       // kcal
  protein?: number;        // grams
  carbohydrates?: number;  // grams
  fat?: number;            // grams
  saturatedFat?: number;   // grams
  fiber?: number;          // grams
  sugar?: number;          // grams
  sodium?: number;         // milligrams
  cholesterol?: number;    // milligrams
};

// Improvement suggestion from AI
export type ImprovementSuggestion = {
  category: string;
  suggestion: string;
  explanation: string;
  priority: 'high' | 'medium' | 'low';
};

// Recipes table
export const recipes = pgTable('recipes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  description: text('description'),
  prepTime: integer('prep_time'), // in minutes
  cookTime: integer('cook_time'), // in minutes
  totalTime: integer('total_time'), // in minutes
  servings: integer('servings'),
  ingredients: jsonb('ingredients').notNull().$type<string[]>(),
  instructions: jsonb('instructions').notNull().$type<string[]>(),
  imageUrl: text('image_url'),
  sourceUrl: text('source_url'),
  isFavorite: boolean('is_favorite').notNull().default(false),
  rating: integer('rating'), // 1-5 stars
  notes: text('notes'), // Personal cooking notes
  difficulty: text('difficulty'), // easy, medium, hard
  timesCooked: integer('times_cooked').notNull().default(0),
  lastCookedAt: timestamp('last_cooked_at', { withTimezone: true }),
  // Nutrition information (per serving)
  nutrition: jsonb('nutrition').$type<NutritionInfo>(),
  // AI-generated improvement ideas
  improvementIdeas: jsonb('improvement_ideas').$type<ImprovementSuggestion[]>(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Tags table
export const tags = pgTable('tags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Recipe-Tag junction table (many-to-many relationship)
export const recipeTags = pgTable('recipe_tags', {
  recipeId: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  tagId: text('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
});

// Collections table
export const collections = pgTable('collections', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Collection-Recipe junction table
export const collectionRecipes = pgTable('collection_recipes', {
  collectionId: text('collection_id')
    .notNull()
    .references(() => collections.id, { onDelete: 'cascade' }),
  recipeId: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  addedAt: timestamp('added_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Recipe components - for compound/composite recipes
// Links parent recipes to child recipes with serving multipliers
export const recipeComponents = pgTable('recipe_components', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  parentRecipeId: text('parent_recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  childRecipeId: text('child_recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  servingsNeeded: integer('servings_needed').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Shopping list items
export const shoppingListItems = pgTable('shopping_list_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ingredient: text('ingredient').notNull(),
  quantity: text('quantity'),
  category: text('category'), // produce, dairy, meat, pantry, etc.
  isChecked: boolean('is_checked').notNull().default(false),
  recipeId: text('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// App settings (single-row table for configuration)
export const settings = pgTable('settings', {
  id: text('id').primaryKey().default('app-settings'),
  anthropicApiKey: text('anthropic_api_key'), // Encrypted
  anthropicModel: text('anthropic_model').default('claude-3-5-sonnet-20241022'),
  anthropicSecondaryModel: text('anthropic_secondary_model').default('claude-3-haiku-20240307'),
  pexelsApiKey: text('pexels_api_key'), // Encrypted - for image search
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// User memories for AI context
// Note: userId is not a FK because auth uses a fixed 'admin-user' ID that doesn't exist in users table
export const memories = pgTable('memories', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  content: text('content').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// AI Agents for specialized chat personas (Chef, Mixologist, custom)
export const agents = pgTable('agents', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  systemPrompt: text('system_prompt').notNull(),
  icon: text('icon').notNull().default('🤖'),
  modelId: text('model_id'), // Specific model ID to use, null = use default from settings
  isBuiltIn: boolean('is_built_in').notNull().default(false),
  userId: text('user_id'), // null for built-in agents
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Type exports for use in application
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = typeof recipes.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

export type RecipeTag = typeof recipeTags.$inferSelect;
export type InsertRecipeTag = typeof recipeTags.$inferInsert;

export type Collection = typeof collections.$inferSelect;
export type InsertCollection = typeof collections.$inferInsert;

export type CollectionRecipe = typeof collectionRecipes.$inferSelect;
export type InsertCollectionRecipe = typeof collectionRecipes.$inferInsert;

export type ShoppingListItem = typeof shoppingListItems.$inferSelect;
export type InsertShoppingListItem = typeof shoppingListItems.$inferInsert;

export type RecipeComponent = typeof recipeComponents.$inferSelect;
export type InsertRecipeComponent = typeof recipeComponents.$inferInsert;

export type Settings = typeof settings.$inferSelect;
export type InsertSettings = typeof settings.$inferInsert;

export type Memory = typeof memories.$inferSelect;
export type InsertMemory = typeof memories.$inferInsert;

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;
