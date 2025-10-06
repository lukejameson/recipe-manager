import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users table for authentication
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Recipes table
export const recipes = sqliteTable('recipes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  description: text('description'),
  prepTime: integer('prep_time'), // in minutes
  cookTime: integer('cook_time'), // in minutes
  totalTime: integer('total_time'), // in minutes
  servings: integer('servings'),
  ingredients: text('ingredients', { mode: 'json' }).notNull().$type<string[]>(),
  instructions: text('instructions', { mode: 'json' }).notNull().$type<string[]>(),
  imageUrl: text('image_url'),
  sourceUrl: text('source_url'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  rating: integer('rating'), // 1-5 stars
  notes: text('notes'), // Personal cooking notes
  difficulty: text('difficulty'), // easy, medium, hard
  timesCooked: integer('times_cooked').notNull().default(0),
  lastCookedAt: integer('last_cooked_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Tags table
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Recipe-Tag junction table (many-to-many relationship)
export const recipeTags = sqliteTable('recipe_tags', {
  recipeId: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  tagId: text('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
});

// Collections table
export const collections = sqliteTable('collections', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Collection-Recipe junction table
export const collectionRecipes = sqliteTable('collection_recipes', {
  collectionId: text('collection_id')
    .notNull()
    .references(() => collections.id, { onDelete: 'cascade' }),
  recipeId: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  addedAt: integer('added_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Shopping list items
export const shoppingListItems = sqliteTable('shopping_list_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ingredient: text('ingredient').notNull(),
  quantity: text('quantity'),
  category: text('category'), // produce, dairy, meat, pantry, etc.
  isChecked: integer('is_checked', { mode: 'boolean' }).notNull().default(false),
  recipeId: text('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
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
