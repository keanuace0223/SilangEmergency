# Silang Emergency App 🚨

A comprehensive emergency reporting and management system for Silang Disaster Risk Reduction and Management Office (DRRMO). Built with React Native (Expo), Node.js, and Supabase.

## Features

- 📱 **Emergency Reporting**: Real-time incident reporting with location tracking
- 👥 **User Management**: Secure authentication with Supabase
- 🗺️ **Location Services**: Interactive map for incident location selection
- 📊 **Admin Dashboard**: Comprehensive management interface for DRRMO staff
- 🔐 **Security**: Row Level Security (RLS) policies and secure session management
- 📈 **Scalable Architecture**: Optimized for high performance and scalability

## Tech Stack

### Frontend
- **React Native** with Expo
- **TypeScript** for type safety
- **NativeWind** (TailwindCSS) for styling
- **Expo Router** for navigation

### Backend
- **Supabase** for database and authentication
- **PostgreSQL** with optimized indexes

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Expo CLI
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd SilangEmergency
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Dependencies are installed with step 2**

4. **Set up environment variables**
   
   Create a `.env` file in the project root (if needed):
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   JWT_SECRET=your_jwt_secret
   PORT=4001
   HOST=0.0.0.0
   ```

5. **Set up Expo environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

6. **Run database migrations**
   ```bash
   # Execute sql_migrations.sql in your Supabase SQL Editor
   ```

### Running the App

1. **Start the Expo development server**
   ```bash
   npx expo start
   ```

2. **Open the app**
   - Press `a` for Android emulator
   - Press `i` for iOS simulator
   - Scan QR code with Expo Go app for physical device

## Project Structure

```
SilangEmergency/
├── app/                      # Frontend screens
│   ├── (admin)/             # Admin dashboard screens
│   ├── (auth)/              # Authentication screens
│   └── (tabs)/              # Main app tabs
├── components/              # Reusable React components
├── src/                     # Core application logic
│   ├── api/                 # API client
│   ├── context/             # React context providers
│   ├── lib/                 # Supabase client
│   └── utils/               # Utility functions
└── constants/               # App constants

```

## Recent Optimizations ⚡

The app has been optimized for scalability and performance:

- ✅ **Backend optimizations**: Shared validation utilities, pagination limits, error handling
- ✅ **Frontend optimizations**: Removed dead code, optimized context providers
- ✅ **Database optimizations**: Strategic indexes for common query patterns
- ✅ **Code cleanup**: Removed legacy code and unnecessary files
- ✅ **Security improvements**: Input validation, size limits, RLS policies

See [OPTIMIZATION_SUMMARY.md](./OPTIMIZATION_SUMMARY.md) for detailed information.

## API Endpoints

### Authentication
- `POST /api/supabase-auth/signin` - User login
- `POST /api/supabase-auth/signup` - User registration
- `POST /api/supabase-auth/signout` - User logout

### Reports
- `GET /api/reports` - Get user's reports
- `POST /api/reports` - Create new report
- `PUT /api/reports/:id` - Update report

### Users
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user profile

### Admin
- `GET /api/admin/users` - Get all users (paginated)
- `POST /api/admin/users` - Create new user
- `GET /api/admin/reports` - Get all reports (paginated)
- `GET /api/admin/stats` - Get dashboard statistics

### Health Check
- `GET /health` - Server health status

## Performance

- **Pagination**: Max 100 items per page
- **Caching**: Avatar URLs cached for 23 hours
- **Indexes**: Optimized database queries
- **Request Limits**: 10MB body size limit

## Documentation

- [Admin User Management](./docs/ADMIN_USER_MANAGEMENT.md)
- [Multi-Device Login Prevention](./docs/MULTI_DEVICE_LOGIN_PREVENTION.md)
- [Optimization Summary](./OPTIMIZATION_SUMMARY.md)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For questions or issues, please contact the Silang DRRMO development team.
