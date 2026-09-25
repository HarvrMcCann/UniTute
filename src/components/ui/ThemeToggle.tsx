"use client";

import { getTheme, setTheme } from "@/lib/theme";
import { IconButton } from "./IconButton";
import { MoonIcon, SunIcon } from "./icons";

export function ThemeToggle() {
  return (
    <IconButton
      label="Toggle light and dark theme"
      onClick={() => setTheme(getTheme() === "dark" ? "light" : "dark")}
    >
      {/* Icons swap via CSS so the server render never mismatches the saved theme */}
      <SunIcon className="light:hidden" />
      <MoonIcon className="hidden light:block" />
    </IconButton>
  );
}
