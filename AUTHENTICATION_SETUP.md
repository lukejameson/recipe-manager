# Multi-User Authentication System

Recipe Manager uses a multi-user authentication system with admin roles, invite-only registration, and granular feature flags.

## System Overview

- **Multi-user support** with separate data isolation per user
- **Admin roles** for user and system management
- **Invite-only registration** via single-use codes
- **Per-user feature flags** to control access to AI features
- **Session management** with secure HTTP-only cookies
- **Account lockout** protection against brute-force attacks

## Initial Setup

### 1. Configure Environment Variables

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
# Required - JWT signing secret (minimum 32 characters)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Required - PostgreSQL connection
DATABASE_URL=postgresql://user:password@localhost:5432/recipe_manager

# Initial Admin User (used on first startup only)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password-here

# Server Configuration
PORT=3001
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### 2. Run Database Migrations

```bash
pnpm db:migrate
```

### 3. Start the Application

```bash
pnpm dev
```

On first startup, the system automatically creates the initial admin user from the `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables.

### 4. Login

Navigate to http://localhost:5173/login and enter the admin credentials.

## User Management

### Creating Invite Codes (Admin Only)

1. Log in as an admin user
2. Go to Settings (gear icon in header)
3. Navigate to "User Management" section
4. Click "Create Invite Code"
5. Share the generated code with the new user

Invite codes:
- Are 8-character alphanumeric strings
- Can only be used once
- Can have an optional expiration date
- Are tracked in audit logs

### Registering New Users

1. Navigate to the login page
2. Click "Register" or "Create Account"
3. Enter the invite code provided by an admin
4. Choose a username and password
5. Submit to create the account

### Managing User Feature Flags

Admins can control which features each user can access:

1. Go to Settings > User Management
2. Find the user in the list
3. Toggle individual feature flags:
   - **AI Chat** - Recipe Ideas chat and Ask AI
   - **Recipe Generation** - Save AI-generated recipes
   - **Tag Suggestions** - AI auto-tagging
   - **Nutrition Calc** - AI nutrition estimation
   - **Photo Extraction** - Extract recipes from photos
   - **URL Import** - Import recipes from URLs
   - **Image Search** - Pexels image search for recipes
   - **JSONLD Import** - Schema.org recipe import

### Promoting/Demoting Admins

Admins can promote other users to admin status:

1. Go to Settings > User Management
2. Find the user
3. Click "Make Admin" or "Remove Admin"

Note: Admins cannot demote themselves to prevent lockout.

### Deleting Users

Admins can delete user accounts:

1. Go to Settings > User Management
2. Find the user
3. Click "Delete User"
4. Confirm deletion

This permanently removes:
- User account
- All user's recipes
- All user's tags and collections
- All user's shopping list items
- All user's memories

## Security Features

### Password Requirements

- Minimum 8 characters
- Hashed using bcrypt with 12 salt rounds
- Users can change their password in Settings

### Session Management

- Sessions stored in database with hashed tokens
- HTTP-only cookies prevent XSS token theft
- Sessions expire after 7 days of inactivity
- Users can view active sessions in Settings
- Users can revoke other sessions

### Rate Limiting

- 5 login attempts per 15 minutes per IP
- After exceeding limit, IP is blocked temporarily

### Account Lockout

- 5 failed login attempts triggers lockout
- Account locked for 30 minutes
- Failed attempts counter resets on successful login

### CSRF Protection

- State-changing operations require CSRF token
- Token included in cookie and verified on requests
- Prevents cross-site request forgery attacks

### Audit Logging

Admin actions are logged for accountability:
- User creation/deletion
- Admin role changes
- Feature flag changes
- Invite code creation/deletion
- Settings changes

View audit logs in Settings > Audit Logs (admin only).

## Data Isolation

Each user's data is completely isolated:

- Recipes belong to the user who created them
- Tags are user-scoped (same tag name can exist per user)
- Collections are user-scoped
- Shopping lists are user-scoped
- Memories (AI preferences) are user-scoped

Users cannot see or modify other users' data.

## Troubleshooting

### "Invalid username or password" error

1. Verify credentials are correct
2. Check if account is locked (wait 30 minutes)
3. Check rate limiting hasn't triggered
4. Verify backend is running and connected to database

### "Invalid invite code" error

1. Verify code is entered correctly (case-sensitive)
2. Check if code has expired
3. Check if code was already used
4. Ask admin to generate a new code

### Cannot access admin features

1. Verify your account has admin role
2. Check with another admin to grant admin access
3. If no admins exist, the initial admin user can be recreated by:
   - Clearing the users table in the database
   - Restarting the backend (creates new admin from env vars)

### Session expired unexpectedly

1. Sessions expire after 7 days of inactivity
2. Check if session was revoked from another device
3. Browser privacy settings may be clearing cookies
4. Log in again to create a new session

## Production Recommendations

1. **Strong JWT Secret**: Use a random 64+ character string
2. **HTTPS**: Always use HTTPS in production
3. **Secure Passwords**: Require strong admin passwords
4. **Regular Audits**: Review audit logs periodically
5. **Database Backups**: Regular PostgreSQL backups
6. **Environment Security**: Never commit .env files
7. **Update Dependencies**: Keep packages updated for security patches
