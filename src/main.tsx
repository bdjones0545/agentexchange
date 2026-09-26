import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import "./index.css";
import { AuthProvider } from "./state/AuthContext";
import { AgentExchangeProvider } from "./state/AgentExchangeContext";

const snapshot = document.getElementById("ax-public-state");
const initialState = snapshot?.textContent ? JSON.parse(snapshot.textContent) : undefined;
const app = (
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AgentExchangeProvider initialState={initialState}>
          <App />
        </AgentExchangeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);

const root=document.getElementById("root")!;
if(snapshot) hydrateRoot(root,app); else createRoot(root).render(app);
