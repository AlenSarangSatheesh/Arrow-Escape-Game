/**
 * tutorial.js — World 0: gentle, guided levels that teach the core rules one at
 * a time. Each carries an `intro` string surfaced by the coach-mark system.
 */
import { definePack } from '../LevelBuilder.js';

export const tutorialPack = definePack([
  {
    id: 'tut-1',
    name: 'First Steps',
    world: 0,
    index: 0,
    difficulty: 'tutorial',
    intro: 'Swipe or press an arrow key. You slide until you hit a wall — reach the glowing exit.',
    mechanics: ['slide'],
    par: 1,
    map: [
      'S...E',
    ],
  },
  {
    id: 'tut-2',
    name: 'Any Direction',
    world: 0,
    index: 1,
    difficulty: 'tutorial',
    intro: 'You can launch up, down, left, or right. Try going down.',
    mechanics: ['slide'],
    par: 1,
    map: [
      'S',
      '.',
      '.',
      'E',
    ],
  },
  {
    id: 'tut-3',
    name: 'Follow the Arrow',
    world: 0,
    index: 2,
    difficulty: 'tutorial',
    intro: 'Arrows redirect you. Slide into one and you must obey it.',
    mechanics: ['arrow'],
    par: 1,
    map: [
      'S..v',
      '...E',
    ],
  },
  {
    id: 'tut-4',
    name: 'Chain Reaction',
    world: 0,
    index: 3,
    difficulty: 'tutorial',
    intro: 'A single launch can pass through several arrows. Plan the whole slide.',
    mechanics: ['arrow'],
    par: 1,
    map: [
      'S..v',
      '#...',
      'E..<',
    ],
  },
  {
    id: 'tut-5',
    name: 'Come to Rest',
    world: 0,
    index: 4,
    difficulty: 'tutorial',
    intro: 'A stop pad halts your slide, letting you launch again from a new spot.',
    mechanics: ['stop'],
    par: 2,
    map: [
      'S..O.E',
    ],
  },
  {
    id: 'tut-6',
    name: 'Bounce',
    world: 0,
    index: 5,
    difficulty: 'tutorial',
    intro: 'Mirrors reflect you around corners.',
    mechanics: ['mirror'],
    par: 1,
    map: [
      'S..\\',
      '...E',
    ],
  },
  {
    id: 'tut-7',
    name: 'Not That One',
    world: 0,
    index: 6,
    difficulty: 'tutorial',
    intro: 'Careful — a fake exit only stops you. Find the real one.',
    mechanics: ['fakeExit'],
    par: 1,
    map: [
      'S..X',
      '....',
      'E...',
    ],
  },
  {
    id: 'tut-8',
    name: 'Putting It Together',
    world: 0,
    index: 7,
    difficulty: 'tutorial',
    intro: 'Stop, then let a mirror carry you home.',
    mechanics: ['stop', 'mirror'],
    par: 2,
    map: [
      'S...O',
      '#....',
      'E.../',
    ],
  },
]);
