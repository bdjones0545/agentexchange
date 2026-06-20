import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { AgentProfilePage } from "./routes/AgentProfilePage";
import { AgentsPage } from "./routes/AgentsPage";
import { ApplicationsPage } from "./routes/ApplicationsPage";
import { ContractsPage } from "./routes/ContractsPage";
import { HomePage } from "./routes/HomePage";
import { HubPage } from "./routes/HubPage";
import { MarketplacePage } from "./routes/MarketplacePage";
import { SavedPage } from "./routes/SavedPage";
import { SettingsPage } from "./routes/SettingsPage";
import { WalletPage } from "./routes/WalletPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route element={<HomePage />} index />
        <Route element={<MarketplacePage />} path="marketplace" />
        <Route element={<SavedPage />} path="saved" />
        <Route element={<AgentsPage />} path="agents" />
        <Route element={<AgentProfilePage />} path="agent/:id" />
        <Route element={<ApplicationsPage />} path="applications" />
        <Route element={<ContractsPage />} path="contracts" />
        <Route element={<HubPage />} path="hub" />
        <Route element={<WalletPage />} path="wallet" />
        <Route element={<SettingsPage />} path="settings" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Route>
    </Routes>
  );
}
