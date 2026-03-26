-- Debug script to check chat history data
-- Run this against your production database

-- Check recent chat sessions
SELECT
  id,
  title,
  message_count,
  last_message_preview,
  created_at,
  updated_at
FROM chat_sessions
ORDER BY updated_at DESC
LIMIT 10;

-- Check messages in the most recent session
WITH recent_session AS (
  SELECT id FROM chat_sessions ORDER BY updated_at DESC LIMIT 1
)
SELECT
  cm.id,
  cm.role,
  LENGTH(cm.content) as content_length,
  LEFT(cm.content, 50) as content_preview,
  cm.images IS NOT NULL as has_images,
  cm.referenced_recipes IS NOT NULL as has_referenced_recipes,
  cm.generated_recipe IS NOT NULL as has_generated_recipe,
  cm.created_at
FROM chat_messages cm
WHERE cm.session_id = (SELECT id FROM recent_session)
ORDER BY cm.created_at ASC;

-- Count messages by role in recent sessions
SELECT
  cs.id as session_id,
  cs.title,
  COUNT(CASE WHEN cm.role = 'user' THEN 1 END) as user_messages,
  COUNT(CASE WHEN cm.role = 'assistant' THEN 1 END) as assistant_messages,
  COUNT(*) as total_messages
FROM chat_sessions cs
LEFT JOIN chat_messages cm ON cm.session_id = cs.id
WHERE cs.updated_at > NOW() - INTERVAL '7 days'
GROUP BY cs.id, cs.title
ORDER BY cs.updated_at DESC
LIMIT 10;

-- Check for any error patterns in message content
SELECT
  role,
  COUNT(*) as count,
  AVG(LENGTH(content)) as avg_content_length
FROM chat_messages
GROUP BY role;
