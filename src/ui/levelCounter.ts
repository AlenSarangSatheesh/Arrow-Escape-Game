/** The "Level N" rolling digits: new number enters from above, old one drops out below. */
export class LevelCounter {
  private el: HTMLElement
  private current = 0

  constructor(digitsEl: HTMLElement) {
    this.el = digitsEl
  }

  set(level: number, animate = true): void {
    if (level === this.current && this.el.childElementCount > 0) return
    const prev = this.current
    this.current = level

    if (!animate || prev === 0) {
      this.el.replaceChildren(this.span(String(level)))
      return
    }

    const incoming = this.span(String(level), 'enter')
    const outgoing = this.span(String(prev), 'leave')
    this.el.replaceChildren(outgoing, incoming)
    outgoing.addEventListener('animationend', () => outgoing.remove(), { once: true })
  }

  get value(): number {
    return this.current
  }

  private span(text: string, cls?: string): HTMLSpanElement {
    const s = document.createElement('span')
    s.textContent = text
    if (cls) s.classList.add(cls)
    return s
  }
}
