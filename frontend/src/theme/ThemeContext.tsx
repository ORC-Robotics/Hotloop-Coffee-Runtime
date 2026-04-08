import {
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { ThemeContext } from './themeContextStore'
import { themes, type ThemeId } from './themes'
import { toCssVariables } from './tokens'

const STORAGE_KEY = 'amr-telemetry-theme'

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
    root.style.colorScheme = theme.colorScheme
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
