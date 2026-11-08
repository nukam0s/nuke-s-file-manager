' ===========================================================================
'  Nuke File Manager - launcher sem consola (janela nativa Electron)
'
'  Equivalente a "Iniciar Nuke File Manager.bat", mas lanca o processo sem
'  abrir nenhuma janela de consola (wscript.exe em vez de cmd.exe).
'
'  WHY: os .exe em release\ sao binarios NAO assinados (o electron-builder
'  reescreve o PE header e invalida a assinatura original). Smart App Control /
'  WDAC bloqueia-os. O electron.exe de node_modules continua assinado, por isso
'  executa-lo contra o app.asar empacotado produz exactamente a mesma app.
' ===========================================================================
Option Explicit

Dim fso, shell, scriptDir, electronExe, appAsar, commandLine

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
electronExe = fso.BuildPath(scriptDir, "node_modules\electron\dist\electron.exe")
appAsar = fso.BuildPath(scriptDir, "release\win-unpacked\resources\app.asar")

If Not fso.FileExists(electronExe) Then
  MsgBox "Runtime Electron nao encontrado:" & vbCrLf & vbCrLf & electronExe & _
         vbCrLf & vbCrLf & "Execute: npm install", vbCritical, "Nuke File Manager"
  WScript.Quit 1
End If

If Not fso.FileExists(appAsar) Then
  MsgBox "Pacote da aplicacao nao encontrado:" & vbCrLf & vbCrLf & appAsar & _
         vbCrLf & vbCrLf & "Execute: npm run build:electron", vbCritical, "Nuke File Manager"
  WScript.Quit 1
End If

' Electron trata ELECTRON_RUN_AS_NODE como PRESENCA: uma string vazia ainda
' arranca em modo Node e a app termina em silencio. Remover a variavel do
' ambiente do processo garante que o filho herda o ambiente correcto.
On Error Resume Next
shell.Environment("PROCESS").Remove "ELECTRON_RUN_AS_NODE"
On Error GoTo 0

shell.CurrentDirectory = scriptDir

commandLine = """" & electronExe & """ """ & appAsar & """"
shell.Run commandLine, 1, False
