import './style.css';
import { Game } from './game/Game.js';
import { mountUI } from './ui.js';
import { isTouchDevice, mountN64Controls } from './ui/touchControls.js';

const app = document.getElementById('app');
const touch = isTouchDevice();

const game = new Game(null, { pixelation: touch ? 0.4 : 0.45, sensitivity: 2.2, enableSound: true });
const { mount } = mountUI(app, game);

// mountUI builds the .viewport div that Three.js renders into — grab it now that it exists.
game.mountEl = app.querySelector('.viewport');
// GoldenEye stick is universal — always mount (pointer events work with mouse + touch).
mountN64Controls(app, game);
mount();
