import type { PropsWithChildren } from 'react'
import { ThemeProvider } from '../../theme/ThemeContext'
import { DashboardPreferencesProvider } from '../../preferences/DashboardPreferencesProvider'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <DashboardPreferencesProvider>{children}</DashboardPreferencesProvider>
    </ThemeProvider>
  )
}
