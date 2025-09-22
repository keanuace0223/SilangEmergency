# AI Agent Instructions for Silang Emergency App

## Project Overview
This is an Expo-based React Native application for emergency services in Silang. The app uses:
- Expo Router for file-based routing
- NativeWind (Tailwind CSS) for styling
- React Native with TypeScript
- Expo SDK features for native functionality

## Architecture

### Navigation Structure
The app uses a nested navigation structure with Expo Router:
- `app/_layout.tsx`: Root layout with stack navigation
- `app/(auth)`: Authentication-related screens
- `app/(tabs)`: Main tab-based navigation
- `app/Reports/[id].tsx`: Dynamic report details pages

### Key Components
- `components/CustomButtons.tsx`: Reusable button components
- `components/CustomInputs.tsx`: Reusable input components
- Navigation structure defined in `app/(tabs)/_layout.tsx` for bottom tabs

## Development Workflow

### Setup
1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npx expo start
```

### File Organization
- Place screens in appropriate route directories under `app/`
- Keep reusable components in `components/`
- Assets go in `assets/images/`
- Constants and configuration in `constants/`

### Navigation Patterns
- Use `expo-router` APIs for navigation
- File-based routing determines screen paths
- Nested navigation handled through directory structure

## Styling Conventions
- Use NativeWind (Tailwind CSS) for styling
- Define styles inline using className prop
- Example: `className="flex-1 bg-white p-4"`

## Common Patterns
- Use `CustomButtons` and `CustomInputs` components for consistent UI
- Navigation bar styling is set in root layout (`app/_layout.tsx`)
- Screen layouts should include safe area insets

## Key Integration Points
- Authentication flow in `app/(auth)` directory
- Report management through `app/Reports/[id].tsx`
- Profile management in `app/(tabs)/profile.tsx`

## Debugging Tips
- Use Expo development client for testing
- Check Expo logs for build/runtime errors
- Test on both iOS and Android simulators

## Important Notes
- Keep native dependencies in sync with Expo SDK version
- Follow TypeScript type definitions
- Handle platform-specific differences using React Native Platform API