#!/bin/bash
# Script to rebuild and redeploy the backend with fresh migrations

set -e

echo "🔄 Rebuilding backend container..."

# Stop the backend service
docker-compose stop backend

# Remove the backend container and image to force a clean rebuild
docker-compose rm -f backend
docker rmi recipe-manager-backend 2>/dev/null || echo "Image already removed"

# Rebuild and start the backend
docker-compose up -d --build backend

echo "✅ Backend rebuilt and started"
echo ""
echo "📊 Checking backend logs for migration status..."
sleep 2
docker-compose logs --tail=50 backend

echo ""
echo "✨ Done! The backend should now have the latest migrations applied."
echo ""
echo "To check if migrations ran successfully, look for:"
echo "  '✅ Database migrations completed successfully'"
echo ""
echo "To verify the database schema, run:"
echo "  psql \$DATABASE_URL -f check-db-schema.sql"
