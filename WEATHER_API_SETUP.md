# Weather API Setup Instructions

## OpenWeatherMap API Setup

To enable real weather data in the reports screen, you need to:

### 1. Get a Free API Key
1. Go to [OpenWeatherMap](https://openweathermap.org/api)
2. Sign up for a free account
3. Navigate to "API Keys" in your dashboard
4. Copy your API key

### 2. Update the API Key
In `app/(tabs)/reports.tsx`, replace `YOUR_OPENWEATHER_API_KEY` with your actual API key:

```javascript
const API_KEY = 'your_actual_api_key_here'
```

### 3. Features
- **Real-time weather data** for Silang, Cavite
- **Dynamic weather icons** based on current conditions
- **Temperature in Celsius**
- **Weather conditions** (sunny, cloudy, rainy, etc.)
- **Fallback data** if API is unavailable
- **Loading states** with refresh icon
- **Auto-refresh** when pulling down on reports list

### 4. API Endpoint
The app uses: `https://api.openweathermap.org/data/2.5/weather?q=Silang,Cavite,PH&appid=${API_KEY}&units=metric`

### 5. Weather Icons Mapping
The app maps OpenWeatherMap icon codes to Ionicons:
- `01d/01n` → sunny/moon
- `02d/02n` → partly-sunny/cloudy-night
- `03d/03n` → cloudy
- `09d/09n` → rainy
- `10d/10n` → rainy
- `11d/11n` → thunderstorm
- `13d/13n` → snow
- `50d/50n` → cloudy

### 6. Fallback Behavior
If the API fails or is unavailable, the widget shows:
- Temperature: 28°C
- Condition: Partly Cloudy
- Icon: partly-sunny
- Location: Silang, Cavite

This ensures the app remains functional even without internet connectivity.

