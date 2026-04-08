import { createContext } from 'react'
import type { ThemeDefinition, ThemeId } from './themes'

export interface ThemeContextValue {
  theme: ThemeDefinition
  themeId: ThemeId
  setThemeId: (themeId: ThemeId) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
