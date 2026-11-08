export type CommandId =
  | 'TOGGLE_PANE'
  | 'NAV_UP'
  | 'NAV_ENTER'
  | 'NAV_ROOT'
  | 'HISTORY_BACK'
  | 'HISTORY_FORWARD'
  | 'NEW_TAB'
  | 'CLOSE_TAB'
  | 'CURSOR_UP'
  | 'CURSOR_DOWN'
  | 'CURSOR_HOME'
  | 'CURSOR_END'
  | 'TOGGLE_SELECT'
  | 'SELECT_ALL'
  | 'INVERT_SELECTION'
  | 'SELECT_PATTERN'
  | 'DESELECT_PATTERN'
  | 'TOGGLE_HIDDEN'
  | 'FILE_COPY'
  | 'FILE_MOVE'
  | 'FILE_MKDIR'
  | 'FILE_DELETE'
  | 'FILE_RENAME'
  | 'FILE_VIEW'
  | 'FILE_EDIT'
  | 'SEARCH'
  | 'QUICK_VIEW'
  | 'HOTLIST_ADD'

export interface KeyEventLike {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}

/// Maps a key event to a command id (Total Commander style bindings).
export function resolveCommand(event: KeyEventLike): CommandId | null {
  const { key } = event
  const ctrl = event.ctrlKey || event.metaKey

  if (event.altKey) {
    if (key === 'F7') return 'SEARCH'
    if (key === 'ArrowLeft') return 'HISTORY_BACK'
    if (key === 'ArrowRight') return 'HISTORY_FORWARD'
    return null
  }

  if (ctrl) {
    switch (key.toLowerCase()) {
      case 'a':
        return 'SELECT_ALL'
      case 'h':
        return 'TOGGLE_HIDDEN'
      case 't':
        return 'NEW_TAB'
      case 'w':
        return 'CLOSE_TAB'
      case 'i':
        return 'INVERT_SELECTION'
      case 'q':
        return 'QUICK_VIEW'
      case 'd':
        return 'HOTLIST_ADD'
    }
    if (key === '\\') return 'NAV_ROOT'
    return null
  }

  switch (key) {
    case 'Tab':
      return 'TOGGLE_PANE'
    case 'Backspace':
      return 'NAV_UP'
    case 'Enter':
      return 'NAV_ENTER'
    case 'F2':
      return 'FILE_RENAME'
    case 'F3':
      return 'FILE_VIEW'
    case 'F4':
      return 'FILE_EDIT'
    case 'F5':
      return 'FILE_COPY'
    case 'F6':
      return 'FILE_MOVE'
    case 'F7':
      return 'FILE_MKDIR'
    case 'F8':
      return 'FILE_DELETE'
    case 'Delete':
      return 'FILE_DELETE'
    case 'ArrowUp':
      return 'CURSOR_UP'
    case 'ArrowDown':
      return 'CURSOR_DOWN'
    case 'Home':
      return 'CURSOR_HOME'
    case 'End':
      return 'CURSOR_END'
    case ' ':
      return 'TOGGLE_SELECT'
    case '+':
      return 'SELECT_PATTERN'
    case '-':
      return 'DESELECT_PATTERN'
    case '*':
      return 'INVERT_SELECTION'
    default:
      return null
  }
}
