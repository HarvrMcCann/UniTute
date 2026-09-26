"use client";

import { saveTheme } from "@/app/actions";
import { getTheme, setTheme } from "@/lib/theme";
import { IconButton } from "./IconButton";
import { MoonIcon, SunIcon } from "./icons";

export function ThemeToggle() {
  return (
    <IconButton
      label="Toggle light and dark theme"
      onClick={() => {
        const next = getTheme() === "dark" ? "light" : "dark";
        setTheme(next);
        void saveTheme(next); // remembered on the profile when signed in
      }}
    >
      {/* Icons swap via CSS so the server render never mismatches the saved theme */}
      <SunIcon className="light:hidden" />
      <MoonIcon className="hidden light:block" />
    </IconButton>
  );
}
