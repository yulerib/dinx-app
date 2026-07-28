import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

type Theme = 'dark' | 'light';
export type IconLibrary = 'lucide' | 'material';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  iconLibrary: IconLibrary;
  setIconLibrary: (lib: IconLibrary) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('casa_financeira_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    return prefersLight ? 'light' : 'dark';
  });

  const [iconLibrary, setIconLibraryState] = useState<IconLibrary>(() => {
    const saved = localStorage.getItem('casa_financeira_icon_library');
    if (saved === 'lucide' || saved === 'material') return saved;
    return 'material'; // Padrão M3
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('casa_financeira_theme', newTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const setIconLibrary = (lib: IconLibrary) => {
    setIconLibraryState(lib);
    localStorage.setItem('casa_financeira_icon_library', lib);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, iconLibrary, setIconLibrary }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

