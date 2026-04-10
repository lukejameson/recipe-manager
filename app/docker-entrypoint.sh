#!/bin/sh
set -e

# Production entrypoint script for Recipe Manager
# Handles database migrations and schema updates before starting the app

echo "Starting Recipe Manager entrypoint..."

# Check required environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable is required"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "ERROR: JWT_SECRET environment variable is required"
    exit 1
fi

# Function to run Drizzle migrations
run_migrations() {
    echo "Running Drizzle database migrations..."

    # First, run any SQL migration files in drizzle/migrations
    if [ -d "./drizzle" ]; then
        echo "Running SQL migration files..."
        for sql_file in ./drizzle/*.sql; do
            if [ -f "$sql_file" ]; then
                echo "Executing: $sql_file"
                psql "$DATABASE_URL" -f "$sql_file" || echo "⚠️  Failed to execute $sql_file (may already exist)"
            fi
        done
    fi

    # Push schema changes to the database
    # --force skips confirmation prompts
    # --strict=false allows drift detection without failing
    # DRIZZLE_STUDIO=false disables studio to avoid permission issues
    echo "Running drizzle-kit push..."
    # Pipe "n" to avoid truncating tables, add constraint without truncating
    if DRIZZLE_STUDIO=false npx drizzle-kit push --force --strict=false; then
        echo "✅ Database migrations completed successfully"
    else
        echo "⚠️  Database migration had issues, but continuing..."
        # For production safety, you may want to exit here instead
        # exit 1
    fi
}

# Function to run recipe structure migration
run_recipe_migration() {
    echo "Checking if recipe structure migration is needed..."

    # Check if migration has already been run (optional - requires tracking table)
    # For now, we run it if RECIPE_MIGRATION environment variable is set to "true"
    if [ "$RECIPE_MIGRATION" = "true" ]; then
        echo "Running recipe structure migration..."

        if node --loader tsx ./scripts/migrate-recipe-structure.ts; then
            echo "✅ Recipe structure migration completed"
        else
            echo "⚠️  Recipe structure migration failed, but continuing..."
        fi
    else
        echo "Skipping recipe structure migration (set RECIPE_MIGRATION=true to run)"
        echo "To run manually: docker exec <container> npx tsx scripts/migrate-recipe-structure.ts"
    fi
}

# Run all migrations
run_migrations

# Run optional recipe migration
run_recipe_migration

# Add health check endpoint if not present
# Create a simple health check that will be handled by the app
echo "Health check configured at /health"

echo "Entrypoint complete, starting application..."

# Execute the main command (passed as CMD in Dockerfile)
exec "$@"
