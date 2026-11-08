import { type CommandId } from '../../commands/commandRegistry'
import { executeCommand } from '../../commands/fileCommands'

interface FKey {
  key: string
  label: string
  command: CommandId
}

const KEYS: FKey[] = [
  { key: 'F2', label: 'Renomear', command: 'FILE_RENAME' },
  { key: 'F3', label: 'Ver', command: 'FILE_VIEW' },
  { key: 'F4', label: 'Editar', command: 'FILE_EDIT' },
  { key: 'F5', label: 'Copiar', command: 'FILE_COPY' },
  { key: 'F6', label: 'Mover', command: 'FILE_MOVE' },
  { key: 'F7', label: 'Nova pasta', command: 'FILE_MKDIR' },
  { key: 'F8', label: 'Apagar', command: 'FILE_DELETE' },
]

export function FunctionKeyBar() {
  return (
    <div className="flex items-center gap-1 border-t border-slate-700 bg-panelAlt px-1 py-1 text-[11px]">
      {KEYS.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => void executeCommand(item.command)}
          className="flex items-center gap-1 rounded border border-slate-600 px-2 py-0.5 hover:bg-slate-700"
        >
          <span className="font-semibold text-sky-400">{item.key}</span>
          <span className="text-slate-300">{item.label}</span>
        </button>
      ))}
    </div>
  )
}
