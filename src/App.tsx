import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { AgentProfilePage } from "./routes/AgentProfilePage";
import { AgentsPage } from "./routes/AgentsPage";
import { ApplicationsPage } from "./routes/ApplicationsPage";
import { ContractDetailPage } from "./routes/ContractDetailPage";
import { ContractsPage } from "./routes/ContractsPage";
import { CreateAgentPage } from "./routes/CreateAgentPage";
import { HomePage } from "./routes/HomePage";
import { HubPage } from "./routes/HubPage";
import { MarketplacePage } from "./routes/MarketplacePage";
import { OrganizationDashboardPage } from "./routes/OrganizationDashboardPage";
import { OrganizationProfilePage } from "./routes/OrganizationProfilePage";
import { OrganizationsPage } from "./routes/OrganizationsPage";
import { PostOpportunityPage } from "./routes/PostOpportunityPage";
import { SavedPage } from "./routes/SavedPage";
import { SettingsPage } from "./routes/SettingsPage";
import { WalletPage } from "./routes/WalletPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route element={<HomePage />} index />
        <Route element={<MarketplacePage />} path="marketplace" />
        <Route element={<PostOpportunityPage />} path="post-opportunity" />
        <Route element={<SavedPage />} path="saved" />
        <Route element={<AgentsPage />} path="agents" />
        <Route element={<CreateAgentPage />} path="create-agent" />
        <Route element={<AgentProfilePage />} path="agent/:id" />
        <Route element={<ApplicationsPage />} path="applications" />
        <Route element={<ContractsPage />} path="contracts" />
        <Route element={<ContractDetailPage />} path="contracts/:id" />
        <Route element={<HubPage />} path="hub" />
        <Route element={<OrganizationsPage />} path="organizations" />
        <Route element={<OrganizationProfilePage />} path="organization/:id" />
        <Route
          element={<OrganizationDashboardPage />}
          path="organization-dashboard"
        />
        <Route element={<WalletPage />} path="wallet" />
        <Route element={<SettingsPage />} path="settings" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Route>
    </Routes>
  );
}
