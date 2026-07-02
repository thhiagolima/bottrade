import type { UserSettings, StrategyProfile } from '@bottrade/shared'

type ProfileScope = 'live' | 'paper'

export function resolveStrategySettings(settings: UserSettings, symbol: string, scope: ProfileScope = 'live'): UserSettings {
  const profileId = scope === 'paper'
    ? settings.paperProfileAssignments?.[symbol]
    : settings.pairProfileAssignments?.[symbol]

  if (!profileId) return settings

  const profile = settings.strategyProfiles?.find((p: StrategyProfile) => p.id === profileId)
  if (!profile) return settings

  return {
    ...settings,
    scoreConfig: profile.scoreConfig
      ? { ...(settings.scoreConfig ?? {}), ...profile.scoreConfig, weights: { ...(settings.scoreConfig?.weights ?? {}), ...(profile.scoreConfig.weights ?? {}) } }
      : settings.scoreConfig,
    riskConfig: profile.riskConfig
      ? { ...(settings.riskConfig ?? {}), ...profile.riskConfig }
      : settings.riskConfig,
    indicatorToggles: profile.indicatorToggles
      ? { ...(settings.indicatorToggles ?? {}), ...profile.indicatorToggles }
      : settings.indicatorToggles,
    indicatorPeriods: profile.indicatorPeriods
      ? { ...(settings.indicatorPeriods ?? {}), ...profile.indicatorPeriods }
      : settings.indicatorPeriods,
  }
}
