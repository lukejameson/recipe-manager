-- Script to check if chat history tables exist and their structure
-- Run this against your production database

-- Check if tables exist
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('chat_sessions', 'chat_messages')
ORDER BY table_name;

-- Check columns in chat_sessions (if table exists)
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'chat_sessions'
ORDER BY ordinal_position;

-- Check columns in chat_messages (if table exists)
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'chat_messages'
ORDER BY ordinal_position;

-- Check if there's data in the tables
SELECT
  (SELECT COUNT(*) FROM chat_sessions) as session_count,
  (SELECT COUNT(*) FROM chat_messages) as message_count;

-- Check applied migrations
SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at;
