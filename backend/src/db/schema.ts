import { pgTable, text, integer, timestamp, boolean, jsonb, unique } from 'drizzle-orm/pg-core';

// Feature flags type for per-user feature toggles
export type UserFeatureFlags = {
  aiChat: boolean;
  recipeGeneration: boolean;
  tagSuggestions: boolean;
  nutritionCalc: boolean;
  photoExtraction: boolean;
  urlImport: boolean;
  imageSearch: boolean;
  jsonldImport: boolean;
};

// Default feature flags (jsonldImport disabled by default as it's a power user feature)
export const DEFAULT_FEATURE_FLAGS: UserFeatureFlags = {
  aiChat: true,
  recipeGeneration: true,
  tagSuggestions: true,
  nutritionCalc: true,
  photoExtraction: true,
  urlImport: true,
  imageSearch: true,
  jsonldImport: false,
};

// Users table for authentication
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isAdmin: boolean('is_admin').notNull().default(false),
  email: text('email'),
  displayName: text('display_name'),
  featureFlags: jsonb('feature_flags').$type<UserFeatureFlags>(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  // Account lockout fields
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
});

// User sessions for session management
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(), // SHA-256 hash of the token for security
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// Audit logs for admin actions
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  targetType: text('target_type'), // 'user', 'invite_code', 'settings', etc.
  targetId: text('target_id'),
  details: jsonb('details').$type<Record<string, unknown>>(),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Invite codes for registration
export const inviteCodes = pgTable('invite_codes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text('code').notNull().unique(),
  createdBy: text('created_by').notNull().references(() => users.id),
  usedBy: text('used_by').references(() => users.id),
  usedAt: timestamp('used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
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
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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

// Tags table (user-scoped)
export const tags = pgTable('tags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  // Unique tag name per user
  uniqueNamePerUser: unique().on(table.userId, table.name),
}));

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
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  defaultFeatureFlags: jsonb('default_feature_flags').$type<UserFeatureFlags>(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// User memories for AI context
export const memories = pgTable('memories', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }), // null for built-in agents
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Chat sessions for storing AI chat history
export const chatSessions = pgTable('chat_sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  isFavorite: boolean('is_favorite').notNull().default(false),
  lastMessagePreview: text('last_message_preview'),
  messageCount: integer('message_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Referenced recipe type for chat messages
export type ReferencedRecipe = {
  id: string;
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
};

// Generated recipe type from AI
export type GeneratedRecipe = {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  tags?: string[];
};

// Chat messages for storing individual messages in chat sessions
export const chatMessages = pgTable('chat_messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text('session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  images: jsonb('images').$type<string[]>(), // Base64 data URIs
  referencedRecipes: jsonb('referenced_recipes').$type<ReferencedRecipe[]>(),
  generatedRecipe: jsonb('generated_recipe').$type<GeneratedRecipe>(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Type exports for use in application
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type InviteCode = typeof inviteCodes.$inferSelect;
export type InsertInviteCode = typeof inviteCodes.$inferInsert;

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

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = typeof chatSessions.$inferInsert;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
