export const THEME_PREFERENCES = ['light', 'dark', 'system'];

export const isThemePreference = (value) => THEME_PREFERENCES.includes(value);

export const resolveTheme = (preference, systemPrefersDark) => {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return systemPrefersDark ? 'dark' : 'light';
};

export const readThemePreference = (storage) => {
  try {
    const preference = storage.getItem('eventflow_theme');
    return isThemePreference(preference) ? preference : 'system';
  } catch (error) {
    console.warn('[Theme Storage Warning] Could not read theme preference:', error);
    return 'system';
  }
};

export const writeThemePreference = (storage, preference) => {
  if (!isThemePreference(preference)) {
    throw new TypeError('Theme preference must be light, dark, or system.');
  }

  try {
    storage.setItem('eventflow_theme', preference);
  } catch (error) {
    console.warn('[Theme Storage Warning] Could not persist theme preference:', error);
  }
};
