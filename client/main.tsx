import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Be Vietnam Pro kept as fallback for rare Vietnamese glyphs (OFL 1.1).
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/700.css";
import { App } from "./App";
import { applyStoredTextScale } from "./lib/textScale";
import { registerWebMcpTools } from "./lib/webmcp";
import "./styles/index.css";

applyStoredTextScale();

// WebMCP: register browser tools as early as possible for agent scanners.
registerWebMcpTools();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* optional */
    });
  });
}
