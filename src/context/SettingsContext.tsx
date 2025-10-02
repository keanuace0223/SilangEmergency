import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Dimensions, PixelRatio, ScaledSize } from 'react-native';

type SettingsContextType = {
  largeTextEnabled: boolean;
  textScale: number; // 1 = normal, 1.2 = larger, etc.
  toggleLargeText: () => Promise<void>;
  setLargeText: (enabled: boolean) => Promise<void>;
};

const DEFAULT_SCALE_NORMAL = 1;
const DEFAULT_SCALE_LARGE = 1.2; // modest bump for readability
const STORAGE_KEY = 'app_settings';

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [largeTextEnabled, setLargeTextEnabled] = useState<boolean>(false);
  const [textScale, setTextScale] = useState<number>(DEFAULT_SCALE_NORMAL);
  const [, setHydrated] = useState(false);

  const computeAdaptiveScale = useCallback((enabled: boolean, window: ScaledSize) => {
    // Base scale from user preference
    const base = enabled ? DEFAULT_SCALE_LARGE : DEFAULT_SCALE_NORMAL;
    // Respect device accessibility font scale (clamped to avoid over-inflation)
    const deviceFontScale = PixelRatio.getFontScale();
    const clampedDevice = Math.min(Math.max(deviceFontScale, 1), 1.4);
    // Slight nudge for very small screens to keep legibility
    const smallScreenBoost = window.width < 360 ? 1.06 : 1;
    return parseFloat((base * clampedDevice * smallScreenBoost).toFixed(3));
  }, []);

  const hydrate = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const enabled = Boolean(parsed.largeTextEnabled);
        setLargeTextEnabled(enabled);
        const window = Dimensions.get('window');
        setTextScale(computeAdaptiveScale(enabled, window));
      }
    } catch {}
    setHydrated(true);
  }, [computeAdaptiveScale]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const persist = useCallback(async (nextEnabled: boolean) => {
    const next = {
      largeTextEnabled: nextEnabled,
    };
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const setLargeText = useCallback(async (enabled: boolean) => {
    setLargeTextEnabled(enabled);
    const window = Dimensions.get('window');
    setTextScale(computeAdaptiveScale(enabled, window));
    await persist(enabled);
  }, [computeAdaptiveScale, persist]);

  const toggleLargeText = useCallback(async () => {
    await setLargeText(!largeTextEnabled);
  }, [largeTextEnabled, setLargeText]);

  const value = useMemo<SettingsContextType>(() => ({
    largeTextEnabled,
    textScale,
    toggleLargeText,
    setLargeText,
  }), [largeTextEnabled, textScale, toggleLargeText, setLargeText]);

  // Respond to orientation and window size changes
  useEffect(() => {
    const handler = ({ window }: { window: ScaledSize; screen: ScaledSize }) => {
      setTextScale(computeAdaptiveScale(largeTextEnabled, window));
    };
    const subscription = Dimensions.addEventListener('change', handler);
    return () => {
      // RN newer APIs return subscription with remove; older returns remove() on the listener
      // @ts-ignore
      if (typeof subscription?.remove === 'function') subscription.remove();
    };
  }, [computeAdaptiveScale, largeTextEnabled]);

  // Recompute on app foreground in case system font scale changed
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const window = Dimensions.get('window');
        setTextScale(computeAdaptiveScale(largeTextEnabled, window));
      }
    });
    return () => {
      // @ts-ignore
      if (typeof sub?.remove === 'function') sub.remove();
    };
  }, [computeAdaptiveScale, largeTextEnabled]);

  // Render children even before hydration to avoid layout shift; initial defaults are fine
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
};


