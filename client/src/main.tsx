// ./shared/sentry is deliberately the first import: it initializes Sentry (an import
// side-effect), so it must run before App.tsx and everything it pulls in. ./i18n is next for the
// same reason — it must set the active language (and read the persisted preference) before any
// component that calls useTranslation() renders, or the first paint would flash in the wrong
// language.
import "./shared/sentry";
import "./i18n";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
