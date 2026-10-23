import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initDatabase } from "./database";

// Initialize the SQLite database before mounting the UI.
// The tasks table is created via the Rust migration if it doesn't exist.
initDatabase()
  .catch((err) => {
    console.error("[main] Database initialization failed:", err);
  })
  .finally(() => {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
