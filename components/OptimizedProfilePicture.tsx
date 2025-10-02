import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

interface OptimizedProfilePictureProps {
  uri?: string | null;
  size?: number;
  className?: string;
  style?: any;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  fallbackIconSize?: number;
  fallbackIconColor?: string;
}

const OptimizedProfilePicture: React.FC<OptimizedProfilePictureProps> = ({
  uri,
  size = 112, // 28 * 4 (w-28 h-28)
  className = "",
  style,
  fallbackIcon = "person",
  fallbackIconSize = 40,
  fallbackIconColor = "#4A90E2"
}) => {
  const [isLoading, setIsLoading] = useState(!!uri);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (uri) {
      setIsLoading(true);
      setHasError(false);
    } else {
      setIsLoading(false);
      setHasError(false);
    }
  }, [uri]);

  const handleLoadStart = () => {
    setIsLoading(true);
    setHasError(false);
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <View 
      className={`rounded-full overflow-hidden bg-white shadow-lg ${className}`}
      style={[{ width: size, height: size }, style]}
    >
      {uri && !hasError ? (
        <>
          <Image
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            onLoadStart={handleLoadStart}
            onLoadEnd={handleLoadEnd}
            onError={handleError}
            cachePolicy="memory-disk" // Enable caching
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }} // Generic blurhash
            transition={200} // Smooth transition
          />
          {isLoading && (
            <View 
              className="absolute inset-0 items-center justify-center bg-gray-100"
              style={{ backgroundColor: 'rgba(243, 244, 246, 0.8)' }}
            >
              <ActivityIndicator size="small" color="#4A90E2" />
            </View>
          )}
        </>
      ) : (
        <View className="flex-1 items-center justify-center">
          <Ionicons name={fallbackIcon} size={fallbackIconSize} color={fallbackIconColor} />
        </View>
      )}
    </View>
  );
};

export default OptimizedProfilePicture;
