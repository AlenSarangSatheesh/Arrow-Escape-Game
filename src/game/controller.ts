import { isBlocked } from '../core/board'
import { fireConfetti } from '../render/confetti'
import { BoardView } from '../render/boardView'
import { completeLevel, unlockedLevel } from './progress'
import { Hud } from '../ui/hud'
import { Screens } from '../ui/screens'
import { type GameState, startLevel, tap } from './state'

const WIN_HOLD_MS = 1400
const RESTART_HOLD_MS = 520

/** Orchestrates one play session: model <-> board view <-> HUD <-> screens. */
export class GameController {
  private state!: GameState
  private view: BoardView | null = null
  private hud: Hud
  private screens: Screens
  /** Freezes input during a screen transition (win hold, game-over hold, menu). NOT set during
   * arrow animations — those run concurrently so you can tap the next arrow without waiting. */
  private frozen = false
  /** Ids with an animation in flight, so the same arrow can't be re-tapped mid-move. */
  private busy = new Set<number>()
  /** Count of escapes still animating out; the win only fires once the board is clear AND every
   * escaping arrow has finished leaving. */
  private escaping = 0
  /** Bumped whenever the session changes (new level / back to menu) so stale animation and
   * setTimeout callbacks from a previous board can detect they are out of date and bail. */
  private gen = 0

  private boardSvg = document.getElementById('board') as unknown as SVGSVGElement
  private confetti = document.getElementById('confetti') as HTMLCanvasElement
  private hintEl = document.getElementById('hint') as HTMLElement

  constructor() {
    this.hud = new Hud(document.getElementById('hud') as HTMLElement)
    this.screens = new Screens((level) => this.play(level))

    ;(document.getElementById('btn-back') as HTMLButtonElement).addEventListener('click', () =>
      this.exitToMenu(),
    )
    ;(document.getElementById('btn-restart') as HTMLButtonElement).addEventListener('click', () =>
      this.restartLevel(),
    )
  }

  start(): void {
    this.screens.showIntro(unlockedLevel())
  }

  private play(level: number): void {
    this.gen++
    this.state = startLevel(level)
    this.screens.showGame()
    this.mountBoard()
    this.hud.setTutorial(this.state.spec.penaltyFree)
    this.hud.reset(this.state.lives)
    this.toggleHint()
    this.frozen = false
    this.busy.clear()
    this.escaping = 0
    if (import.meta.env.DEV) (window as unknown as { __arrows: GameController }).__arrows = this
  }

  /** Dev-only: ids of arrows whose ray is currently clear (a legal escape). */
  escapableIds(): number[] {
    return this.state.board.arrows.filter((a) => !isBlocked(this.state.board, a)).map((a) => a.id)
  }

  private mountBoard(): void {
    this.view?.destroy()
    this.view = new BoardView(this.boardSvg, this.state.board, (id) => this.onTap(id))
  }

  private toggleHint(): void {
    this.hintEl.hidden = this.state.level > 1
  }

  private onTap(id: number): void {
    if (this.frozen || !this.view || this.busy.has(id)) return
    const view = this.view
    const gen = this.gen

    // The model is updated immediately, so a just-tapped escaping arrow frees its cells right away
    // and the next arrow it was blocking becomes tappable — even while the first is still gliding out.
    const result = tap(this.state, id)
    switch (result.kind) {
      case 'ignored':
        return

      case 'escape': {
        this.busy.add(id)
        this.escaping++
        this.hintEl.hidden = true
        view.escape(id, () => {
          if (gen !== this.gen) return // board was reset/left mid-animation
          this.busy.delete(id)
          this.escaping--
          view.refreshDots()
          if (this.escaping === 0 && this.state.board.arrows.length === 0) this.win()
        })
        return
      }

      case 'blocked': {
        this.busy.add(id)
        if (result.costLife) {
          view.flash()
          this.hud.loseLife()
        }
        // Freeze on the fatal tap right away, so a burst of taps can't drain past zero or trigger
        // the game-over path twice while the last lunge is still playing.
        if (result.gameOver) this.frozen = true
        view.lunge(id, result.gap, () => {
          if (gen !== this.gen) return
          this.busy.delete(id)
          if (result.gameOver) this.onGameOver()
        })
        return
      }
    }
  }

  private win(): void {
    this.frozen = true
    completeLevel(this.state.level)
    fireConfetti(this.confetti)
    this.screens.praise(this.state.level)
    const next = this.state.level + 1
    const gen = this.gen
    window.setTimeout(() => {
      if (gen === this.gen) this.play(next)
    }, WIN_HOLD_MS)
  }

  /** Third life lost -> restart the same level with a fresh board and full lives. */
  private onGameOver(): void {
    this.frozen = true
    this.screens.toast('Out of lives — restarting')
    const gen = this.gen
    window.setTimeout(() => {
      if (gen === this.gen) this.restartLevel()
    }, RESTART_HOLD_MS)
  }

  private restartLevel(): void {
    this.play(this.state.level)
  }

  private exitToMenu(): void {
    this.gen++
    this.frozen = true
    this.screens.showIntro(this.state.level)
  }
}
