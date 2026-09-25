export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "unitute-theme";

/** Runs in <head> before paint so the saved theme never flashes. Dark is the default. */
export const THEME_BOOTSTRAP_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

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
