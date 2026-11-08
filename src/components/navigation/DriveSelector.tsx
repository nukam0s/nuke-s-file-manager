import { useEffect, useState } from 'react'

import { ipc } from '../../ipc/client'
import type { DriveInfo } from '../../ipc/types'
import { REMOTE_ROOT } from '../../lib/remotePath'
import { usePaneStore, type PaneSide } from '../../state/paneStore'

export function DriveSelector({ side }: { side: PaneSide }) {
  const navigate = usePaneStore((state) => state.navigate)
  const [drives, setDrives] = useState<DriveInfo[]>([])
  const [value, setValue] = useState('')

  useEffect(() => {
    ipc.getDrives().then(setDrives).catch(() => setDrives([]))
  }, [])

  return (
    <select
      title="Unidades e rede"
      value={value}
      className="max-w-[120px] rounded border border-slate-600 bg-panel px-1 py-1 text-xs text-slate-200"
      onChange={(event) => {
        const target = event.target.value
        // Reset to the placeholder so the same entry can be picked again (e.g. to refresh).
        setValue('')
        if (target) void navigate(side, target)
      }}
    >
      <option value="">💾</option>
      <option value={REMOTE_ROOT}>🌐 Rede</option>
      {drives.map((drive) => (
        <option key={drive.path} value={drive.path}>
          {drive.label}
        </option>
      ))}
    </select>
  )
}
