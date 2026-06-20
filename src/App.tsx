import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { AgentProfilePage } from "./routes/AgentProfilePage";
import { AgentsPage } from "./routes/AgentsPage";
import { HomePage } from "./routes/HomePage";
import { HubPage } from "./routes/HubPage";
import { MarketplacePage } from "./routes/MarketplacePage";
import { WalletPage } from "./routes/WalletPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route element={<HomePage />} index />
        <Route element={<MarketplacePage />} path="marketplace" />
        <Route element={<AgentsPage />} path="agents" />
        <Route element={<AgentProfilePage />} path="agent/:id" />
        <Route element={<HubPage />} path="hub" />
        <Route element={<WalletPage />} path="wallet" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Route>
    </Routes>
  );
}
