import type { PropsWithChildren } from 'react'
import { defaultTheme, Provider as SpectrumProvider } from '@adobe/react-spectrum'
import { useTheme } from '../../hooks/useTheme'
import { RemoteDriverProvider } from '../../hooks/useRemoteDriver'
import { ThemeProvider } from '../../theme/ThemeContext'
import { DashboardPreferencesProvider } from '../../preferences/DashboardPreferencesProvider'

function SpectrumThemeBridge({ children }: PropsWithChildren) {
  const { theme } = useTheme()

  return (
    <SpectrumProvider
      theme={defaultTheme}
      colorScheme={theme.colorScheme}
      scale="medium"
    >
      {children}
    </SpectrumProvider>
  )
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <SpectrumThemeBridge>
        <RemoteDriverProvider>
          <DashboardPreferencesProvider>{children}</DashboardPreferencesProvider>
        </RemoteDriverProvider>
      </SpectrumThemeBridge>
    </ThemeProvider>
  )
}
