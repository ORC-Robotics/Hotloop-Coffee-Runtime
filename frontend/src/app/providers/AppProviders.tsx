import type { PropsWithChildren } from 'react'
import { ThemeProvider } from '../../theme/ThemeContext'

export function AppProviders({ children }: PropsWithChildren) {
  return <ThemeProvider>{children}</ThemeProvider>
}
