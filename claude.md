# Recipe Manager - Claude Context

## Overview
Full-stack recipe management PWA with single-user authentication.

## Tech Stack

**Backend:** Node.js 22, Express, tRPC 11, Drizzle ORM, SQLite (WAL mode), JWT auth (Jose), bcryptjs
**Frontend:** SvelteKit 5, Svelte 5 Runes, TanStack Query, Vite 6, PWA
**Deployment:** Docker Compose, Traefik reverse proxy

## Project Structure
```
backend/
├── src/
│   ├── db/           # Drizzle schema, migrations, connection
│   ├── trpc/routers/ # auth, recipe, tag, collection, shoppingList, settings, ai
│   ├── services/     # AI integration (Anthropic Claude for nutrition)
│   └── utils/        # auth.ts, jsonld-parser.ts, encryption, units
frontend/
├── src/
│   ├── lib/
│   │   ├── components/  # Svelte components
│   │   ├── stores/      # auth.svelte.ts (Svelte 5 runes)
│   │   └── trpc/        # tRPC client
│   └── routes/          # SvelteKit pages
```

## Key Commands
```bash
pnpm dev              # Run both frontend + backend
pnpm build            # Build both
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run migrations
```

## Database Schema (SQLite)
- **users** - Single user (fixed ID: "admin-user")
- **recipes** - Full recipe data, ingredients/instructions as JSON arrays, nutrition JSON
- **tags** / **recipeTags** - Many-to-many tagging with cascade deletes
- **collections** / **collectionRecipes** - Custom recipe groupings
- **recipeComponents** - Parent-child recipe relationships
- **shoppingListItems** - Shopping list with categories
- **settings** - App config (API keys, model selection)

## Key Patterns

### Backend
- tRPC routers with Zod validation
- Context-based auth middleware for protected procedures
- JWT tokens (24h expiry) stored in localStorage
- SSRF protection on URL fetching
- Rate limiting on auth endpoints (5 attempts/15min)

### Frontend
- Class-based stores with Svelte 5 `$state` runes
- tRPC client with batch link
- Bearer token in Authorization header
- Mobile-first responsive design

## Important Files
| File | Purpose |
|------|---------|
| `backend/src/db/schema.ts` | All table definitions |
| `backend/src/trpc/router.ts` | Main router combining sub-routers |
| `backend/src/utils/jsonld-parser.ts` | Recipe import from Schema.org JSONLD |
| `frontend/src/lib/stores/auth.svelte.ts` | Auth state management |
| `frontend/src/lib/trpc/client.ts` | tRPC client setup |

## Environment Variables
- `JWT_SECRET` - Token signing secret
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` - Single user credentials
- `ALLOWED_ORIGINS` - CORS whitelist
- `DATABASE_URL` - SQLite path (default: `./data/recipes.db`)
- `PORT` - Backend port (default: 3001)

## Conventions
- ES Modules (`"type": "module"`)
- TypeScript strict mode
- UUIDs for primary keys
- Timestamps as Unix epoch (seconds)
- JSON columns for nested data (ingredients, instructions, nutrition)
- Cascade deletes on foreign keys

## Features
- Recipe CRUD with rating, difficulty, cook tracking
- Import recipes from web (JSONLD Schema.org parsing)
- Tags with merge/rename and auto-collection display
- Collections for custom groupings
- Recipe scaling (dynamic ingredient quantities)
- Shopping list generation
- Compound/composite recipes (recipe components)

## AI Features (Anthropic Claude API)
All AI features require API key configured in Settings.

| Feature | Location | Description |
|---------|----------|-------------|
| Nutrition Calculation | Recipe detail/form | Estimates per-serving nutrition from ingredients |
| Auto-Tagging | Recipe form | Suggests tags based on recipe content |
| Ingredient Substitution | Recipe detail (per ingredient) | Suggests alternatives with ratios |
| Recipe Improvement | Recipe detail | Suggests enhancements for flavor/technique/etc |
| Recipe Adaptation | Recipe detail | Converts recipe for dietary needs (vegan, GF, etc) |
| Technique Explanations | On-demand | Explains cooking terms with steps and tips |
| Pantry Match | `/pantry-match` page | Find recipes matching available ingredients |

### AI Service Files (`backend/src/services/ai/`)
- `index.ts` - AIService singleton with `complete()` method
- `nutrition.ts` - Nutrition calculation
- `auto-tagging.ts` - Tag suggestions
- `substitution.ts` - Ingredient alternatives
- `improvement.ts` - Recipe enhancement suggestions
- `adaptation.ts` - Dietary adaptation
- `pantry-match.ts` - Recipe matching by ingredients
- `techniques.ts` - Cooking term explanations

### AI Components (`frontend/src/lib/components/ai/`)
- `AIButton.svelte` - Reusable subtle AI trigger button
- `AIBadge.svelte` - "AI Generated" indicator
- `TagSuggestionsPanel.svelte` - Inline tag chips for form
- `SubstitutionModal.svelte` - Ingredient alternatives modal
- `ImprovementModal.svelte` - Suggestions list modal
- `AdaptRecipeModal.svelte` - Dietary adaptation with save options
- `TechniqueTooltip.svelte` - Term explanation popover

## No Test Framework
Currently no testing setup - consider adding Vitest if tests are needed.
