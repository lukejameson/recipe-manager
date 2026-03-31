-- Add missing indexes for better query performance

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe_id ON recipe_tags(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag_id ON recipe_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_collection_recipes_collection_id ON collection_recipes(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_recipes_recipe_id ON collection_recipes(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_components_parent_id ON recipe_components(parent_recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_components_child_id ON recipe_components(child_recipe_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_user_id ON shopping_list_items(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_recipe_id ON shopping_list_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent_id ON chat_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_recipes_user_created ON recipes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_user_favorite ON recipes(user_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated ON chat_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tags_user_name ON tags(user_id, name);

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Database indexes created successfully';
END $$;