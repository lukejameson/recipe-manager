# Recipe Manager

A modern, mobile-responsive Progressive Web App (PWA) for managing personal recipes with multi-user authentication, AI-powered features, and comprehensive recipe organization tools.

## Features

### Core Features
- **Multi-user system** with admin roles and invite-only registration
- **Complete recipe CRUD** (Create, Read, Update, Delete)
- **Flexible tagging system** with merge, rename, and auto-suggestions
- **Recipe collections** for custom groupings
- **Shopping list** with category organization
- **Recipe components** for compound/composite recipes
- **Recipe scaling** with automatic ingredient calculations
- **Favorites, ratings, and cooking history** tracking
- **Personal cooking notes** per recipe
- **PWA support** for installability on mobile and desktop

### Import Options
- **URL Import** - Paste a recipe URL and automatically extract content
- **Schema.org/Recipe JSONLD** import from websites
- **Photo extraction** - Upload recipe photos for AI-powered parsing
- **Manual entry** with rich editing

### AI-Powered Features (Requires Anthropic API Key)
- **Recipe Ideas Chat** - Brainstorm and generate new recipes with AI
  - @ mention existing recipes for context (e.g., "@Chicken Soup")
  - Save generated recipes directly to your collection
- **Ask AI** - Chat about specific recipes
  - Get side dish recommendations, pairing suggestions, modifications
  - Save recommended recipes with one click
- **Auto-tagging** - AI suggests relevant tags for recipes
- **Nutrition calculation** - Estimate calories, protein, carbs, fat per serving
- **Ingredient substitutions** - Get alternatives with ratios
- **Recipe improvements** - AI suggestions for better flavor/technique
- **Dietary adaptations** - Convert recipes (vegan, gluten-free, etc.)
- **Technique explanations** - Learn about cooking terms and methods
- **What Can I Make?** - Find recipes matching your available ingredients
- **Custom AI Agents** - Create specialized chat personas (Chef, Mixologist, etc.)
- **User memories** - AI remembers your preferences and dietary restrictions

### Security Features
- **HTTP-only cookies** for session management
- **Token hashing** (SHA-256) for stored sessions
- **CSRF protection** on state-changing operations
- **Rate limiting** on authentication endpoints
- **Account lockout** after failed login attempts
- **Audit logging** for admin actions
- **SSRF protection** on URL fetching
- **Per-user feature flags** for granular access control

## Tech Stack

### Backend
- **Node.js 22** with **TypeScript**
- **tRPC** for type-safe API
- **Express** server with security middleware
- **Drizzle ORM** with **PostgreSQL** database
- **Jose** for JWT authentication
- **Bcrypt** for password hashing
- **Anthropic Claude API** for AI features
- **Pexels API** for recipe image search

### Frontend
- **SvelteKit 5** with **Svelte 5 Runes**
- **TypeScript**
- **TanStack Query** for data fetching
- **Vite** build tool
- **tRPC client** for type-safe API calls
- **PWA** with Vite Plugin PWA

## Prerequisites

- Node.js 22.x or later
- pnpm 10.x or later (recommended) or npm
- PostgreSQL 14+ database
- Docker and Docker Compose (for containerized deployment)

## Quick Start

### 1. Clone and install

```bash
git clone <repository-url>
cd recipe-manager
pnpm install
```

### 2. Configure environment variables

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env - see Environment Variables section

# Frontend
cp frontend/.env.example frontend/.env
# Edit if needed (defaults work for local development)
```

### 3. Set up the database

```bash
# Start PostgreSQL (using Docker)
docker compose up -d postgres

# Run migrations
pnpm db:migrate
```

### 4. Start development servers

```bash
pnpm dev
```

This single command starts both backend and frontend:
- Backend: http://localhost:3001
- Frontend: http://localhost:5173

### 5. Create admin user

The first user is created using environment variables:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

On first startup, this creates the initial admin user who can then invite other users.

## Available Commands

```bash
# Development
pnpm dev              # Start both backend and frontend
pnpm dev:backend      # Start only backend
pnpm dev:frontend     # Start only frontend

# Installation
pnpm install          # Install all dependencies

# Database
pnpm db:generate      # Generate database migrations
pnpm db:migrate       # Run database migrations

# Build & Production
pnpm build            # Build both projects
pnpm start            # Start both in production mode
pnpm check            # Type check both projects

# Docker
pnpm docker:up        # Start with Docker Compose
pnpm docker:down      # Stop Docker containers
pnpm docker:logs      # View Docker logs
```

## Environment Variables

### Backend (`backend/.env`)

```env
# Required
JWT_SECRET=your-super-secret-jwt-key-minimum-32-chars
DATABASE_URL=postgresql://user:password@localhost:5432/recipe_manager

# Initial Admin User (required for first setup)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password

# Server
PORT=3001
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Optional - Set in app Settings page instead
# ANTHROPIC_API_KEY=sk-ant-...
# PEXELS_API_KEY=...
```

### Frontend (`frontend/.env`)

```env
PUBLIC_API_URL=http://localhost:3001
```

## Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Build and start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## User Management

### Admin Features
- Create invite codes for new user registration
- Manage user feature flags (enable/disable AI features per user)
- Promote/demote users to admin
- View audit logs of admin actions
- Delete users and their data
- Configure global settings (API keys, default features)

### Invite System
1. Admin creates an invite code in Settings > User Management
2. New user visits the login page and clicks "Register"
3. User enters invite code, username, and password
4. Account is created with default feature flags

### Feature Flags
Admins can enable/disable these features per user:
- AI Chat & Recipe Generation
- Tag Suggestions
- Nutrition Calculation
- Photo Extraction
- URL Import
- Image Search
- JSONLD Import

## API Endpoints

The backend exposes a tRPC API at `/trpc` with these routers:

| Router | Description |
|--------|-------------|
| `auth` | Login, register, logout, session management |
| `admin` | User management, invite codes, audit logs |
| `recipe` | Recipe CRUD, search, favorites, scaling |
| `tag` | Tag management, merge, rename |
| `collection` | Recipe collections |
| `shoppingList` | Shopping list management |
| `settings` | App configuration (admin only) |
| `ai` | AI features, chat, recipe generation |

## Project Structure

```
recipe-manager/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts          # Drizzle ORM schema
│   │   │   ├── index.ts           # Database connection
│   │   │   └── migrations-pg/     # PostgreSQL migrations
│   │   ├── trpc/
│   │   │   ├── context.ts         # tRPC context with auth
│   │   │   ├── router.ts          # Main router
│   │   │   └── routers/           # Individual routers
│   │   ├── services/
│   │   │   └── ai/                # AI service modules
│   │   ├── utils/
│   │   │   ├── auth.ts            # Auth utilities
│   │   │   ├── encryption.ts      # API key encryption
│   │   │   └── jsonld-parser.ts   # Recipe import parser
│   │   └── server.ts              # Express server
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── components/        # Svelte components
│   │   │   │   └── ai/            # AI-related components
│   │   │   ├── stores/            # State management (Svelte 5 runes)
│   │   │   ├── trpc/              # tRPC client
│   │   │   └── utils/             # Utility functions
│   │   ├── routes/                # SvelteKit routes
│   │   └── app.html               # HTML template
│   ├── static/                    # Static assets
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

## AI Features Setup

1. Go to Settings (gear icon in header)
2. Enter your Anthropic API key
3. Optionally select primary and secondary models
4. Optionally add Pexels API key for recipe image search
5. AI features will now be available throughout the app

### AI Chat Features

**Recipe Ideas Chat** (`/generate`):
- Brainstorm new recipe ideas with AI
- Use @ mentions to reference existing recipes (e.g., "What goes well with @Beef Stew?")
- Save generated recipes directly to your collection
- Choose from different AI agents (Chef, Mixologist, or custom)

**Ask AI** (on recipe pages):
- Ask questions about specific recipes
- Get suggestions for side dishes, wine pairings, modifications
- Save AI-recommended complementary recipes with one click
- Quick actions: "Suggest a side dish", "What wine pairs well?"

### User Memories

In Settings, add "memories" that the AI will consider:
- Dietary restrictions ("I'm vegetarian", "Allergic to nuts")
- Preferences ("I prefer spicy food", "Cooking for family of 4")
- Equipment ("I have an Instant Pot", "No oven available")

## Security Notes

- Change the default `JWT_SECRET` in production (minimum 32 characters)
- Use strong passwords for admin accounts
- All passwords are hashed using bcrypt (12 rounds)
- Sessions expire after 7 days of inactivity
- Rate limiting: 5 login attempts per 15 minutes per IP
- Account lockout: 30 minutes after 5 failed attempts
- API keys are encrypted at rest using AES-256-GCM
- CSRF tokens required for all state-changing operations

## PWA Features

The application is installable as a PWA on:
- iOS (Safari): Add to Home Screen
- Android (Chrome): Install App
- Desktop (Chrome, Edge): Install App

## Importing Recipes

### From URL
1. Go to Import in the navigation
2. Paste any recipe URL
3. Click "Import from URL"
4. AI extracts and parses the recipe

### From Photo
1. Go to Import in the navigation
2. Upload a photo of a recipe (cookbook, handwritten, etc.)
3. AI extracts text and structures it as a recipe

### From JSONLD
1. Enable JSONLD Import in your feature flags (admin setting)
2. Go to Import > JSONLD tab
3. Paste Schema.org/Recipe JSONLD
4. Click "Import Recipe"

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
