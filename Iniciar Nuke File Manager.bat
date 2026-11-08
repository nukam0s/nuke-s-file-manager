@echo off
rem ===========================================================================
rem  Nuke File Manager - launcher (native Electron window)
rem
rem  WHY THIS EXISTS
rem  ---------------
rem  release\Nuke File Manager 0.4.0.exe (portable) and
rem  release\win-unpacked\Nuke File Manager.exe are UNSIGNED binaries produced
rem  by electron-builder (which re-writes the PE header and therefore voids the
rem  original Electron signature). On Windows 11 with Smart App Control / WDAC
rem  enabled they are blocked before any user code runs.
rem
rem  The plain Electron binary from node_modules is still signed by the Electron
rem  project, so running it against the packaged app.asar works: this launches
rem  the exact same UI + backend, in a native window, with no browser and no
rem  application menu.
rem
rem  NOTE: `set "VAR="` UNSETS the variable. Electron checks ELECTRON_RUN_AS_NODE
rem  by presence, so an empty-but-defined value would still boot it as plain
rem  Node and the app would exit silently.
rem ===========================================================================
setlocal
cd /d "%~dp0"

set "ELECTRON_RUN_AS_NODE="

set "ELECTRON_EXE=%~dp0node_modules\electron\dist\electron.exe"
set "APP_ASAR=%~dp0release\win-unpacked\resources\app.asar"

if not exist "%ELECTRON_EXE%" (
  echo [ERRO] Runtime Electron nao encontrado:
  echo        %ELECTRON_EXE%
  echo        Execute: npm install
  pause
  exit /b 1
)

if not exist "%APP_ASAR%" (
  echo [ERRO] Pacote da aplicacao nao encontrado:
  echo        %APP_ASAR%
  echo        Execute: npm run build:electron
  pause
  exit /b 1
)

start "" "%ELECTRON_EXE%" "%APP_ASAR%"

exit /b 0
