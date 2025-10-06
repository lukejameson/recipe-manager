# Recipe Manager

A modern, mobile-responsive Progressive Web App (PWA) for managing personal recipes with authentication, flexible tagging, and Schema.org/Recipe JSONLD import support.

## Features

- 🔐 **Single-user authentication** with JWT
- 📝 **Complete recipe CRUD** (Create, Read, Update, Delete)
- 🏷️ **Flexible tagging system** for recipe organization
- 📥 **Schema.org/Recipe JSONLD import** from websites
- 📱 **PWA support** for installability on mobile and desktop
- 🎨 **Clean, responsive design** optimized for mobile and desktop
- 🔍 **Search and filter** recipes by title, description, and tags
- 🐳 **Docker deployment** ready

## Tech Stack

### Backend
- **Node.js** with **TypeScript**
- **tRPC** for type-safe API
- **Express** server
- **Drizzle ORM** with **SQLite** database
- **Jose** for JWT authentication
- **Bcrypt** for password hashing

### Frontend
- **SvelteKit 5** with **Runes**
- **TypeScript**
- **Vite** build tool
- **tRPC client** for type-safe API calls
- **PWA** with Vite Plugin PWA

## Prerequisites

- Node.js 22.x or later
- pnpm 10.x or later (recommended) or npm
- Docker and Docker Compose (for containerized deployment)

## Quick Start

### 1. Clone and install

```bash
git clone <repository-url>
cd recipe-manager
pnpm install:all  # Installs both backend and frontend dependencies
```

### 2. Configure environment variables

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env and set your JWT_SECRET

# Frontend
cp frontend/.env.example frontend/.env
# Edit if needed (defaults work for local development)
```

### 3. Initialize the database

```bash
pnpm db:migrate
```

### 4. Start development servers

```bash
pnpm dev
```

This single command starts both backend and frontend:
- Backend: http://localhost:3001
- Frontend: http://localhost:5173

## Available Commands

```bash
# Development
pnpm dev              # Start both backend and frontend
pnpm dev:backend      # Start only backend
pnpm dev:frontend     # Start only frontend

# Installation
pnpm install:all      # Install all dependencies

# Database
pnpm db:generate      # Generate database migrations
pnpm db:migrate       # Run database migrations

# Production Build
pnpm build            # Build both projects
pnpm start            # Start both in production mode

# Docker
pnpm docker:up        # Start with Docker Compose
pnpm docker:down      # Stop Docker containers
pnpm docker:logs      # View Docker logs
```

### First-time setup

1. Navigate to http://localhost:5173
2. Click "Register" to create your account (only one user allowed)
3. Log in with your credentials
4. Start adding recipes!

## Production Build

### Backend

```bash
cd backend
pnpm build
pnpm start
```

### Frontend

```bash
cd frontend
pnpm build
pnpm preview
```

## Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### Environment Variables for Docker

Create a `.env` file in the root directory:

```env
JWT_SECRET=your-super-secret-jwt-key-here
```

## API Endpoints

The backend exposes a tRPC API at `/trpc` with the following routers:

### Auth Router
- `auth.register` - Register first user
- `auth.login` - Login with credentials
- `auth.me` - Get current user

### Recipe Router
- `recipe.list` - List all recipes (with optional search and tag filters)
- `recipe.get` - Get single recipe by ID
- `recipe.create` - Create new recipe
- `recipe.update` - Update existing recipe
- `recipe.delete` - Delete recipe
- `recipe.importJsonLd` - Import recipe from JSONLD

### Tag Router
- `tag.list` - List all tags with recipe counts
- `tag.create` - Create new tag
- `tag.delete` - Delete tag (if not in use)

## Project Structure

```
recipe-manager/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts          # Drizzle ORM schema
│   │   │   ├── index.ts           # Database connection
│   │   │   └── migrate.ts         # Migration runner
│   │   ├── trpc/
│   │   │   ├── context.ts         # tRPC context with auth
│   │   │   ├── router.ts          # Main router
│   │   │   └── routers/           # Individual routers
│   │   ├── utils/
│   │   │   ├── auth.ts            # Auth utilities
│   │   │   └── jsonld-parser.ts   # JSONLD parser
│   │   └── server.ts              # Express server
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── components/        # Svelte components
│   │   │   ├── stores/            # State management
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

## Importing Recipes

### From JSONLD

Many recipe websites include Schema.org/Recipe JSONLD in their pages. To import:

1. Go to "Import" in the navigation
2. Paste the JSONLD code
3. Click "Import Recipe"

The parser supports:
- Standard recipe fields (title, description, ingredients, instructions)
- Time durations in ISO 8601 format
- Recipe categories and keywords as tags
- Images and source URLs

### Example JSONLD

```json
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Chocolate Chip Cookies",
  "description": "Classic homemade cookies",
  "prepTime": "PT15M",
  "cookTime": "PT10M",
  "recipeYield": "24",
  "recipeIngredient": [
    "2 cups flour",
    "1 cup butter",
    "1 cup sugar",
    "2 eggs",
    "1 tsp vanilla",
    "2 cups chocolate chips"
  ],
  "recipeInstructions": [
    {
      "@type": "HowToStep",
      "text": "Preheat oven to 350°F"
    },
    {
      "@type": "HowToStep",
      "text": "Mix butter and sugar"
    },
    {
      "@type": "HowToStep",
      "text": "Add eggs and vanilla"
    },
    {
      "@type": "HowToStep",
      "text": "Mix in flour and chocolate chips"
    },
    {
      "@type": "HowToStep",
      "text": "Bake for 10 minutes"
    }
  ],
  "recipeCategory": "Dessert",
  "keywords": "cookies, chocolate"
}
```

## Security Notes

- Change the default `JWT_SECRET` in production
- The application supports only a single user (first registered user)
- All recipe operations require authentication
- Passwords are hashed using bcrypt with salt rounds of 10

## PWA Features

The application is installable as a PWA on:
- iOS (Safari): Add to Home Screen
- Android (Chrome): Install App
- Desktop (Chrome, Edge): Install App

Note: Offline functionality is not included in the current version. The PWA manifest is configured for installability only.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
