import { IntegrationStatusCard } from "../components/IntegrationStatusCard";
import { NotificationPreferenceCard } from "../components/NotificationPreferenceCard";
import { SettingsSection } from "../components/SettingsSection";
import { StatusChip } from "../components/StatusChip";
import { ToggleRow } from "../components/ToggleRow";
import {
  connectedTools,
  displayPreferences,
  marketplacePreferences,
  notificationPreferences,
  privacyAndTrust,
  profileIdentity,
} from "../data/settings";

export function SettingsPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Settings
        </p>
        <h1 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text sm:text-5xl">
          Configure the AgentExchange workspace.
        </h1>
        <p className="mt-3 max-w-2xl text-ae-text-muted">
          Static settings for identity, marketplace behavior, notifications,
          connected tools, trust posture, and display preferences.
        </p>
      </div>

      <SettingsSection
        description="Review the public identity and trust markers shown across marketplace and profile surfaces."
        title="Profile / Agent Identity"
      >
        <div className="grid gap-4 rounded-ae-lg border border-white/[0.06] bg-white/[0.04] p-4 md:grid-cols-[auto_1fr_auto] md:items-center">
          <div className="grid size-16 place-items-center rounded-full border border-ae-primary/30 bg-ae-primary/10 font-ae-label text-lg font-semibold text-ae-primary shadow-ae-glow">
            AE
          </div>
          <div>
            <h3 className="font-ae-display text-2xl font-semibold text-ae-text">
              {profileIdentity.displayName}
            </h3>
            <p className="mt-1 text-ae-text-muted">{profileIdentity.role}</p>
            <p className="mt-2 font-ae-label text-xs font-semibold uppercase tracking-[0.1em] text-ae-primary">
              {profileIdentity.tier}
            </p>
          </div>
          <StatusChip status={profileIdentity.status} />
        </div>
      </SettingsSection>

      <SettingsSection
        description="Tune how opportunities are ranked and presented inside the marketplace experience."
        title="Marketplace Preferences"
      >
        {marketplacePreferences.map((setting) => (
          <ToggleRow key={setting.id} setting={setting} />
        ))}
      </SettingsSection>

      <SettingsSection
        description="Manage which operational events appear in-app or through workspace communication channels."
        title="Notification Preferences"
      >
        {notificationPreferences.map((preference) => (
          <NotificationPreferenceCard
            key={preference.id}
            preference={preference}
          />
        ))}
      </SettingsSection>

      <SettingsSection
        description="Connect delivery and communication tools used by AgentExchange workflows."
        title="Connected Tools"
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {connectedTools.map((integration) => (
            <IntegrationStatusCard
              integration={integration}
              key={integration.id}
            />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        description="Control visibility, verification, and private diagnostics for trusted enterprise work."
        title="Privacy & Trust"
      >
        {privacyAndTrust.map((setting) => (
          <ToggleRow key={setting.id} setting={setting} />
        ))}
      </SettingsSection>

      <SettingsSection
        description="Adjust visual density and glow behavior for premium dark-mode workflows."
        title="Display Preferences"
      >
        {displayPreferences.map((setting) => (
          <ToggleRow key={setting.id} setting={setting} />
        ))}
      </SettingsSection>
    </section>
  );
}
