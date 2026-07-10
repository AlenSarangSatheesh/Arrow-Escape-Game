import { unlockedLevel } from '../game/progress'
import { LevelCounter } from './levelCounter'

const PRAISE = ['Nice!', 'Great!', 'Superb!', 'Sharp!', 'Clean!', 'Slick!']

/** Manages the intro/level-select screen and one-shot overlays (praise word, toast). */
export class Screens {
  private intro = document.getElementById('screen-intro') as HTMLElement
  private game = document.getElementById('screen-game') as HTMLElement
  private counter: LevelCounter
  private praiseEl = document.getElementById('praise') as HTMLElement
  private toastEl = document.getElementById('toast') as HTMLElement
  private prevBtn = document.getElementById('level-prev') as HTMLButtonElement
  private nextBtn = document.getElementById('level-next') as HTMLButtonElement
  private selected: number

  constructor(private onPlay: (level: number) => void) {
    this.counter = new LevelCounter(document.getElementById('level-digits') as HTMLElement)
    this.selected = unlockedLevel()

    ;(document.getElementById('btn-play') as HTMLButtonElement).addEventListener('click', () =>
      this.onPlay(this.selected),
    )
    this.prevBtn.addEventListener('click', () => this.nudge(-1))
    this.nextBtn.addEventListener('click', () => this.nudge(1))
  }

  private nudge(d: number): void {
    const max = unlockedLevel()
    this.selected = Math.min(max, Math.max(1, this.selected + d))
    this.counter.set(this.selected)
    this.syncArrows()
  }

  private syncArrows(): void {
    this.prevBtn.disabled = this.selected <= 1
    this.nextBtn.disabled = this.selected >= unlockedLevel()
  }

  showIntro(level = this.selected): void {
    this.selected = Math.min(unlockedLevel(), Math.max(1, level))
    this.counter.set(this.selected)
    this.syncArrows()
    this.game.hidden = true
    this.intro.hidden = false
  }

  showGame(): void {
    this.intro.hidden = true
    this.game.hidden = false
  }

  praise(level: number): void {
    const word = PRAISE[level % PRAISE.length]
    this.praiseEl.textContent = word
    this.praiseEl.classList.remove('praise--on')
    void this.praiseEl.offsetWidth
    this.praiseEl.classList.add('praise--on')
  }

  toast(msg: string): void {
    this.toastEl.textContent = msg
    this.toastEl.classList.remove('toast--on')
    void this.toastEl.offsetWidth
    this.toastEl.classList.add('toast--on')
  }
}
