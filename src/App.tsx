import { useEffect } from 'react'

import { CommandLine } from './components/controls/CommandLine'
import { FunctionKeyBar } from './components/controls/FunctionKeyBar'
import { ToolBar } from './components/controls/ToolBar'
import { DialogHost } from './components/dialogs/DialogHost'
import { OperationOverlay } from './components/dialogs/OperationOverlay'
import { ContextMenu } from './components/file-list/ContextMenu'
import { DualPaneLayout } from './components/layout/DualPaneLayout'
import { StatusBar } from './components/layout/StatusBar'
import { ToolsLayer } from './components/tools/ToolsLayer'
import { useKeyboard } from './hooks/useKeyboard'
import { ipc } from './ipc/client'
import { useOperationStore } from './state/operationStore'
import { usePaneStore } from './state/paneStore'
import { useRemoteStore } from './state/remoteStore'

export default function App() {
  useKeyboard()

  const init = usePaneStore((state) => state.init)
  const refreshBoth = usePaneStore((state) => state.refreshBoth)
  const loadRemote = useRemoteStore((state) => state.load)
  const setProgress = useOperationStore((state) => state.setProgress)
  const setResult = useOperationStore((state) => state.setResult)

  useEffect(() => {
    void init()
  }, [init])

  // Preload remote connections so path bars / tabs can render readable labels.
  useEffect(() => {
    void loadRemote()
  }, [loadRemote])

  useEffect(() => {
    const unsubscribers: Array<() => void> = []
    let cancelled = false

    void ipc.onProgress(setProgress).then((unlisten) => {
      if (cancelled) unlisten()
      else unsubscribers.push(unlisten)
    })

    void ipc
      .onCompleted((result) => {
        setResult(result)
        void refreshBoth()
      })
      .then((unlisten) => {
        if (cancelled) unlisten()
        else unsubscribers.push(unlisten)
      })

    return () => {
      cancelled = true
      unsubscribers.forEach((unlisten) => unlisten())
    }
  }, [setProgress, setResult, refreshBoth])

  return (
    <div className="flex h-full w-full select-none flex-col overflow-hidden bg-panel text-slate-200">
      <ToolBar />
      <div className="min-h-0 flex-1">
        <DualPaneLayout />
      </div>
      <CommandLine />
      <FunctionKeyBar />
      <StatusBar />
      <DialogHost />
      <ToolsLayer />
      <OperationOverlay />
      <ContextMenu />
    </div>
  )
}
