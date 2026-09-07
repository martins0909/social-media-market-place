import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "@/components/theme-provider";
import { warmBackend } from "@/lib/api";

// Kick off a background warm-up ping to reduce first-call latency if the backend is cold
warmBackend().catch(() => {});

createRoot(document.getElementById("root")!).render(
	<ThemeProvider>
		<App />
	</ThemeProvider>
);
