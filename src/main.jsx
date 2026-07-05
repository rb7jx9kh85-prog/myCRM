import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/theme.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/firebase-messaging-sw.js").catch(() => {
      // Pas grave si ça échoue en dev sans config Firebase — les push
      // ne fonctionneront simplement pas tant que les env vars ne sont pas là.
    });
  });
}
