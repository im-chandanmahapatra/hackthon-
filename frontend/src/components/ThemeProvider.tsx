import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'dark' | 'light';
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
  resolvedTheme: 'light',
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function getResolvedTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'argus-ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>(
    () => getResolvedTheme((localStorage.getItem(storageKey) as Theme) || defaultTheme)
  );

  useEffect(() => {
    const root = window.document.documentElement;
    const resolved = getResolvedTheme(theme);

    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
    setResolvedTheme(resolved);
  }, [theme]);

  /**
   * Smooth theme morph — adds a transition class to the document root
   * so all CSS custom property consumers animate between values.
   */
  const setTheme = useCallback((newTheme: Theme) => {
    const root = window.document.documentElement;
    
    // Add morphing class for smooth transition
    root.classList.add('theme-transitioning');
    
    // Update theme
    localStorage.setItem(storageKey, newTheme);
    setThemeState(newTheme);

    // Remove transition class after animation completes
    const cleanup = setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 700);

    return () => clearTimeout(cleanup);
  }, [storageKey]);

  const value = {
    theme,
    setTheme,
    resolvedTheme,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
