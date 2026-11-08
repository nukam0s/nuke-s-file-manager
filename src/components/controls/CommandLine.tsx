import { useState } from 'react'

import { usePaneStore } from '../../state/paneStore'

export function CommandLine() {
  const [value, setValue] = useState('')
  const active = usePaneStore((state) => state.active)
  const navigate = usePaneStore((state) => state.navigate)

  return (
    <div className="flex items-center gap-1 border-t border-slate-700 bg-panel px-1 py-1 text-xs">
      <span className="text-sky-400">{'>'}</span>
      <input
        className="flex-1 bg-transparent text-slate-200 outline-none"
        placeholder="Caminho… (Enter para abrir)"
        value={value}
        spellCheck={false}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && value.trim()) {
            void navigate(active, value.trim())
            setValue('')
          }
        }}
      />
    </div>
  )
}
