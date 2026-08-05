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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

function afterFirstPaint(fn: () => void): void {
  const ric = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (typeof ric === "function") {
    ric(() => fn(), { timeout: 2500 });
    return;
  }
  window.setTimeout(fn, 1);
}

// Defer WebMCP so agent tooling does not compete with first paint / LCP.
afterFirstPaint(() => {
  registerWebMcpTools();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* optional */
    });
  });
}
