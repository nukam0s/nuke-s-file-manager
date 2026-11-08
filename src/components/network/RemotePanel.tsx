import { useEffect, useState } from 'react'

import { ipc } from '../../ipc/client'
import type { RemoteConnection, RemoteConnectionInput, RemoteProtocol } from '../../ipc/types'
import { remoteProtocolLabel, toRemotePath } from '../../lib/remotePath'
import { usePaneStore } from '../../state/paneStore'
import { useRemoteStore } from '../../state/remoteStore'
import { ToolModal } from '../tools/ToolModal'

const PROTOCOLS: RemoteProtocol[] = ['ftp', 'ftps', 'sftp', 'webdav']

const FIELD =
  'w-full rounded border border-slate-600 bg-panel px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500'
const LABEL = 'text-[11px] font-medium text-slate-400'

function defaultPort(protocol: RemoteProtocol): number {
  if (protocol === 'sftp') return 22
  if (protocol === 'webdav') return 443
  return 21
}

function toMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

interface Draft {
  id?: string
  name: string
  protocol: RemoteProtocol
  host: string
  port: string
  username: string
  password: string
  secure: boolean
  ftpsImplicit: boolean
  rootPath: string
}

function emptyDraft(): Draft {
  return {
    id: undefined,
    name: '',
    protocol: 'sftp',
    host: '',
    port: String(defaultPort('sftp')),
    username: '',
    password: '',
    secure: true,
    ftpsImplicit: false,
    rootPath: '/',
  }
}

function draftFrom(connection: RemoteConnection): Draft {
  return {
    id: connection.id,
    name: connection.name,
    protocol: connection.protocol,
    host: connection.host,
    port: String(connection.port),
    username: connection.username,
    password: '',
    secure: connection.secure,
    ftpsImplicit: connection.ftpsImplicit,
    rootPath: connection.rootPath,
  }
}

function toInput(draft: Draft): RemoteConnectionInput {
  return {
    id: draft.id,
    name: draft.name.trim(),
    protocol: draft.protocol,
    host: draft.host.trim(),
    port: Number(draft.port) || defaultPort(draft.protocol),
    username: draft.username,
    secure: draft.secure,
    ftpsImplicit: draft.ftpsImplicit,
    rootPath: draft.rootPath || '/',
  }
}

type Status = { tone: 'ok' | 'error' | 'info'; message: string } | null

const TONE: Record<'ok' | 'error' | 'info', string> = {
  ok: 'text-emerald-400',
  error: 'text-red-400',
  info: 'text-slate-400',
}

export function RemotePanel({ onClose }: { onClose: () => void }) {
  const connections = useRemoteStore((state) => state.connections)
  const loading = useRemoteStore((state) => state.loading)
  const storeError = useRemoteStore((state) => state.error)
  const load = useRemoteStore((state) => state.load)
  const save = useRemoteStore((state) => state.save)
  const remove = useRemoteStore((state) => state.remove)
  const test = useRemoteStore((state) => state.test)

  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void load(true)
  }, [load])

  const canSubmit = draft.name.trim().length > 0 && draft.host.trim().length > 0

  function refreshPanes(): Promise<void> {
    return usePaneStore.getState().refreshBoth()
  }

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function setProtocol(protocol: RemoteProtocol) {
    setDraft((current) => ({
      ...current,
      protocol,
      port: String(defaultPort(protocol)),
      secure: protocol === 'webdav' ? true : current.secure,
    }))
  }

  async function onSave() {
    if (!canSubmit) return
    setBusy(true)
    setStatus({ tone: 'info', message: 'A guardar…' })
    try {
      const password = draft.password.length > 0 ? draft.password : undefined
      const saved = await save(toInput(draft), password)
      setDraft(draftFrom(saved))
      await refreshPanes()
      setStatus({ tone: 'ok', message: 'Ligação guardada.' })
    } catch (error) {
      setStatus({ tone: 'error', message: toMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  async function onTest() {
    if (!canSubmit) return
    setBusy(true)
    setStatus({ tone: 'info', message: 'A testar…' })
    try {
      const password = draft.password.length > 0 ? draft.password : undefined
      const result = await test(toInput(draft), password)
      setStatus(
        result.ok
          ? { tone: 'ok', message: 'Ligação com sucesso.' }
          : { tone: 'error', message: result.error || 'Falha na ligação.' },
      )
    } catch (error) {
      setStatus({ tone: 'error', message: toMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  async function onConnect() {
    if (!draft.id) {
      setStatus({ tone: 'error', message: 'Guarda a ligação antes de ligar.' })
      return
    }
    setBusy(true)
    try {
      await ipc.remoteConnect(draft.id).catch(() => {})
      const side = usePaneStore.getState().active
      await usePaneStore.getState().navigate(side, toRemotePath(draft.id, '/'))
      onClose()
    } catch (error) {
      setStatus({ tone: 'error', message: toMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(id: string) {
    setBusy(true)
    try {
      await remove(id)
      if (draft.id === id) setDraft(emptyDraft())
      await refreshPanes()
      setStatus({ tone: 'ok', message: 'Ligação apagada.' })
    } catch (error) {
      setStatus({ tone: 'error', message: toMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolModal title="Rede — ligações remotas" onClose={onClose} width="w-[760px]">
      <div className="grid grid-cols-[240px_1fr] gap-4 text-xs">
        <div className="flex min-h-[320px] flex-col gap-1">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Ligações
            </span>
            <button
              type="button"
              onClick={() => {
                setDraft(emptyDraft())
                setStatus(null)
              }}
              className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-700"
            >
              + Nova
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded border border-slate-700">
            {loading && connections.length === 0 ? (
              <div className="p-2 text-slate-500">a carregar…</div>
            ) : null}
            {!loading && connections.length === 0 ? (
              <div className="p-2 text-slate-500">Sem ligações guardadas.</div>
            ) : null}
            {connections.map((connection) => (
              <div
                key={connection.id}
                className={`flex items-center gap-1 border-b border-slate-800 px-2 py-1 ${
                  draft.id === connection.id ? 'bg-sky-900/50' : 'hover:bg-slate-700/40'
                }`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    setDraft(draftFrom(connection))
                    setStatus(null)
                  }}
                >
                  <div className="truncate text-slate-200">{connection.name}</div>
                  <div className="truncate text-[10px] text-slate-500">
                    {remoteProtocolLabel(connection.protocol)} · {connection.host}:
                    {connection.port}
                  </div>
                </button>
                <button
                  type="button"
                  title="Apagar ligação"
                  disabled={busy}
                  onClick={() => void onDelete(connection.id)}
                  className="px-1 text-slate-500 hover:text-red-400 disabled:opacity-40"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {storeError ? <div className="text-[10px] text-red-400">{storeError}</div> : null}
        </div>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[90px_1fr] items-center gap-x-2 gap-y-2">
            <label className={LABEL} htmlFor="remote-name">
              Nome
            </label>
            <input
              id="remote-name"
              className={FIELD}
              value={draft.name}
              onChange={(event) => setField('name', event.target.value)}
              placeholder="Minha ligação"
            />

            <label className={LABEL} htmlFor="remote-protocol">
              Protocolo
            </label>
            <select
              id="remote-protocol"
              className={FIELD}
              value={draft.protocol}
              onChange={(event) => setProtocol(event.target.value as RemoteProtocol)}
            >
              {PROTOCOLS.map((protocol) => (
                <option key={protocol} value={protocol}>
                  {remoteProtocolLabel(protocol)}
                </option>
              ))}
            </select>

            <label className={LABEL} htmlFor="remote-host">
              Host
            </label>
            <input
              id="remote-host"
              className={FIELD}
              value={draft.host}
              onChange={(event) => setField('host', event.target.value)}
              placeholder="ftp.example.com"
            />

            <label className={LABEL} htmlFor="remote-port">
              Porta
            </label>
            <input
              id="remote-port"
              className={FIELD}
              inputMode="numeric"
              value={draft.port}
              onChange={(event) => setField('port', event.target.value)}
            />

            <label className={LABEL} htmlFor="remote-user">
              Utilizador
            </label>
            <input
              id="remote-user"
              className={FIELD}
              value={draft.username}
              onChange={(event) => setField('username', event.target.value)}
            />

            <label className={LABEL} htmlFor="remote-password">
              Palavra-passe
            </label>
            <input
              id="remote-password"
              type="password"
              className={FIELD}
              value={draft.password}
              onChange={(event) => setField('password', event.target.value)}
              placeholder={draft.id ? '(manter)' : ''}
            />

            <label className={LABEL} htmlFor="remote-root">
              Root remoto
            </label>
            <input
              id="remote-root"
              className={FIELD}
              value={draft.rootPath}
              onChange={(event) => setField('rootPath', event.target.value)}
              placeholder="/"
            />

            <span className={LABEL}>Opções</span>
            <div className="flex flex-wrap items-center gap-3">
              {draft.protocol === 'ftps' ? (
                <label className="flex items-center gap-1 text-slate-300">
                  <input
                    type="checkbox"
                    checked={draft.ftpsImplicit}
                    onChange={(event) => setField('ftpsImplicit', event.target.checked)}
                  />
                  FTPS implícito
                </label>
              ) : null}
              <label className="flex items-center gap-1 text-slate-300">
                <input
                  type="checkbox"
                  checked={draft.secure}
                  onChange={(event) => setField('secure', event.target.checked)}
                />
                Secure / TLS
              </label>
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || !canSubmit}
              onClick={() => void onTest()}
              className="rounded border border-slate-600 px-3 py-1 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              Testar
            </button>
            <button
              type="button"
              disabled={busy || !canSubmit}
              onClick={() => void onSave()}
              className="rounded bg-sky-600 px-3 py-1 font-medium text-white hover:bg-sky-500 disabled:opacity-40"
            >
              Guardar
            </button>
            <button
              type="button"
              disabled={busy || !draft.id}
              onClick={() => void onConnect()}
              className="rounded border border-emerald-500 px-3 py-1 text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-40"
            >
              Ligar
            </button>
            <button
              type="button"
              disabled={busy || !draft.id}
              onClick={() => draft.id && void onDelete(draft.id)}
              className="rounded border border-red-500 px-3 py-1 text-red-300 hover:bg-red-900/40 disabled:opacity-40"
            >
              Apagar
            </button>
          </div>

          {status ? <div className={`text-[11px] ${TONE[status.tone]}`}>{status.message}</div> : null}
        </div>
      </div>
    </ToolModal>
  )
}
