# Debugging Chat History Issue

## Problem
When loading a chat history, only the initial user message appears, but AI assistant responses are missing.

## Possible Causes & Debugging Steps

### 1. Check if Messages Are Being Saved

**Deploy the updated frontend** with the new debug logging:
```bash
docker compose down
docker compose up -d --build
```

**Then test the chat:**
1. Open your browser's Developer Tools (F12)
2. Go to the Console tab
3. Send a message in the chat
4. Look for these log messages:
   - `💾 Saving user message to database...`
   - `✅ User message saved: <message-id>`
   - `💾 Saving assistant message to database...`
   - `✅ Assistant message saved: <message-id>`

**If you see errors:**
- `❌ Failed to save assistant message:` - This means the backend is rejecting the save
- Check the error details in the console
- The issue is likely with the data format or database constraints

### 2. Check What's Actually in the Database

Run this SQL query against your production database:
```bash
psql $DATABASE_URL -f debug-chat-history.sql
```

This will show you:
- Recent chat sessions and their message counts
- Actual messages in the most recent session (with role: user vs assistant)
- Message counts by role across all sessions

**Expected output:**
- Both `user_messages` and `assistant_messages` should have counts > 0
- If `assistant_messages` = 0, messages aren't being saved

### 3. Check What's Being Loaded

**When you click on a chat history item**, look for these console logs:
- `📥 Loaded session: {sessionId, messageCount}`
- `📝 Messages from database:` - Raw data from the API
- `✅ Converted messages:` - After mapping to frontend format
- `   - User messages: X`
- `   - Assistant messages: Y`

**Analysis:**
- If `messageCount` from database is correct but display is wrong → Frontend rendering issue
- If `messageCount` is 1 (only user message) → Messages aren't being saved to DB
- If both counts are correct but page doesn't show → React state issue

### 4. Check the Database Schema

Verify tables exist and have correct structure:
```bash
psql $DATABASE_URL -f check-db-schema.sql
```

Look for:
- `chat_sessions` table exists
- `chat_messages` table exists
- All expected columns are present
- Migration `0004_chat_history_tables` and `0005_add_chat_search_indexes` are applied

### 5. Check Backend Logs

Look at the backend container logs when saving/loading:
```bash
docker compose logs -f backend | grep -i "chat\|message"
```

Look for:
- Database connection errors
- Query errors
- JSON serialization errors (especially for `generatedRecipe` field)

## Common Issues

### Issue 1: Migrations Didn't Run
**Symptom:** Tables don't exist
**Fix:** Migrations should run automatically, but verify:
```bash
docker compose logs backend | grep "Database migrations"
```
Should see: `✅ Database migrations completed successfully`

### Issue 2: Recipe Object Too Large
**Symptom:** User messages save but assistant messages fail
**Cause:** `generatedRecipe` JSON might exceed database limits
**Fix:** Check backend logs for size-related errors

### Issue 3: Timing Issue
**Symptom:** Messages save but don't appear immediately
**Cause:** Session reload happens before save completes
**Fix:** Already handled in code with proper await, but check if network is slow

### Issue 4: CORS or Network Error
**Symptom:** Messages fail to save in production but work locally
**Cause:** Backend not reachable from frontend
**Check:** Browser network tab, look for failed API calls to `/trpc/chatHistory.addMessage`

## Next Steps

1. **Deploy the debug version** (already done above)
2. **Open browser console** and test chat
3. **Run the SQL debug script** to see database state
4. **Report back** with:
   - Console log output (copy/paste the emoji logs)
   - SQL query results (especially the message counts)
   - Backend logs if there are any errors

This will tell us exactly where the messages are being lost!
