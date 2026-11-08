import type { ReactNode } from 'react'

interface ToolModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  width?: string
}

export function ToolModal({ title, onClose, children, width = 'w-[620px]' }: ToolModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div
        className={`${width} flex max-h-[82vh] flex-col rounded border border-slate-600 bg-panelAlt p-4 text-sm shadow-2xl`}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <button type="button" className="text-slate-400 hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  )
}
