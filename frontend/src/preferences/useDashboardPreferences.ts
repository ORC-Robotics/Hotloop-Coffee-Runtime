import { useContext } from 'react'
import { DashboardPreferencesContext } from './dashboardPreferencesStore'

export function useDashboardPreferences() {
  const context = useContext(DashboardPreferencesContext)

  if (!context) {
    throw new Error('useDashboardPreferences must be used inside DashboardPreferencesProvider')
  }

  return context
}
