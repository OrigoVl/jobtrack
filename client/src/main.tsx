// ./shared/sentry is deliberately the first import: it initializes Sentry (an import
// side-effect), so it must run before App.tsx and everything it pulls in. ./i18n and
// ./shared/theme are next for the same reason — they must set the active language/theme
// (reading their persisted preference) before any component renders, or the first paint would
// flash in the wrong language/theme.
import "./shared/sentry";
import "./i18n";
import "./shared/theme";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
