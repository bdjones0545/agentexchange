import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import "./index.css";
import { AgentExchangeProvider } from "./state/AgentExchangeContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AgentExchangeProvider>
        <App />
      </AgentExchangeProvider>
    </BrowserRouter>
  </StrictMode>,
);
