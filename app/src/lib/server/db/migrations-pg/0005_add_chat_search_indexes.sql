-- Add full-text search indexes for chat history
-- GIN indexes for efficient text search

-- Create GIN index for chat session titles
CREATE INDEX IF NOT EXISTS "chat_sessions_title_search_idx" ON "chat_sessions" USING GIN (to_tsvector('english', "title"));
--> statement-breakpoint

-- Create GIN index for chat message content
CREATE INDEX IF NOT EXISTS "chat_messages_content_search_idx" ON "chat_messages" USING GIN (to_tsvector('english', "content"));
