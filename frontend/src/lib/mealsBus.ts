type Listener = () => void

const listeners = new Set<Listener>()

export function onMealsChanged(cb: Listener): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function notifyMealsChanged(): void {
  listeners.forEach((cb) => cb())
}
