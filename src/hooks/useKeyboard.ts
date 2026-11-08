import { useEffect } from 'react'

import { resolveCommand } from '../commands/commandRegistry'
import { executeCommand } from '../commands/fileCommands'

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

/// Global keydown dispatcher. Ignores events typed into inputs/selects.
export function useKeyboard(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isEditable(event.target)) return
      const command = resolveCommand(event)
      if (!command) return
      event.preventDefault()
      void executeCommand(command)
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
