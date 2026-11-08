import { useEffect, useState } from 'react'

import { ipc } from '../../ipc/client'
import type { TreeResult } from '../../ipc/types'
import { usePaneStore, type PaneSide } from '../../state/paneStore'

function TreeRow({ node, depth, side }: { node: TreeResult; depth: number; side: PaneSide }) {
  const [open, setOpen] = useState(depth < 1)
  const [children, setChildren] = useState<TreeResult[] | null>(node.children)
  const [loading, setLoading] = useState(false)
  const navigate = usePaneStore((state) => state.navigate)
  const setActive = usePaneStore((state) => state.setActive)

  async function toggle() {
    setActive(side)
    if (!open && children === null) {
      setLoading(true)
      try {
        const result = await ipc.tree(node.path, 1)
        setChildren(result.children ?? [])
      } finally {
        setLoading(false)
      }
    }
    setOpen(!open)
  }

  return (
    <div>
      <div
        className="flex items-center gap-1 py-0.5 pr-1 text-xs hover:bg-slate-700/40"
        style={{ paddingLeft: depth * 14 + 4 }}
      >
        <button
          type="button"
          onClick={() => void toggle()}
          className="w-4 text-slate-400"
          title={children === null ? 'expandir' : open ? 'recolher' : 'expandir'}
        >
          {loading ? '…' : children === null && !open ? '·' : open ? '▾' : '▸'}
        </button>
        <span aria-hidden>📁</span>
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left"
          title={node.path}
          onDoubleClick={() => void navigate(side, node.path)}
        >
          {node.name}
        </button>
      </div>
      {open && children
        ? children.map((child) => (
            <TreeRow key={child.path} node={child} depth={depth + 1} side={side} />
          ))
        : null}
    </div>
  )
}

export function TreeView({ side, root }: { side: PaneSide; root: string }) {
  const [nodes, setNodes] = useState<TreeResult[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setError(null)
    ipc
      .tree(root, 2)
      .then((result) => {
        if (active) setNodes(result.children ?? [])
      })
      .catch((err: unknown) => {
        if (active) setError(String((err as { message?: string })?.message ?? err))
      })
    return () => {
      active = false
    }
  }, [root])

  return (
    <div className="h-full overflow-auto py-1">
      {error ? <div className="px-2 text-xs text-red-400">{error}</div> : null}
      {nodes.map((node) => (
        <TreeRow key={node.path} node={node} depth={0} side={side} />
      ))}
      {nodes.length === 0 && !error ? (
        <div className="p-3 text-center text-xs text-slate-500">(sem subpastas)</div>
      ) : null}
    </div>
  )
}
