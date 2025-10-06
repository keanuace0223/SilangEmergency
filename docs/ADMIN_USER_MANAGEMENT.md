# Admin User Management System

## Overview

The Admin User Management system provides Barangay Captains and designated administrators with comprehensive tools to manage users in the Silang Emergency Response app. This includes creating new user accounts, viewing user statistics, and managing existing users.

## Features

### 🔐 **Role-Based Access**
- Only Barangay Captains and designated admins can access the admin panel
- Automatic detection of admin privileges based on user position
- Secure API endpoints with authorization checks

### 👥 **User Management**
- **Create Users**: Add new users with complete profile information
- **View Users**: Paginated list of all users with search and filtering
- **Update Users**: Modify user information (name, barangay, position)
- **Delete Users**: Remove users from the system (with confirmation)
- **Reset Passwords**: Change user passwords for account recovery

### 📊 **Dashboard Statistics**
- Total user count across all barangays
- Total and recent report statistics
- User distribution by barangay
- Real-time data updates

### 🔍 **Search & Filtering**
- Search users by name or user ID
- Filter by barangay and position
- Real-time search results
- Pagination for large user lists

## Screen Components

### Main Admin Screen
- **Header**: Title and stats access button
- **Search Bar**: Real-time user search
- **Filter Button**: Access to advanced filtering options
- **User List**: Scrollable list of users with actions
- **Add User FAB**: Floating action button to create new users

### User Management Actions
Each user in the list has quick action buttons:
- **🔑 Reset Password**: Change user's password
- **🗑️ Delete User**: Remove user (with confirmation)

### Add User Modal
Comprehensive form for creating new users:
- **User ID**: Unique identifier for login
- **Full Name**: User's complete name
- **Barangay**: Selection from all Silang barangays
- **Position**: Barangay Captain or Councilor
- **Password**: Secure password (minimum 6 characters)

### Statistics Modal
Real-time dashboard showing:
- Total users registered
- Total reports submitted
- Recent reports (last 30 days)
- User distribution by barangay

### Filter Modal
Advanced filtering options:
- Filter by specific barangay
- Filter by user position
- Clear all filters option

## API Endpoints

### User Management
- `GET /api/admin/users` - Get paginated user list with filters
- `POST /api/admin/users` - Create new user
- `PUT /api/admin/users/:id` - Update user information
- `DELETE /api/admin/users/:id` - Delete user
- `PUT /api/admin/users/:id/reset-password` - Reset user password

### Statistics & Data
- `GET /api/admin/stats` - Get dashboard statistics
- `GET /api/admin/barangays` - Get list of unique barangays

## User Interface

### Design Philosophy
- **Clean & Intuitive**: Easy-to-use interface for administrators
- **Mobile-First**: Optimized for React Native mobile experience
- **Responsive**: Works well on different screen sizes
- **Accessible**: Clear typography and touch targets

### Color Scheme
- **Primary Blue**: `#2563EB` for main actions
- **Success Green**: `#16A34A` for positive actions
- **Warning Red**: `#EF4444` for destructive actions
- **Gray Scale**: Various grays for text and backgrounds

### Components Used
- **ScaledText**: Responsive text sizing
- **AppModal**: Consistent modal design
- **TouchableOpacity**: Interactive elements
- **FlatList**: Efficient list rendering
- **ActivityIndicator**: Loading states

## Access Control

### Admin Detection
The system automatically detects admin users based on:
1. **Barangay Captain** position
2. **Designated admin** email (`admin@login.local`)

```typescript
const isAdmin = user?.barangay_position === 'Barangay Captain' || 
                user?.email === 'admin@login.local';
```

### Tab Visibility
The Admin tab only appears for users with admin privileges:
```typescript
{isAdmin && (
  <Tabs.Screen
    name="admin"
    options={{ title: 'Admin' }}
  />
)}
```

## Data Management

### User Creation Process
1. **Validation**: Check all required fields
2. **Auth Creation**: Create user in Supabase Auth system
3. **Profile Creation**: Add user to local users table
4. **Cleanup**: Remove auth user if profile creation fails

### Available Barangays
The system includes all 34 barangays of Silang, Cavite:
- Adlas, Balite I, Balite II, Biga I, Biga II
- Biluso, Bucal, Bubukal, Bulihan, Caracol
- Daranan, Kaybagal Central, Kaybagal South
- Lalaan I, Lalaan II, Latag, Litlit
- Malaking Aklat, Munting Aklat
- Pasong Kawayan I, Pasong Kawayan II
- Poblacion I, Poblacion II, Poblacion III
- Pooc I, Pooc II, Pulong Buhangin
- Pulong Tuntungin, Sabang, San Vicente
- Santol, Silangan, Tubigan, Ulat

### User Positions
- **Barangay Captain**: Full administrative access
- **Councilor**: Standard user access

## Security Features

### Authentication
- Bearer token authentication for API requests
- Token stored securely in AsyncStorage
- Automatic token retrieval for admin operations

### Authorization
- Role-based access control at API level
- Frontend visibility based on user permissions
- Secure password handling (minimum 6 characters)

### Data Protection
- Confirmation dialogs for destructive actions
- Input validation on all forms
- Error handling with user-friendly messages

## Usage Instructions

### For Administrators

#### Accessing Admin Panel
1. Sign in as a Barangay Captain or designated admin
2. The "Admin" tab will appear in the bottom navigation
3. Tap the Admin tab to access the management panel

#### Creating New Users
1. Tap the blue "+" floating action button
2. Fill in all required information:
   - Unique User ID for login
   - Full name of the user
   - Select appropriate barangay
   - Choose position (Captain or Councilor)
   - Set secure password
3. Tap "Create User" to complete registration

#### Managing Existing Users
1. Use the search bar to find specific users
2. Apply filters by barangay or position if needed
3. Tap action buttons next to users:
   - Key icon: Reset user's password
   - Trash icon: Delete user account

#### Viewing Statistics
1. Tap the stats chart icon in the header
2. View total users, reports, and distribution data
3. Use this information for administrative planning

#### Searching and Filtering
1. Type in the search bar for real-time results
2. Tap the filter icon for advanced options
3. Select specific barangay or position filters
4. Apply filters to narrow down user list

### Error Handling
The system provides clear feedback for:
- Network connection issues
- Validation errors in forms
- Authorization failures
- Successful operations

## Technical Implementation

### Frontend Architecture
- **React Native**: Mobile app framework
- **TypeScript**: Type-safe development
- **AsyncStorage**: Local data persistence
- **Expo Router**: Navigation management

### Backend Integration
- **Express.js**: RESTful API server
- **Supabase**: Database and authentication
- **CORS**: Cross-origin request handling
- **bcrypt**: Password hashing (if needed)

### State Management
- **React Hooks**: useState, useEffect, useCallback
- **Context API**: User authentication state
- **Local State**: Component-specific data

## Troubleshooting

### Common Issues

#### Admin Tab Not Showing
- **Cause**: User doesn't have admin privileges
- **Solution**: Ensure user is a Barangay Captain or contact system administrator

#### Unable to Create Users
- **Cause**: Authentication token expired or missing
- **Solution**: Sign out and sign back in

#### Search Not Working
- **Cause**: Network connectivity issues
- **Solution**: Check internet connection and try again

#### Password Reset Failed
- **Cause**: User ID not found or network error
- **Solution**: Verify user exists and check connection

### API Error Codes
- **401**: Unauthorized - Check authentication
- **400**: Bad Request - Validate input data
- **404**: Not Found - User doesn't exist
- **500**: Server Error - Contact technical support

## Future Enhancements

### Planned Features
1. **Bulk User Import**: CSV/Excel file import
2. **Advanced Role Management**: Custom permission levels
3. **User Activity Logs**: Track admin actions
4. **Email Notifications**: Account creation confirmations
5. **Profile Picture Management**: Upload and manage user photos
6. **Export Features**: Generate user reports
7. **Two-Factor Authentication**: Enhanced security

### Performance Optimizations
1. **Virtual Scrolling**: Better handling of large user lists
2. **Image Caching**: Optimized profile picture loading
3. **Offline Support**: Basic functionality without internet
4. **Push Notifications**: Real-time updates

## Getting Started

### Setup Requirements
1. Ensure backend API is running
2. Database tables are properly configured
3. Admin user account exists
4. All dependencies are installed

### First-Time Setup
1. Create an admin user account
2. Sign in with admin credentials
3. Verify Admin tab appears
4. Test creating a new user
5. Confirm all features work properly

The Admin User Management system provides powerful tools for managing the Silang Emergency Response app users while maintaining security and ease of use. For technical support or feature requests, please contact the development team.
