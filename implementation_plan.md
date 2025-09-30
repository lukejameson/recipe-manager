# Implementation Plan

## [Overview]
Build a modern, mobile-responsive recipe management PWA with single-user authentication, flexible tagging, JSONLD import support, and Docker deployment.

This application will provide a complete recipe CRUD system with schema.org/Recipe JSONLD import capabilities, flexible user-defined tagging for organization, and PWA installability. The architecture uses SvelteKit 5 (with Runes) for the frontend, TypeScript backend with tRPC and Drizzle ORM connecting to SQLite, and includes Docker deployment configuration with basic authentication for single-user access.

## [Types]
Define comprehensive TypeScript types for the entire application stack.

**Database Schema Types (Drizzle):**
```typescript
// Recipe table
{
  id: string (uuid, primary key)
  title: string (not null)
  description: text (nullable)
  prepTime: integer (minutes, nullable)
  cookTime: integer (minutes, nullable)
  totalTime: integer (minutes, nullable)
  servings: integer (nullable)
  ingredients: text (JSON array, not null)
  instructions: text (JSON array, not null)
  imageUrl: text (nullable)
  sourceUrl: text (nullable)
  createdAt: timestamp (default now)
  updatedAt: timestamp (default now)
}

// Tag table
{
  id: string (uuid, primary key)
  name: string (unique, not null)
  createdAt: timestamp (default now)
}

// RecipeTag junction table (many-to-many)
{
  recipeId: string (foreign key to Recipe)
  tagId: string (foreign key to Tag)
  primary key: (recipeId, tagId)
}

// User table (single user auth)
{
  id: string (uuid, primary key)
  username: string (unique, not null)
  passwordHash: string (not null)
  createdAt: timestamp (default now)
}
```

**tRPC Router Types:**
```typescript
// Input validation schemas using Zod
RecipeInput: {
  title: string (min 1, max 200)
  description?: string (max 1000)
  prepTime?: number (min 0)
  cookTime?: number (min 0)
  totalTime?: number (min 0)
  servings?: number (min 1)
  ingredients: string[] (min 1 item)
  instructions: string[] (min 1 item)
  imageUrl?: string (url format)
  sourceUrl?: string (url format)
  tags: string[] (tag names)
}

RecipeUpdate: Partial<RecipeInput> & { id: string }

JSONLDRecipeInput: {
  jsonld: string (valid JSON)
}

AuthInput: {
  username: string (min 3, max 50)
  password: string (min 8)
}

TagInput: {
  name: string (min 1, max 50)
}
```

**Frontend Component Props:**
```typescript
RecipeCard: {
  recipe: Recipe
  onEdit?: () => void
  onDelete?: () => void
}

RecipeForm: {
  recipe?: Recipe (for editing)
  onSubmit: (data: RecipeInput) => Promise<void>
  onCancel: () => void
}

RecipeDetail: {
  recipeId: string
}

TagFilter: {
  selectedTags: string[]
  onTagToggle: (tag: string) => void
}
```

## [Files]
Comprehensive file structure covering backend, frontend, configuration, and deployment.

**New Files to Create:**

Backend (`/backend`):
- `backend/package.json` - Backend dependencies (tRPC, Drizzle, better-sqlite3, bcryptjs, jose)
- `backend/tsconfig.json` - TypeScript configuration
- `backend/drizzle.config.ts` - Drizzle ORM configuration
- `backend/src/db/schema.ts` - Database schema definitions
- `backend/src/db/index.ts` - Database connection and client
- `backend/src/db/migrations/` - Directory for migrations
- `backend/src/trpc/context.ts` - tRPC context with auth
- `backend/src/trpc/router.ts` - Main tRPC router
- `backend/src/trpc/routers/recipe.ts` - Recipe CRUD operations
- `backend/src/trpc/routers/tag.ts` - Tag operations
- `backend/src/trpc/routers/auth.ts` - Authentication operations
- `backend/src/utils/jsonld-parser.ts` - Schema.org/Recipe JSONLD parser
- `backend/src/utils/auth.ts` - Password hashing and JWT utilities
- `backend/src/server.ts` - Express server with tRPC adapter
- `backend/.env.example` - Environment variables template

Frontend (`/frontend`):
- `frontend/package.json` - Frontend dependencies (SvelteKit 5, tRPC client, TanStack Query)
- `frontend/tsconfig.json` - TypeScript configuration
- `frontend/svelte.config.js` - SvelteKit configuration
- `frontend/vite.config.ts` - Vite configuration
- `frontend/src/app.html` - HTML template with PWA meta tags
- `frontend/src/routes/+layout.svelte` - Root layout with auth check
- `frontend/src/routes/+layout.ts` - Layout load function
- `frontend/src/routes/+page.svelte` - Recipe list/dashboard
- `frontend/src/routes/login/+page.svelte` - Login page
- `frontend/src/routes/recipe/[id]/+page.svelte` - Recipe detail view
- `frontend/src/routes/recipe/[id]/edit/+page.svelte` - Edit recipe
- `frontend/src/routes/recipe/new/+page.svelte` - Create recipe
- `frontend/src/routes/recipe/import/+page.svelte` - Import JSONLD
- `frontend/src/lib/trpc/client.ts` - tRPC client setup
- `frontend/src/lib/stores/auth.svelte.ts` - Auth state with Runes
- `frontend/src/lib/components/RecipeCard.svelte` - Recipe card component
- `frontend/src/lib/components/RecipeForm.svelte` - Recipe form component
- `frontend/src/lib/components/RecipeDetail.svelte` - Recipe detail component
- `frontend/src/lib/components/TagFilter.svelte` - Tag filtering component
- `frontend/src/lib/components/Header.svelte` - App header with navigation
- `frontend/src/lib/utils/format.ts` - Time/number formatting utilities
- `frontend/static/manifest.json` - PWA manifest
- `frontend/static/icons/` - PWA icons (192x192, 512x512)
- `frontend/.env.example` - Environment variables template

Root Configuration:
- `/docker-compose.yml` - Docker Compose for full stack
- `/backend/Dockerfile` - Backend container image
- `/frontend/Dockerfile` - Frontend container (with build)
- `/.dockerignore` - Docker ignore patterns
- `/.gitignore` - Git ignore patterns
- `/README.md` - Project documentation

## [Functions]
Detailed breakdown of key functions across the application.

**Backend Functions:**

`backend/src/db/schema.ts`:
- `recipes` - Drizzle table definition for recipes
- `tags` - Drizzle table definition for tags
- `recipeTags` - Junction table for many-to-many relationship
- `users` - User table for authentication

`backend/src/utils/jsonld-parser.ts`:
- `parseRecipeJsonLd(jsonld: string): RecipeInput` - Parses schema.org/Recipe JSONLD and converts to RecipeInput format. Handles nested ingredients, recipeInstructions (as HowToStep or text), times in ISO 8601 duration format.

`backend/src/utils/auth.ts`:
- `hashPassword(password: string): Promise<string>` - Bcrypt password hashing
- `verifyPassword(password: string, hash: string): Promise<boolean>` - Password verification
- `generateToken(userId: string): Promise<string>` - JWT token generation
- `verifyToken(token: string): Promise<{ userId: string }>` - JWT verification

`backend/src/trpc/context.ts`:
- `createContext()` - Creates tRPC context with auth checking from Authorization header

`backend/src/trpc/routers/recipe.ts`:
- `list(input?: { tags?: string[], search?: string })` - Lists recipes with optional filtering
- `get(id: string)` - Gets single recipe with tags
- `create(input: RecipeInput)` - Creates recipe and associates tags
- `update(input: RecipeUpdate)` - Updates recipe and tags
- `delete(id: string)` - Deletes recipe and tag associations
- `importJsonLd(input: JSONLDRecipeInput)` - Imports recipe from JSONLD

`backend/src/trpc/routers/tag.ts`:
- `list()` - Lists all tags with recipe counts
- `create(input: TagInput)` - Creates new tag
- `delete(id: string)` - Deletes tag if no recipes use it

`backend/src/trpc/routers/auth.ts`:
- `login(input: AuthInput)` - Authenticates and returns JWT
- `register(input: AuthInput)` - Registers first user (only if no users exist)
- `me()` - Returns current user from JWT

**Frontend Functions:**

`frontend/src/lib/trpc/client.ts`:
- `createTRPCClient()` - Initializes tRPC client with HTTP link and auth headers

`frontend/src/lib/stores/auth.svelte.ts`:
- `authStore` - Runes-based reactive store for auth state
- `login(token: string)` - Stores token in localStorage
- `logout()` - Clears token and redirects
- `getToken()` - Retrieves token from localStorage

`frontend/src/lib/utils/format.ts`:
- `formatTime(minutes: number): string` - Formats minutes to "Xh Ym"
- `formatServings(servings: number): string` - Formats serving count

## [Classes]
No class-based architecture; using functional programming with TypeScript interfaces.

The application follows a functional programming paradigm with:
- Drizzle ORM schema definitions (not classes)
- tRPC routers as object configurations
- Svelte 5 components using Runes (composition-based, not class-based)
- Utility functions as pure functions

No traditional classes are needed for this implementation.

## [Dependencies]
Complete dependency specification for monorepo structure.

**Backend Dependencies (`backend/package.json`):**
```json
{
  "dependencies": {
    "@trpc/server": "^11.0.0",
    "drizzle-orm": "^0.36.0",
    "better-sqlite3": "^11.0.0",
    "express": "^4.21.0",
    "cors": "^2.8.5",
    "bcryptjs": "^2.4.3",
