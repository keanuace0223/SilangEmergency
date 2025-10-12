/**
 * Image optimization utilities for faster image loading and upload
 */
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

interface OptimizedImage {
  uri: string;
  width: number;
  height: number;
  size: number;
}

/**
 * Compress image to under specified size with quality optimization
 * @param uri - Image URI to compress
 * @param maxSizeKB - Maximum size in KB (default: 800KB for reports)
 * @returns Compressed image URI
 */
export async function compressImage(uri: string, maxSizeKB: number = 800): Promise<string> {
  try {
    // Get original file info
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) return uri;

    const originalSize = ('size' in fileInfo) ? (fileInfo.size || 0) : 0;
    const targetSize = maxSizeKB * 1024;

    // If already small enough, return original
    if (originalSize > 0 && originalSize <= targetSize) {
      return uri;
    }

    // Calculate compression ratio
    const compressionRatio = originalSize > 0 ? Math.sqrt(targetSize / originalSize) : 0.7;
    let quality = Math.min(0.9, Math.max(0.3, compressionRatio));

    // Try compression with adaptive quality
    let compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1920 } }], // Max width 1920px for good quality
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    // Check if we need further compression
    const compressedInfo = await FileSystem.getInfoAsync(compressed.uri);
    const compressedSize = ('size' in compressedInfo) ? (compressedInfo.size || 0) : 0;

    // If still too large, reduce quality further
    if (compressedSize > targetSize && quality > 0.3) {
      quality = Math.max(0.3, quality * 0.7);
      compressed = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1600 } }], // Reduce max width
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
    }

    return compressed.uri;
  } catch (error) {
    console.error('Error compressing image:', error);
    return uri; // Return original on error
  }
}

/**
 * Create thumbnail for fast display
 * @param uri - Image URI
 * @param size - Thumbnail size (default: 200px)
 * @returns Thumbnail URI
 */
export async function createThumbnail(uri: string, size: number = 200): Promise<string> {
  try {
    const thumbnail = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: size } }],
      {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    return thumbnail.uri;
  } catch (error) {
    console.error('Error creating thumbnail:', error);
    return uri;
  }
}

/**
 * Optimize multiple images for reports
 * @param uris - Array of image URIs
 * @param onProgress - Progress callback (current, total)
 * @returns Array of optimized image URIs
 */
export async function optimizeMultipleImages(
  uris: string[],
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const optimized: string[] = [];
  
  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i];
    if (onProgress) onProgress(i + 1, uris.length);
    
    try {
      const compressed = await compressImage(uri, 800); // 800KB max per image
      optimized.push(compressed);
    } catch (error) {
      console.error(`Error optimizing image ${i + 1}:`, error);
      optimized.push(uri); // Use original on error
    }
  }
  
  return optimized;
}

/**
 * Get optimized image info
 * @param uri - Image URI
 * @returns Image dimensions and size
 */
export async function getImageInfo(uri: string): Promise<OptimizedImage | null> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) return null;

    // Get dimensions (expo-image-manipulator provides this)
    const result = await ImageManipulator.manipulateAsync(uri, []);
    
    const size = ('size' in fileInfo) ? (fileInfo.size || 0) : 0;
    
    return {
      uri,
      width: result.width,
      height: result.height,
      size,
    };
  } catch (error) {
    console.error('Error getting image info:', error);
    return null;
  }
}

