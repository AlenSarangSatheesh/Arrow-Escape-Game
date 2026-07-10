const KEY = 'arrows.progress.v1'

interface Progress {
  /** Highest level the player has unlocked (reached), 1-based. */
  unlocked: number
}

function read(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<Progress>
      if (typeof p.unlocked === 'number' && p.unlocked >= 1) return { unlocked: Math.floor(p.unlocked) }
    }
  } catch {
    /* storage unavailable or corrupt — fall through to default */
  }
  return { unlocked: 1 }
}

function write(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* ignore quota / privacy-mode failures */
  }
}

export const unlockedLevel = (): number => read().unlocked

/** Records that `level` is cleared, unlocking level+1. */
export function completeLevel(level: number): void {
  const p = read()
  if (level + 1 > p.unlocked) write({ unlocked: level + 1 })
}
