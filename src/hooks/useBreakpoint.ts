import { useState, useEffect } from 'react'

interface Breakpoints {
  xs: boolean
  sm: boolean
  md: boolean
  lg: boolean
  xl: boolean
  '2xl': boolean
}

export const useBreakpoint = (): Breakpoints => {
  const [breakpoints, setBreakpoints] = useState<Breakpoints>({
    xs: false,
    sm: false,
    md: false,
    lg: false,
    xl: false,
    '2xl': false,
  })

  useEffect(() => {
    const updateBreakpoints = () => {
      const width = window.innerWidth
      
      setBreakpoints({
        xs: width >= 0,
        sm: width >= 640,
        md: width >= 768,
        lg: width >= 1024,
        xl: width >= 1280,
        '2xl': width >= 1536,
      })
    }

    updateBreakpoints()
    window.addEventListener('resize', updateBreakpoints)

    return () => {
      window.removeEventListener('resize', updateBreakpoints)
    }
  }, [])

  return breakpoints
}

export const useIsCompactLayout = (): boolean => {
  const breakpoints = useBreakpoint()
  return !breakpoints.md
}