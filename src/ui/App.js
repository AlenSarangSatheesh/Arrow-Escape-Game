/**
 * App.js — Application shell: constructs services, owns routing and global UI
 * (toasts, modals), applies settings to the document, and provides the actions
 * screens call (navigate, daily/endless start, profile import/export, reset).
 */
import { EventBus, Events } from '../core/EventBus.js';
import { SaveManager } from '../data/SaveManager.js';
import { Settings } from '../data/Settings.js';
import { Statistics } from '../data/Statistics.js';
import { Achievements } from '../data/Achievements.js';
import { LevelRepository } from '../data/LevelRepository.js';
import { AudioManager } from '../audio/AudioManager.js';
import { ScreenManager } from './ScreenManager.js';
import { ToastHost, showModal } from './components.js';
import {
  menuScreen, levelSelectScreen, settingsScreen, statsScreen,
  achievementsScreen, helpScreen, creditsScreen, pickDifficulty,
} from './screens/basic.js';
import { gameScreen } from './screens/GameScreen.js';
import { editorScreen } from './editor/EditorScreen.js';

export class App {
  constructor(root) {
    this.root = root;
    const bus = new EventBus();
    const save = new SaveManager();
    this.services = {
      bus,
      save,
      settings: new Settings({ save, bus }),
      stats: new Statistics({ save }),
      achievements: new Achievements({ save, bus }),
      repo: new LevelRepository({ save }),
      audio: new AudioManager(),
    };

    this.screens = new ScreenManager(root);
    this.toasts = new ToastHost();
    document.body.appendChild(this.toasts.el);

    this.routes = {
      menu: menuScreen,
      levelSelect: levelSelectScreen,
      game: gameScreen,
      editor: editorScreen,
      settings: settingsScreen,
      stats: statsScreen,
      achievements: achievementsScreen,
      help: helpScreen,
      credits: creditsScreen,
    };

    this._audioUnlocked = false;
    bus.on(Events.ACHIEVEMENT_UNLOCKED, (a) => {
      this.services.audio && this.unlockAudio();
      this.services.audio.play('unlock');
      this.toast({ icon: a.icon, title: 'Achievement unlocked', desc: a.name });
    });

    this.applySettings();
  }

  start() {
    this.navigate('menu', {}, { root: true });
  }

  navigate(id, params = {}, opts = {}) {
    const factory = this.routes[id];
    if (!factory) {
      console.warn(`[app] unknown route "${id}"`);
      return;
    }
    if (id === 'menu' && !opts.replace) opts.root = true;
    this.screens.go(factory, this, params, opts);
  }

  back() {
    if (this.screens.stack.length > 1) this.screens.back(this);
    else this.navigate('menu', {}, { root: true });
  }

  toast(opts) {
    return this.toasts.show(opts);
  }

  modal(opts) {
    return showModal(opts);
  }

  applySettings() {
    const s = this.services.settings;
    const html = document.documentElement;
    html.dataset.theme = s.get('theme');
    html.dataset.colorblind = s.get('colorblind');
    html.classList.toggle('reduce-motion', s.reducedMotionActive());
    html.classList.toggle('high-contrast', !!s.get('highContrast'));
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    html.classList.toggle('show-dpad', coarse);
    this.services.audio.setSettings({
      muted: !s.get('sound'),
      sfx: s.get('sfxVolume'),
      music: s.get('musicVolume'),
      musicOn: s.get('music'),
    });
  }

  unlockAudio() {
    if (this._audioUnlocked) return;
    this._audioUnlocked = true;
    this.services.audio.unlock();
    if (this.services.settings.get('music')) this.services.audio.startMusic();
  }

  /* ------------------------------------------------------------- modes */

  startDaily() {
    const today = new Date().toISOString().slice(0, 10);
    const level = this.services.repo.daily(today);
    if (!level) {
      this.toast({ icon: '⚠️', title: 'Could not load the daily challenge' });
      return;
    }
    this.navigate('game', { level, mode: 'daily', intro: 'Daily Challenge — the same puzzle for everyone today.' });
  }

  startEndless(difficulty) {
    const go = (d) => {
      const seed = Math.floor(Math.random() * 1e9);
      const level = this.services.repo.endless(d, seed);
      if (!level) {
        this.toast({ icon: '⚠️', title: 'Could not generate a level', desc: 'Please try again.' });
        return;
      }
      this.navigate('game', { level, mode: 'endless' });
    };
    if (difficulty) go(difficulty);
    else pickDifficulty(go);
  }

  /* --------------------------------------------------------- profile I/O */

  exportProfile() {
    const data = this.services.save.exportProfile();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'arrow-escape-profile.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.toast({ icon: '💾', title: 'Profile exported' });
  }

  importProfile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        this.services.save.importProfile(text);
        this.toast({ icon: '✅', title: 'Profile imported', desc: 'Reloading…' });
        setTimeout(() => location.reload(), 700);
      } catch {
        this.toast({ icon: '⚠️', title: 'Import failed', desc: 'That file is not a valid profile.' });
      }
    };
    input.click();
  }

  confirmReset() {
    showModal({
      title: 'Reset all progress?',
      body: 'This permanently deletes your stars, achievements, statistics, and custom levels. This cannot be undone.',
      actions: [
        { label: 'Cancel', variant: 'ghost' },
        {
          label: 'Delete everything',
          variant: 'danger',
          onClick: () => {
            this.services.save.clearAll();
            setTimeout(() => location.reload(), 300);
          },
        },
      ],
    });
  }
}
