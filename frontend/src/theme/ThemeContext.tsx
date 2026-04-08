import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { themes, type ThemeDefinition, type ThemeId } from './themes'
import { toCssVariables } from './tokens'

interface ThemeContextValue {
  theme: ThemeDefinition
  themeId: ThemeId
  setThemeId: (themeId: ThemeId) => void
}

const STORAGE_KEY = 'amr-telemetry-theme'

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: PropsWithChildren) {
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY) as ThemeId | null
    return storedTheme && themes[storedTheme] ? storedTheme : 'neutralPastel'
  })

  const theme = useMemo(() => themes[themeId], [themeId])

  useEffect(() => {
    const root = document.documentElement
    const variables = toCssVariables(theme.tokens)

    Object.entries(variables).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })

    root.dataset.theme = themeId
    root.style.colorScheme = themeId === 'neutralPastel' ? 'light' : 'dark'
    window.localStorage.setItem(STORAGE_KEY, themeId)
  }, [theme, themeId])

  const value = useMemo(
    () => ({
      theme,
      themeId,
      setThemeId,
    }),
    [theme, themeId],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemeContext() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useThemeContext must be used inside ThemeProvider')
  }

  return context
}
