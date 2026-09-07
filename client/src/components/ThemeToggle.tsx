import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const isDark = theme === "dark";
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="rounded-full border-2 border-white/60 backdrop-blur bg-white/70 dark:bg-[#09090b] dark:border-gray-700 hover:bg-gradient-to-r hover:from-[#e8f1ff] hover:to-[#e8f1ff] dark:hover:from-gray-700 dark:hover:to-gray-800 transition-all"
    >
      {isDark ? <Sun className="h-5 w-5 text-yellow-400" /> : <Moon className="h-5 w-5 text-[#1565C0]" />}
    </Button>
  );
}
