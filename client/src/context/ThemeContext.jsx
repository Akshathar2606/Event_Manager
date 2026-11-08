import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  isThemePreference,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
} from '../utils/theme';

const ThemeContext = createContext(null);
const THEME_STORAGE_KEY = 'eventflow_theme';

const getSystemPreference = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(() => {
    if (typeof window === 'undefined') return 'system';
    return readThemePreference(window.localStorage);
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemPreference);
  const resolvedTheme = resolveTheme(preference, systemPrefersDark);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => setSystemPrefersDark(event.matches);

    setSystemPrefersDark(mediaQuery.matches);
    mediaQuery.addEventListener?.('change', handleChange);
    if (!mediaQuery.addEventListener) mediaQuery.addListener(handleChange);

    return () => {
      mediaQuery.removeEventListener?.('change', handleChange);
      if (!mediaQuery.removeEventListener) mediaQuery.removeListener(handleChange);
    };
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === THEME_STORAGE_KEY) {
        setPreference(isThemePreference(event.newValue) ? event.newValue : 'system');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
    root.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);

  const setThemePreference = useCallback((nextPreference) => {
    if (!isThemePreference(nextPreference)) {
      throw new TypeError('Theme preference must be light, dark, or system.');
    }
    writeThemePreference(window.localStorage, nextPreference);
    setPreference(nextPreference);
  }, []);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setThemePreference }),
    [preference, resolvedTheme, setThemePreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
