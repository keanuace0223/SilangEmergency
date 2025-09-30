import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface DarkModeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => Promise<void>;
  isLoading: boolean;
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined);

export const DarkModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialized = useRef(false);
  const darkModeRef = useRef(false);

  const loadThemePreference = useCallback(async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('darkMode');
      if (savedTheme !== null) {
        const theme = JSON.parse(savedTheme);
        setIsDarkMode(theme);
        darkModeRef.current = theme;
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    } finally {
      setIsLoading(false);
      isInitialized.current = true;
    }
  }, []);

  useEffect(() => {
    loadThemePreference();
  }, [loadThemePreference]);

  const toggleDarkMode = useCallback(async () => {
    if (!isInitialized.current) return;
    
    try {
      const newTheme = !darkModeRef.current;
      darkModeRef.current = newTheme;
      
      // Use a more stable update approach with multiple frames
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsDarkMode(newTheme);
            resolve(undefined);
          });
        });
      });
      
      await AsyncStorage.setItem('darkMode', JSON.stringify(newTheme));
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  }, []);

  return (
    <DarkModeContext.Provider value={{ isDarkMode, toggleDarkMode, isLoading }}>
      {children}
    </DarkModeContext.Provider>
  );
};

export const useDarkMode = () => {
  const context = useContext(DarkModeContext);
  if (context === undefined) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
};
