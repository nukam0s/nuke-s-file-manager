# 09 — Portable Packaging: Silent Startup Failures

This document records the two **independent** reasons the portable build
`release/Nuke File Manager 0.4.0.exe` can appear to "do nothing" when launched,
the evidence used to identify them, and the remediation for each.

---

## 1. `ELECTRON_RUN_AS_NODE` — Electron boots as plain Node

### Symptom
The app process starts and terminates within milliseconds. No window, no error
dialog, no stderr output. Exit code is `0`, so launchers report success.

### Cause
When `ELECTRON_RUN_AS_NODE` is present in the environment (presence-based, so
even an empty value counts), the Electron binary runs as a plain Node runtime.
Electron's internal `electron` module interception is disabled, therefore:

```js
const { app } = require('electron')  // app === undefined
```

`require('electron')` resolves to the npm shim, which exports the **path string**
of the binary instead of the API object. The main script then throws
`TypeError: Cannot read properties of undefined (reading 'requestSingleInstanceLock')`
and the process exits before creating a window.

> Note: `process.versions.electron` is **still populated** in Node mode. It is
> not a valid detector. Inspecting the value returned by `require('electron')`
> is the only reliable signal.

### Detection in this environment
- `echo %ELECTRON_RUN_AS_NODE%` → `1`
- `reg query "HKCU\Environment" /v ELECTRON_RUN_AS_NODE` → value not found
- `reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v ELECTRON_RUN_AS_NODE` → value not found

The variable is **not persisted in the registry**; it is injected into the
shell/agent session that spawns the process. A double-click from Explorer in a
clean session is normally unaffected, but any launcher inheriting that session's
environment will hit this path.

### Fix (implemented in `electron/main.cjs`)
A guard at the top of the main module:

1. Requires `electron` and checks whether the result is the API object
   (`typeof === 'object' && .app`).
2. If not, resolves the real binary (`require('electron')` string result, or
   `process.execPath` for packaged builds).
3. Re-spawns it with the **app root** (parent of `electron/`, i.e. the folder
   containing `package.json`) and `ELECTRON_RUN_AS_NODE` **deleted** from the
   child environment (empty string is not enough — the check is presence-based).
4. Forwards lifetime/exit code to the child and stops executing the module.

A sentinel (`NUKE_FM_ELECTRON_RELAUNCH=1`) prevents relaunch loops if the target
binary is not a real Electron runtime.

---

## 2. Smart App Control / WDAC blocks the unsigned binary

### Symptom
Windows displays *"Uma política de Controlo de Aplicações bloqueou este ficheiro"*
/ *"was blocked by your organization's Device Guard policy"* — or, when launched
from a console without a UI prompt, nothing at all (exit `0`, no output).

### Evidence (Event Viewer)
`Microsoft-Windows-CodeIntegrity/Operational`, event IDs **3033** and **3077**:

```
Code Integrity determined that a process (\Device\HarddiskVolume<N>\<repo path>
\release\Nuke File Manager 0.4.0.exe) attempted to load
\Device\HarddiskVolume<N>\Users\<user>\AppData\Local\Temp\<GUID>\Nuke File
Manager.exe that did not meet the Enterprise signing level requirements or violated
code integrity policy (Policy ID:{0283ac0f-fff1-49ae-ada1-8a933130cad6}).
```

> Paths in the excerpt above are anonymised (`<N>`, `<repo path>`, `<user>`); the policy ID is a
> public, non-secret identifier.

- `Microsoft-Windows-AppLocker/EXE and DLL` → **no events**
- `Microsoft-Windows-AppLocker/MSI and Script` → **no events**
- `Microsoft-Windows-SmartScreen/Debug` → **no events**

So the block is **not** AppLocker and **not** legacy SmartScreen; it is WDAC.

### Which policy
`CiTool.exe --list-policies --json`:

| Field | Value |
| --- | --- |
| PolicyID | `0283ac0f-fff1-49ae-ada1-8a933130cad6` |
| FriendlyName | `VerifiedAndReputableDesktop` |
| IsSystemPolicy | `true` |
| IsEnforced | `true` |
| PolicyOptions | `Enabled:UMCI`, `Enabled:Intelligent Security Graph Authorization`, … |

`HKLM\SYSTEM\CurrentControlSet\Control\CI\Policy\VerifiedAndReputablePolicyState = 1`
(enforcement) identifies this as **Smart App Control** running in enforced mode.

Consequence: every user-mode executable must be signed *and* have
reputation/signature accepted by the Intelligent Security Graph. The portable
target is unsigned (`electron-builder`: `no code signing certificate configured,
signing is skipped`), so it is blocked regardless of location.

### Path independence
Copying `release/win-unpacked` to `%USERPROFILE%\Desktop\nukefm-test\` produced
the identical block with the same Policy ID, confirming the rule is
**signature-based, not path-based**.

### Portable-target detail
The portable `.exe` is an NSIS self-extractor. It succeeds in unpacking to
`%TEMP%\<random>\Nuke File Manager.exe`, then fails when launching that extracted
binary — which is the file Code Integrity records. This is why the parent stub
exits without any visible message in a redirected console.

---

## Remediation

### Required for distribution (real fix)
Code-sign the executables with a certificate whose chain is trusted by the
endpoint policy (for Smart App Control: an OV/EV certificate with established
reputation, or an allow-listed publisher):

- Sign `release/win-unpacked/Nuke File Manager.exe` **and** the portable stub.
- Configure `win.signingHashAlgorithms`, `win.certificateFile` /
  `certificateSubjectName` (or Azure Trusted Signing) in `package.json` → `build.win`.
- Note: the portable target's embedded payload must also be signed; an unsigned
  inner executable remains blockable even if the stub is signed.

### Local-only workarounds (do not change the product)
1. Run the packaged app through an allow-listed Electron binary:
   `node_modules\electron\dist\electron.exe "release\win-unpacked\resources\app.asar"`
2. Ask IT for a WDAC supplemental policy / managed installer exemption for the
   publisher certificate.
3. Turn off Smart App Control (irreversible without OS reinstall) — not recommended.

### Environment hygiene
Clear `ELECTRON_RUN_AS_NODE` from shells/agents that spawn Electron:
`set ELECTRON_RUN_AS_NODE=` (or remove it from the launching session's env).

---

## Verification performed
| Check | Result |
| --- | --- |
| `npm run typecheck` | 0 errors |
| `npm run build:electron` | portable `.exe` + `win-unpacked` regenerated |
| Dev tree, `ELECTRON_RUN_AS_NODE=1` | guard relaunched → 5 processes, window "Nuke File Manager", `/api/health` → `200 {"ok":true}` |
| Packaged `app.asar`, `ELECTRON_RUN_AS_NODE=1` | guard relaunched → 5 processes, window "Nuke File Manager", `/api/health` → `200 {"ok":true}` |
| `release/win-unpacked/Nuke File Manager.exe` | blocked by WDAC (3033/3077, Policy `{0283ac0f-…}`) |
| `release/Nuke File Manager 0.4.0.exe` | stub exits `1`; extracted app exe blocked (3033/3077) |

---

## 3. Running the app today: shipped launchers

Two double-click launchers live in the project root. They are **local-only
conveniences**: they change no product code, rebuild nothing and sign nothing.

| File | Console window | Verified (2026-11-08) |
| --- | --- | --- |
| [`Iniciar Nuke File Manager.vbs`](../Iniciar%20Nuke%20File%20Manager.vbs) | none (`wscript.exe`) | 4 processes, window "Nuke File Manager", `/api/health` → `200 {"ok":true}` |
| [`Iniciar Nuke File Manager.bat`](../Iniciar%20Nuke%20File%20Manager.bat) | brief flash (`cmd.exe`) | 4 processes, window "Nuke File Manager", `/api/health` → `200 {"ok":true}` |

Both reduce to one command, executed from the project root:

```bat
set "ELECTRON_RUN_AS_NODE="
start "" "node_modules\electron\dist\electron.exe" "release\win-unpacked\resources\app.asar"
```

```vbs
' VBScript equivalent (absolute paths from WScript.ScriptFullName)
shell.Environment("PROCESS").Remove "ELECTRON_RUN_AS_NODE"
shell.CurrentDirectory = scriptDir
shell.Run """" & electronExe & """ """ & appAsar & """", 1, False
```

Design notes:

- **`set "VAR="` unsets**, it does not assign an empty string. This matters
  because Electron's `ELECTRON_RUN_AS_NODE` check is presence-based — see
  [§1](#1-electron_run_as_node--electron-boots-as-plain-node).
- The VBScript path uses `fso.GetParentFolderName(WScript.ScriptFullName)` so it
  works regardless of the working directory; the `.bat` uses `%~dp0` plus
  `cd /d` for the same reason.
- Both validate that `electron.exe` and `app.asar` exist and exit with a
  readable message instead of failing silently.
- The app server binds **port 0** (ephemeral). Discover the live port with:
  `Get-NetTCPConnection -State Listen | Where-Object { $_.OwningProcess -in (Get-Process electron).Id }`.
- **Hostile-environment test:** launching the VBScript with
  `ELECTRON_RUN_AS_NODE=1` already exported in the parent shell still produced
  the native window (`Nuke File Manager`) and `{"ok":true}` on port `52134`.
  `WshEnvironment.Remove` on the `PROCESS` scope is inherited by the spawned
  child, so the launcher is immune to the session-leaked variable described in
  [§1](#1-electron_run_as_node--electron-boots-as-plain-node).

### SEA runtime (evidence, not the end-user path)

`build/NukeFileManager.exe` is unaffected by code integrity (it is a Node SEA
blob, not a re-signed Electron bundle) and still answers correctly:

```bat
set "FM_NO_OPEN=1"&& set "FM_PORT=18080"&& start "" "build\NukeFileManager.exe"
curl -s http://127.0.0.1:18080/api/health      :: {"ok":true}
```

It is the "browser + console" variant; the Electron launchers above are the
intended way to use the app on this machine.

See also [`RUN.md`](../../RUN.md) for the short operational checklist.
