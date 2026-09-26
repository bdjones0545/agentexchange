import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
const AccountPage = lazy(() => import("./routes/AccountPage").then(module => ({default: module.AccountPage})));
const ForAgentsPage = lazy(() => import("./routes/ForAgentsPage").then(module => ({default: module.ForAgentsPage})));
const AgentProfilePage = lazy(() => import("./routes/AgentProfilePage").then(module => ({default: module.AgentProfilePage})));
const AgentsPage = lazy(() => import("./routes/AgentsPage").then(module => ({default: module.AgentsPage})));
const ApplicationsPage = lazy(() => import("./routes/ApplicationsPage").then(module => ({default: module.ApplicationsPage})));
const ContractDetailPage = lazy(() => import("./routes/ContractDetailPage").then(module => ({default: module.ContractDetailPage})));
const ContractsPage = lazy(() => import("./routes/ContractsPage").then(module => ({default: module.ContractsPage})));
const CreateAgentPage = lazy(() => import("./routes/CreateAgentPage").then(module => ({default: module.CreateAgentPage})));
import { HomePage } from "./routes/HomePage";
const HubPage = lazy(() => import("./routes/HubPage").then(module => ({default: module.HubPage})));
const MarketplacePage = lazy(() => import("./routes/MarketplacePage").then(module => ({default: module.MarketplacePage})));
const OrganizationDashboardPage = lazy(() => import("./routes/OrganizationDashboardPage").then(module => ({default: module.OrganizationDashboardPage})));
const OrganizationProfilePage = lazy(() => import("./routes/OrganizationProfilePage").then(module => ({default: module.OrganizationProfilePage})));
const OrganizationsPage = lazy(() => import("./routes/OrganizationsPage").then(module => ({default: module.OrganizationsPage})));
const PostOpportunityPage = lazy(() => import("./routes/PostOpportunityPage").then(module => ({default: module.PostOpportunityPage})));
const SavedPage = lazy(() => import("./routes/SavedPage").then(module => ({default: module.SavedPage})));
const SettingsPage = lazy(() => import("./routes/SettingsPage").then(module => ({default: module.SettingsPage})));
const SignInPage = lazy(() => import("./routes/SignInPage").then(module => ({default: module.SignInPage})));
const SignUpPage = lazy(() => import("./routes/SignUpPage").then(module => ({default: module.SignUpPage})));
const WalletPage = lazy(() => import("./routes/WalletPage").then(module => ({default: module.WalletPage})));

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
        <Route element={<SignInPage />} path="sign-in" />
        <Route element={<SignUpPage />} path="sign-up" />
        <Route element={<AccountPage />} path="account" />
        <Route element={<ForAgentsPage />} path="for-agents" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Route>
    </Routes>
  );
}
