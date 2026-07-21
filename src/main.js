import './style.css';
import { Game } from './game/Game.js';
import { mountUI } from './ui.js';

const app = document.getElementById('app');

const game = new Game(null, { pixelation: 0.45, sensitivity: 2.2, enableSound: true });
const { mount } = mountUI(app, game);

// mountUI builds the .viewport div that Three.js renders into — grab it now that it exists.
game.mountEl = app.querySelector('.viewport');
mount();
