/**
 * achievements.js — Declarative achievement catalogue.
 *
 * Each achievement has a `condition(ctx)` predicate evaluated after relevant
 * events. `ctx` provides a stats snapshot, the level repository, and the most
 * recent win payload (if any). Keeping these declarative makes adding new
 * achievements a one-line data change.
 */
export const ACHIEVEMENTS = Object.freeze([
  {
    id: 'first_steps', name: 'First Steps', icon: '👣',
    description: 'Complete your very first level.',
    condition: (c) => c.stats.levelsCompleted >= 1,
  },
  {
    id: 'graduate', name: 'Graduate', icon: '🎓',
    description: 'Finish the tutorial.',
    condition: (c) => ['tut-1', 'tut-2', 'tut-3', 'tut-4', 'tut-5', 'tut-6', 'tut-7', 'tut-8'].every((id) => c.stats.completedIds.includes(id)),
  },
  {
    id: 'flawless', name: 'Flawless', icon: '⭐',
    description: 'Earn three stars on any level.',
    condition: (c) => c.stats.threeStars >= 1,
  },
  {
    id: 'sharp_mind', name: 'Sharp Mind', icon: '🧠',
    description: 'Clear a level without using a hint.',
    condition: (c) => c.lastWin && c.lastWin.hintsUsed === 0 && c.lastWin.moves <= c.lastWin.optimal,
  },
  {
    id: 'ten_down', name: 'Getting the Hang of It', icon: '🔟',
    description: 'Complete 10 levels.',
    condition: (c) => c.stats.levelsCompleted >= 10,
  },
  {
    id: 'fifty_down', name: 'Dedicated', icon: '🏅',
    description: 'Complete 50 levels.',
    condition: (c) => c.stats.levelsCompleted >= 50,
  },
  {
    id: 'century', name: 'Centurion', icon: '💯',
    description: 'Complete 100 levels.',
    condition: (c) => c.stats.levelsCompleted >= 100,
  },
  {
    id: 'perfectionist', name: 'Perfectionist', icon: '✨',
    description: 'Earn three stars on 25 levels.',
    condition: (c) => c.stats.threeStars >= 25,
  },
  {
    id: 'gem_hunter', name: 'Gem Hunter', icon: '💎',
    description: 'Collect 25 gems.',
    condition: (c) => c.stats.gems >= 25,
  },
  {
    id: 'speed_demon', name: 'Speed Demon', icon: '⚡',
    description: 'Solve a level in under eight seconds.',
    condition: (c) => c.lastWin && c.lastWin.timeMs > 0 && c.lastWin.timeMs < 8000 && c.lastWin.moves >= 2,
  },
  {
    id: 'streak', name: 'On a Roll', icon: '🔥',
    description: 'Win five levels in a row without falling.',
    condition: (c) => c.stats.bestStreak >= 5,
  },
  {
    id: 'daily_devotee', name: 'Daily Devotee', icon: '📅',
    description: 'Play seven daily challenges.',
    condition: (c) => c.stats.dailyPlayed >= 7,
  },
  {
    id: 'explorer', name: 'Explorer', icon: '🧭',
    description: 'Play an endless generated level.',
    condition: (c) => c.stats.endlessPlayed >= 1,
  },
  {
    id: 'architect', name: 'Architect', icon: '🛠️',
    description: 'Build and play your own level in the editor.',
    condition: (c) => c.stats.editorPlays >= 1,
  },
  {
    id: 'master_mind', name: 'Master Mind', icon: '👑',
    description: 'Clear a Master-difficulty level.',
    condition: (c) => c.lastWin && c.lastWin.difficulty === 'master',
  },
]);
