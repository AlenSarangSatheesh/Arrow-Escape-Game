const SVG = 'http://www.w3.org/2000/svg'
const HEART_PATH =
  'M12 21s-7.5-4.7-10-9.2C.6 9 1.6 5.5 4.8 4.6 7 4 9.2 5 12 8.1 14.8 5 17 4 19.2 4.6c3.2.9 4.2 4.4 2.8 7.2C19.5 16.3 12 21 12 21z'

/** Renders and animates the 3-heart life meter. */
export class Hud {
  private root: HTMLElement
  private hearts: HTMLElement
  private lives = 3

  constructor(hudEl: HTMLElement) {
    this.root = hudEl
    this.hearts = hudEl.querySelector('#hearts') as HTMLElement
  }

  setTutorial(on: boolean): void {
    this.root.classList.toggle('hud--tutorial', on)
  }

  /** Full reset with the staggered scale-in used at every level start. */
  reset(lives: number): void {
    this.lives = lives
    this.hearts.replaceChildren()
    for (let i = 0; i < lives; i++) {
      const h = this.makeHeart()
      h.style.animationDelay = `${i * 90}ms`
      this.hearts.append(h)
    }
  }

  private makeHeart(empty = false): HTMLElement {
    const el = document.createElement('span')
    el.className = empty ? 'heart heart--empty' : 'heart'
    const svg = document.createElementNS(SVG, 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    const path = document.createElementNS(SVG, 'path')
    path.setAttribute('d', HEART_PATH)
    svg.append(path)
    el.append(svg)
    return el
  }

  /** Drains the rightmost filled heart (red -> lavender) with a pulse. Returns lives remaining. */
  loseLife(): number {
    this.lives = Math.max(0, this.lives - 1)
    const nodes = [...this.hearts.children] as HTMLElement[]
    const target = nodes[this.lives]
    if (target) target.classList.add('heart--empty')
    this.hearts.classList.remove('hearts--pulse')
    void this.hearts.offsetWidth
    this.hearts.classList.add('hearts--pulse')
    return this.lives
  }

  get livesLeft(): number {
    return this.lives
  }
}
