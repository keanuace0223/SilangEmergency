import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Dimensions, LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';

type SlideToResolveProps = {
  onResolve: () => void | Promise<void>;
  isResolving?: boolean;
};

const THUMB_SIZE = 50;
const THRESHOLD_RATIO = 0.7;
const SCREEN_WIDTH = Dimensions.get('window').width;

const SlideToResolve: React.FC<SlideToResolveProps> = ({ onResolve, isResolving = false }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  // Start with a sensible default distance so the thumb can move
  const maxTranslateRef = useRef(Math.max(SCREEN_WIDTH * 0.6 - THUMB_SIZE - 8, 0));

  const resetThumb = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: false,
      friction: 6,
      tension: 60,
    }).start();
  };

  const completeThumb = () => {
    const maxTranslate = maxTranslateRef.current || 0;
    Animated.spring(translateX, {
      toValue: maxTranslate,
      useNativeDriver: false,
      friction: 6,
      tension: 60,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isResolving,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (isResolving) return false;
        return Math.abs(gestureState.dx) > 2;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        if (isResolving) return false;
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderGrant: () => {
        // Stop any ongoing spring so the thumb immediately follows the finger
        translateX.stopAnimation();
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gestureState) => {
        if (isResolving) return;
        const max = maxTranslateRef.current || 0;
        const rawDx = gestureState.dx;
        const clamped = Math.max(0, Math.min(rawDx, max));
        translateX.setValue(clamped);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isResolving) return;
        const maxTranslate = maxTranslateRef.current || 0;
        const dx = Math.max(0, Math.min(gestureState.dx, maxTranslate));
        const shouldResolve = maxTranslate > 0 && dx >= maxTranslate * THRESHOLD_RATIO;

        if (shouldResolve) {
          completeThumb();
          onResolve && onResolve();
        } else {
          resetThumb();
        }
      },
      onPanResponderTerminate: () => {
        if (isResolving) return;
        resetThumb();
      },
    })
  ).current;

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width && width > 0) {
      maxTranslateRef.current = Math.max(width - THUMB_SIZE - 8, 0);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.track} onLayout={handleTrackLayout} {...panResponder.panHandlers}>
        <Text style={styles.label}>Slide to Resolve</Text>
        <Animated.View
          style={[
            styles.thumb,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          {isResolving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Ionicons name="chevron-forward" size={24} color="#ffffff" />
          )}
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    width: '100%',
  },
  track: {
    height: 55,
    borderRadius: 55,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    paddingHorizontal: 4,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  label: {
    position: 'absolute',
    alignSelf: 'center',
    color: '#9ca3af',
    fontWeight: 'bold',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
});

export default SlideToResolve;
