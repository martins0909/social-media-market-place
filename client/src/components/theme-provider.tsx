import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem>
      {children}
    </NextThemesProvider>
  );
}

export { useTheme };
