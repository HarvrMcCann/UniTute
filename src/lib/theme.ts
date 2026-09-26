export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "unitute-theme";

/**
 * Runs in <head> before paint so the theme never flashes. Dark is the default.
 * A signed-in user's saved theme (from their profile) wins over this browser's.
 */
export function themeBootstrapScript(profileTheme: Theme | null): string {
  const saved = profileTheme ? JSON.stringify(profileTheme) : "null";
  return `try{var s=${saved},k="${THEME_STORAGE_KEY}";if(s)localStorage.setItem(k,s);var t=s||localStorage.getItem(k);if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
}

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // storage unavailable (private mode): theme still applies for this visit
  }
}
