// ./shared/sentry is deliberately the first import: it initializes Sentry (an import
// side-effect), so it must run before App.tsx and everything it pulls in.
import "./shared/sentry";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
