import { useToolStore } from '../../state/toolStore'
import { OpenWithDialog } from '../dialogs/OpenWithDialog'
import { PropertiesModal } from '../dialogs/PropertiesModal'
import { RemotePanel } from '../network/RemotePanel'
import { ChecksumPanel } from './ChecksumPanel'
import { ComparePanel } from './ComparePanel'
import { ExtractPanel } from './ExtractPanel'
import { MultiRenamePanel } from './MultiRenamePanel'
import { SearchPanel } from './SearchPanel'
import { SplitPanel } from './SplitPanel'
import { SyncPanel } from './SyncPanel'
import { ViewerPanel } from './ViewerPanel'
import { ZipPanel } from './ZipPanel'

export function ToolsLayer() {
  const tool = useToolStore((state) => state.tool)
  const close = useToolStore((state) => state.close)

  if (!tool) return null

  switch (tool.kind) {
    case 'search':
      return <SearchPanel root={tool.root} onClose={close} />
    case 'viewer':
      return <ViewerPanel path={tool.path} onClose={close} />
    case 'checksum':
      return <ChecksumPanel paths={tool.paths} onClose={close} />
    case 'zip':
      return (
        <ZipPanel
          sources={tool.sources}
          defaultName={tool.defaultName}
          basePath={tool.basePath}
          format={tool.format}
          onClose={close}
        />
      )
    case 'extract':
      return <ExtractPanel archive={tool.archive} basePath={tool.basePath} onClose={close} />
    case 'multirename':
      return <MultiRenamePanel entries={tool.entries} onClose={close} />
    case 'split':
      return <SplitPanel entry={tool.entry} onClose={close} />
    case 'compare':
      return <ComparePanel left={tool.left} right={tool.right} onClose={close} />
    case 'sync':
      return <SyncPanel left={tool.left} right={tool.right} onClose={close} />
    case 'properties':
      return <PropertiesModal entry={tool.entry} onClose={close} />
    case 'openwith':
      return <OpenWithDialog entry={tool.entry} onClose={close} />
    case 'remote':
      return <RemotePanel onClose={close} />
    default:
      return null
  }
}
