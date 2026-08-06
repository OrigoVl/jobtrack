import { Segmented } from "./ui";
import { useTheme } from "./theme";
import { MoonIcon, SunIcon } from "./icons";

/** Switches `data-theme` on `<html>` (see shared/theme.ts) — every color utility across the app
 * already resolves through the CSS custom properties keyed off that attribute, so nothing else
 * needs to re-render when it changes. Icon labels carry a visually-hidden text alternative
 * (`sr-only`) since Segmented's own buttons have no other accessible name here. */
export function ThemeSwitcher({ size = "sm" }: { size?: "sm" | "md" }) {
  const [theme, setTheme] = useTheme();
  return (
    <Segmented
      size={size}
      value={theme}
      onChange={setTheme}
      options={[
        {
          value: "light",
          label: (
            <span className="flex items-center">
              <SunIcon className="w-4 h-4" />
              <span className="sr-only"> Light</span>
            </span>
          ),
        },
        {
          value: "dark",
          label: (
            <span className="flex items-center">
              <MoonIcon className="w-4 h-4" />
              <span className="sr-only"> Dark</span>
            </span>
          ),
        },
      ]}
    />
  );
}
