import { useSyncExternalStore } from 'react'

let promptNeeded = false
const listeners = new Set<() => void>()

function emitChange() {
  listeners.forEach((listener) => listener())
}

export function markRegeneratePromptNeeded() {
  if (!promptNeeded) {
    promptNeeded = true
    emitChange()
  }
}

export function clearRegeneratePrompt() {
  if (promptNeeded) {
    promptNeeded = false
    emitChange()
  }
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  return () => listeners.delete(onStoreChange)
}

function getSnapshot() {
  return promptNeeded
}

export function useRegeneratePrompt() {
  const needed = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return {
    needed,
    dismiss: clearRegeneratePrompt,
  }
}
