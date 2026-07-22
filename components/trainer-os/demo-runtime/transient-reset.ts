const resetListeners = new Set<() => void>();

export function registerDemoTransientReset(listener: () => void) {
  resetListeners.add(listener);
  return () => resetListeners.delete(listener);
}

export function resetDemoTransientState() {
  if (typeof window !== "undefined") {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith("workout-review:")) window.sessionStorage.removeItem(key);
    }
  }
  resetListeners.forEach((listener) => listener());
}
