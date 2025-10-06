# Multi-Device Login Prevention Feature

## Overview

This feature ensures that users can only be signed in on one device at a time for enhanced security. When a user attempts to sign in on a new device while already signed in elsewhere, they will be presented with a modal warning them about the existing session and giving them the option to force the login (which will sign out all other sessions).

## Architecture

### Components

1. **Session Tracking Database Table** (`user_sessions`)
   - Tracks active user sessions across devices
   - Stores device information, IP addresses, and session metadata
   - Automatically expires sessions after 24 hours

2. **Backend API** (`/api/sessions`)
   - RESTful endpoints for session management
   - Functions for creating, checking, terminating, and cleaning up sessions

3. **Frontend Session Manager** (`src/utils/sessionManager.ts`)
   - TypeScript service for managing session state
   - Handles session creation, heartbeat, and cleanup

4. **Multi-Device Login Modal** (`components/MultiDeviceLoginModal.tsx`)
   - React Native modal component for displaying multi-device warnings
   - Shows active session details with device information

## Database Schema

### User Sessions Table

```sql
CREATE TABLE user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  device_info JSONB,
  ip_address INET,
  user_agent TEXT,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
  is_active BOOLEAN DEFAULT true
);
```

### Database Functions

- `check_active_sessions(user_id)` - Returns count and details of active sessions
- `create_user_session(...)` - Creates new session, optionally terminating others
- `terminate_user_session(session_token)` - Deactivates a specific session
- `update_session_activity(session_token)` - Updates last activity timestamp
- `cleanup_expired_sessions()` - Removes expired sessions

## API Endpoints

### GET `/api/sessions/check/:userId`
Check for active sessions for a user.

**Response:**
```json
{
  "sessionCount": 1,
  "activeSessions": [
    {
      "id": "session-uuid",
      "device_info": {
        "deviceName": "iPhone",
        "platform": "iOS",
        "deviceType": "phone"
      },
      "ip_address": "192.168.1.100",
      "last_activity": "2024-01-01T12:00:00Z",
      "created_at": "2024-01-01T10:00:00Z"
    }
  ]
}
```

### POST `/api/sessions/create`
Create a new session for a user.

**Request:**
```json
{
  "userId": "user-uuid",
  "forceSingleSession": false
}
```

**Response:**
```json
{
  "success": true,
  "sessionToken": "session-token",
  "sessionId": "session-uuid",
  "existingSessions": 0,
  "deviceInfo": {...},
  "ipAddress": "192.168.1.100"
}
```

### POST `/api/sessions/terminate`
Terminate a specific session.

**Request:**
```json
{
  "sessionToken": "session-token"
}
```

### POST `/api/sessions/heartbeat`
Update session activity (keep session alive).

**Request:**
```json
{
  "sessionToken": "session-token"
}
```

## Frontend Integration

### Session Manager

The `sessionManager` singleton handles all session-related operations:

```typescript
import { sessionManager } from '../utils/sessionManager';

// Check for active sessions
const sessionCheck = await sessionManager.checkActiveSessions(userId);

// Create new session
const session = await sessionManager.createSession(userId, forceSingleSession);

// Start heartbeat to keep session alive
sessionManager.startHeartbeat();

// Terminate session on logout
await sessionManager.terminateSession();
```

### Authentication Flow

The sign-in process now includes multi-device detection:

1. User enters credentials
2. Credentials are validated
3. System checks for existing active sessions
4. If sessions exist, show multi-device modal
5. User can cancel or force login (terminating other sessions)
6. New session is created and heartbeat starts

### Modal Component

The `MultiDeviceLoginModal` component displays:
- Warning about multiple device login
- List of active sessions with device details
- Security notice
- Options to cancel or force login

## Setup Instructions

### 1. Database Setup

Run the SQL migration to create the sessions table:

```bash
cd backend
node scripts/setup-sessions.js
```

Or manually execute the SQL file:
```bash
psql -d your_database -f sql/05_create_user_sessions_table.sql
```

### 2. Backend Setup

The sessions routes are automatically included when the backend starts. Ensure your backend includes:

```javascript
const sessionsRoutes = require("./routes/sessions");
app.use("/api/sessions", sessionsRoutes);
```

### 3. Frontend Setup

The feature is automatically integrated into the sign-in flow. No additional setup required.

## Configuration

### Session Timeout

Sessions expire after 24 hours by default. This can be modified in the database table definition or by updating the `expires_at` calculation.

### Heartbeat Interval

The session heartbeat runs every 60 seconds by default. This can be changed when calling `startHeartbeat()`:

```typescript
sessionManager.startHeartbeat(30000); // 30 seconds
```

### Device Detection

Device information is automatically extracted from the User-Agent header and includes:
- Platform (iOS, Android, Windows, macOS, Linux)
- Device type (phone, tablet, desktop)
- IP address
- User agent string

## Security Considerations

1. **Session Tokens**: Use cryptographically secure random tokens
2. **IP Tracking**: Monitor for suspicious IP changes
3. **Automatic Cleanup**: Expired sessions are automatically cleaned up
4. **Forced Logout**: Users can force logout from all devices
5. **Activity Tracking**: Last activity timestamps help identify stale sessions

## Troubleshooting

### Common Issues

1. **Sessions not being created**: Check backend logs for API errors
2. **Modal not showing**: Verify session check API is responding
3. **Heartbeat not working**: Ensure session token is stored correctly
4. **Database errors**: Run the setup script to create required tables and functions

### Debugging

Enable debug logging in the session manager:
```typescript
// Add to sessionManager.ts
console.log('Session check result:', sessionCheck);
console.log('Creating session for user:', userId);
```

### Manual Cleanup

To manually clean up expired sessions:
```bash
curl -X POST http://localhost:4001/api/sessions/cleanup
```

## Future Enhancements

1. **Push Notifications**: Notify users when their account is accessed from a new device
2. **Session Management UI**: Allow users to view and terminate active sessions
3. **Geographic Detection**: Show location information for sessions
4. **Trusted Devices**: Allow marking devices as trusted to skip warnings
5. **Session Analytics**: Track login patterns and suspicious activity

