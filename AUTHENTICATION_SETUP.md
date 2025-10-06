# Single-User Authentication Setup

The Recipe Manager now uses a hardcoded single-user authentication system for enhanced security. This means only one account exists, and it's configured through environment variables.

## Setup Instructions

### 1. Configure Backend Environment

Copy the `.env.example` file to create your `.env` file:

```bash
cd backend
cp .env.example .env
```

### 2. Set Your Credentials

Edit `backend/.env` and set your desired username and password:

```env
# Single User Authentication (hardcoded credentials)
ADMIN_USERNAME=your_username_here
ADMIN_PASSWORD=your_secure_password_here
```

**Important Security Notes:**
- Choose a strong, unique password (minimum 12 characters recommended)
- Never commit the `.env` file to version control (it's in `.gitignore`)
- Change the default credentials immediately
- Keep the JWT_SECRET secure as well

### 3. Restart the Backend

After changing credentials, restart the backend server:

```bash
docker compose restart backend
```

Or if running locally:

```bash
cd backend
npm run dev
```

## Login

Navigate to http://localhost:5173/login and enter the credentials you configured in the `.env` file.

## Security Features

✅ **No Database User Table**: User credentials are not stored in the database
✅ **Environment-Based**: Credentials configured through environment variables
✅ **No Registration Endpoint**: Registration functionality has been removed
✅ **Single Admin User**: Only one user account exists
✅ **JWT Authentication**: Secure token-based authentication

## Changing Credentials

To change your login credentials:

1. Edit `backend/.env`
2. Update `ADMIN_USERNAME` and/or `ADMIN_PASSWORD`
3. Restart the backend server
4. Use new credentials to login

## Troubleshooting

### "Invalid username or password" error

- Check that credentials in `backend/.env` match what you're entering
- Ensure the backend has been restarted after changing `.env`
- Verify there are no extra spaces in the `.env` file

### Login page not loading

- Ensure frontend is running: `npm run dev` in `frontend/`
- Check that backend is running: `npm run dev` in `backend/`
- Verify ports 3001 (backend) and 5173 (frontend) are available

## Production Deployment

When deploying to production:

1. Set strong, unique credentials in production environment variables
2. Use a secure JWT_SECRET (long random string)
3. Enable HTTPS
4. Consider additional security measures like rate limiting
5. Keep environment variables secure and never expose them

## Default Credentials

The default credentials in `.env.example` are:
- Username: `admin`
- Password: `changeme123`

**⚠️ CHANGE THESE IMMEDIATELY FOR ANY NON-LOCAL DEPLOYMENT!**
