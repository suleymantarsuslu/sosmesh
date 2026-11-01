'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  operatorNavLabels,
  translate,
  type OperatorLocale,
} from '../../lib/i18n/operator-messages';

export type SavedView = {
  id: string;
  name: string;
  href: string;
};

type OperatorPreferencesContextValue = {
  locale: OperatorLocale;
  setLocale: (locale: OperatorLocale) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  t: (key: string) => string;
  nav: ReturnType<typeof operatorNavLabels>;
  savedViews: SavedView[];
  saveCurrentView: (name: string, href: string) => void;
  removeSavedView: (id: string) => void;
  activeIncidentId: string | null;
  setActiveIncidentId: (id: string | null) => void;
};

const OperatorPreferencesContext = createContext<OperatorPreferencesContextValue | null>(
  null
);

const STORAGE_KEY = 'sosmesh-operator-preferences-v1';

type StoredPreferences = {
  locale?: OperatorLocale;
  theme?: 'light' | 'dark';
  savedViews?: SavedView[];
  activeIncidentId?: string | null;
};

function readStored(): StoredPreferences {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as StoredPreferences;
  } catch {
    return {};
  }
}

export function OperatorPreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<OperatorLocale>('tr');
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStored();
    if (stored.locale) {
      setLocaleState(stored.locale);
    }
    if (stored.theme) {
      setThemeState(stored.theme);
    }
    if (stored.savedViews) {
      setSavedViews(stored.savedViews);
    }
    if (stored.activeIncidentId) {
      setActiveIncidentId(stored.activeIncidentId);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ locale, theme, savedViews, activeIncidentId })
    );
  }, [locale, theme, savedViews, activeIncidentId]);

  const setLocale = useCallback((next: OperatorLocale) => {
    setLocaleState(next);
  }, []);

  const setTheme = useCallback((next: 'light' | 'dark') => {
    setThemeState(next);
  }, []);

  const saveCurrentView = useCallback((name: string, href: string) => {
    setSavedViews((prev) => {
      const id = `${Date.now()}`;
      return [{ id, name, href }, ...prev].slice(0, 8);
    });
  }, []);

  const removeSavedView = useCallback((id: string) => {
    setSavedViews((prev) => prev.filter((view) => view.id !== id));
  }, []);

  const value = useMemo<OperatorPreferencesContextValue>(
    () => ({
      locale,
      setLocale,
      theme,
      setTheme,
      t: (key) => translate(locale, key),
      nav: operatorNavLabels(locale),
      savedViews,
      saveCurrentView,
      removeSavedView,
      activeIncidentId,
      setActiveIncidentId,
    }),
    [
      locale,
      setLocale,
      theme,
      setTheme,
      savedViews,
      saveCurrentView,
      removeSavedView,
      activeIncidentId,
    ]
  );

  return (
    <OperatorPreferencesContext.Provider value={value}>
      {children}
    </OperatorPreferencesContext.Provider>
  );
}

export function useOperatorPreferences(): OperatorPreferencesContextValue {
  const ctx = useContext(OperatorPreferencesContext);
  if (!ctx) {
    throw new Error('useOperatorPreferences must be used within OperatorPreferencesProvider');
  }
  return ctx;
}
