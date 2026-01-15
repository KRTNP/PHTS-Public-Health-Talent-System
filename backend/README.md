# PHTS Backend API

Backend API server for the PHTS (Public Health Talent System) built with Express, TypeScript, and Passport.js JWT authentication.

## Architecture Overview

```
backend/
├── src/
│   ├── config/              # Configuration files (DB, passport, redis, upload)
│   ├── middlewares/         # Express middlewares
│   ├── modules/             # Feature-based modules
│   │   ├── admin/           # System + officer management
│   │   ├── auth/            # Authentication
│   │   ├── notification/    # Notifications
│   │   ├── payroll/         # Payroll domain
│   │   │   └── core/        # Payroll calculation engine
│   │   ├── report/          # Report generation
│   │   ├── request/         # Request workflow
│   │   └── signature/       # Signature management
│   ├── services/            # Shared services (sync)
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Shared helpers
│   ├── validators/          # Request validators
│   ├── scripts/             # Utility scripts
│   └── index.ts             # Main server entry point
├── .env                     # Environment variables
├── package.json
└── tsconfig.json
```

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express 4.x
- **Language**: TypeScript 5.x
- **Authentication**: Passport.js with JWT strategy
- **Database**: MySQL 9.x with mysql2 driver
- **Password Hashing**: bcryptjs
- **Security**: Helmet, CORS

## Environment Variables

Set the following variables in `.env`:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `PORT`
- `NODE_ENV`
- `FRONTEND_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `REDIS_DB`
- `EMAIL_ENABLED` (optional, default false)
- `SMTP_HOST` (optional)
- `SMTP_PORT` (optional)
- `SMTP_USER` (optional)
- `SMTP_PASS` (optional)
- `SMTP_SECURE` (optional)
- `SMTP_FROM` (optional)
- `OCR_ENABLED` (optional, default false)
- `OCR_PROVIDER` (optional, default TYPHOON)
- `OCR_API_KEY` (optional)
- `OCR_BASE_URL` (optional, default https://api.opentyphoon.ai/v1)
- `OCR_ENDPOINT` (optional, legacy alias)
- `OCR_PYTHON_BIN` (optional, default python3)
- `OCR_TIMEOUT_MS` (optional, default 120000)
- `BACKUP_ENABLED` (optional, default false)
- `BACKUP_COMMAND` (optional)
- `BACKUP_WORKDIR` (optional)
- `BACKUP_TIMEOUT_MS` (optional, default 300000)
- `BACKUP_DIR` (optional, default ./backups)
- `BACKUP_RETENTION_DAYS` (optional, default 30)

## Installation

```bash
# Install dependencies
npm install

# Optional helpers
npx tsx src/scripts/setup_database.ts
npx tsx src/scripts/create_local_admin.ts
```

## Running the Server

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

Server will start on http://localhost:3001

## API Endpoints

### Health Check

**GET** `/health`

Check if the API server is running.

**Response:**
```json
{
  "success": true,
  "message": "PHTS API is running",
  "data": {
    "timestamp": "2025-12-30T06:46:50.345Z",
    "environment": "development",
    "port": "3001"
  }
}
```

### Authentication Endpoints

#### Login

**POST** `/api/auth/login`

Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "citizen_id": "1234567890123",
  "password": "25021990"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "citizen_id": "1234567890123",
    "role": "ADMIN",
    "is_active": 1,
    "last_login_at": null
  }
}
```

**Error Responses:**

- **400 Bad Request**: Missing fields or invalid citizen ID format
  ```json
  {
    "success": false,
    "error": "Invalid citizen ID format. Must be 13 digits."
  }
  ```

- **401 Unauthorized**: Invalid credentials
  ```json
  {
    "success": false,
    "error": "Invalid citizen ID or password"
  }
  ```

- **403 Forbidden**: Account is inactive
  ```json
  {
    "success": false,
    "error": "Your account has been deactivated. Please contact administrator."
  }
  ```

#### Get Current User

**GET** `/api/auth/me`

Get profile of currently authenticated user.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "citizen_id": "1234567890123",
    "role": "ADMIN",
    "is_active": 1,
    "last_login_at": "2025-12-29T23:49:39.000Z"
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "error": "No auth token"
}
```

#### Logout

**POST** `/api/auth/logout`

Logout user (client-side token removal).

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Authentication Flow

### 1. User Login

1. Client sends POST request to `/api/auth/login` with `citizen_id` and `password`
2. Server validates citizen ID format (must be 13 digits)
3. Server queries user from database
4. Server checks if user account is active
5. Server verifies password using bcrypt
6. Server updates `last_login_at` timestamp
7. Server generates JWT token containing `{ userId, citizenId, role }`
8. Server returns token and user profile

### 2. Protected Route Access

1. Client includes JWT token in Authorization header: `Bearer <token>`
2. Passport JWT strategy extracts and verifies token
3. Strategy queries database to ensure user still exists and is active
4. Strategy verifies role hasn't changed since token was issued
5. If valid, user payload is attached to `req.user`
6. Route handler processes the request

### 3. Role-Based Access Control

Use the `restrictTo()` middleware after `protect` middleware:

```typescript
import { protect, restrictTo } from './middlewares/authMiddleware.js';
import { UserRole } from './types/auth.js';

// Admin-only route
router.get('/admin-data', protect, restrictTo(UserRole.ADMIN), getAdminData);

// Multiple roles allowed
router.get('/reports', protect, restrictTo(UserRole.DIRECTOR, UserRole.HEAD_HR), getReports);
```

## User Roles

The system supports 8 user roles:

| Role | Description | Dashboard Route |
|------|-------------|-----------------|
| `USER` | General Staff | `/dashboard/user` |
| `HEAD_DEPT` | Department Head | `/dashboard/approver` |
| `PTS_OFFICER` | PTS Admin Staff | `/dashboard/officer` |
| `HEAD_HR` | HR Head | `/dashboard/hr-head` |
| `DIRECTOR` | Hospital Director | `/dashboard/director` |
| `FINANCE_OFFICER` | Finance Staff | `/dashboard/finance` |
| `HEAD_FINANCE` | Finance Head | `/dashboard/finance-head` |
| `ADMIN` | System Administrator | `/dashboard/admin` |

## Test Users

### Active Admin User
```
Citizen ID: 1234567890123
Password: 25021990
Role: ADMIN
```

### Inactive User (for testing 403 response)
```
Citizen ID: 9876543210987
Password: 15081995
Role: USER
Status: Inactive
```

## Testing the API

### Using cURL

#### Test Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"citizen_id":"1234567890123","password":"25021990"}'
```

#### Test Protected Route
```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Test Invalid Credentials
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"citizen_id":"1234567890123","password":"wrongpassword"}'
```

#### Test Inactive Account
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"citizen_id":"9876543210987","password":"15081995"}'
```

## Security Features

1. **Password Hashing**: All passwords are hashed using bcryptjs with 10 salt rounds
2. **JWT Token**: Tokens expire after 24 hours (configurable)
3. **Helmet**: HTTP security headers
4. **CORS**: Cross-origin resource sharing protection
5. **Input Validation**: Citizen ID format validation (13 digits)
6. **Active Status Check**: Users must have `is_active = 1` to login
7. **Role Verification**: JWT payload role is verified against database on each request
8. **No Password Exposure**: Passwords never appear in responses or logs

## Database Schema

### users Table

```sql
CREATE TABLE users (
  user_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  citizen_id VARCHAR(20) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('USER', 'HEAD_DEPT', 'PTS_OFFICER', 'HEAD_HR', 'DIRECTOR', 'FINANCE_OFFICER', 'HEAD_FINANCE', 'ADMIN') NOT NULL DEFAULT 'USER',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Error Handling

The API uses a consistent error response format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid token or credentials)
- `403` - Forbidden (inactive account or insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Middleware Stack

1. **helmet()** - Security headers
2. **cors()** - Cross-origin resource sharing
3. **express.json()** - JSON body parser
4. **morgan()** - HTTP request logger
5. **passport.initialize()** - Passport authentication
6. **Routes** - API endpoints
7. **404 Handler** - Route not found
8. **Error Handler** - Global error handling

## Development Scripts

```bash
# Start development server with hot reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Run production server
npm start

# Seed users from HRMS
npm run seed:users

# Code formatting
npm run format

# Code linting
npm run lint
```

## Future Enhancements

- Rate limiting on login endpoint
- Refresh token mechanism
- Token blacklisting for logout
- Password reset functionality
- Account lockout after failed login attempts
- Two-factor authentication (2FA)
- API documentation with Swagger/OpenAPI
- Unit and integration tests

## Support

For issues or questions, contact the PHTS Development Team.

---

Last Updated: 2026-01-09
