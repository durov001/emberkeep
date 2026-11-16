// EMBERKEEP — input: keyboard and mouse, read by the game loop once a frame.
// Keys are tracked by code (so WASD and arrows both work), and "pressed"
// edges are consumed once, so a tap never fires twice.

import { VIEW } from './tuning.js';

/** The movement keys, mapped to their axis direction. */
const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.mouseX = VIEW.width / 2;
    this.mouseY = VIEW.height / 2 - 120;
    this.mouseDown = false;
    this.clicked = false;
    this._onKeyDown = (e) => {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    };
    this._onKeyUp = (e) => this.down.delete(e.code);
    this._onMouseMove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - rect.left) / rect.width) * VIEW.width;
      this.mouseY = ((e.clientY - rect.top) / rect.height) * VIEW.height;
    };
    this._onMouseDown = (e) => {
      this._onMouseMove(e);
      this.mouseDown = true;
      this.clicked = true;
    };
    this._onMouseUp = () => { this.mouseDown = false; };
    this._onBlur = () => { this.down.clear(); this.mouseDown = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  /** Is the key held right now? */
  isDown(code) {
    return this.down.has(code);
  }

  /** Was the key tapped since the last frame? Consumes the edge. */
  wasPressed(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  /** Was the mouse clicked since the last frame? Consumes the edge. */
  wasClicked() {
    if (this.clicked) {
      this.clicked = false;
      return true;
    }
    return false;
  }

  /** The movement axis from WASD/arrows, normalized. */
  moveAxis() {
    let x = 0;
    let y = 0;
    for (const code of this.down) {
      const dir = MOVE_KEYS[code];
      if (dir) {
        x += dir[0];
        y += dir[1];
      }
    }
    if (x !== 0 || y !== 0) {
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  /** Clear the edges the frame did not consume, so taps never leak a frame. */
  endFrame() {
    this.pressed.clear();
    this.clicked = false;
  }
}

/** A scripted input stand-in for staged screenshots: same interface, no keys. */
export class ScriptedInput {
  constructor() {
    this.mouseX = VIEW.width / 2 + 180;
    this.mouseY = VIEW.height / 2 - 60;
    this.axis = { x: 0, y: 0 };
  }

  isDown() {
    return false;
  }

  wasPressed() {
    return false;
  }

  wasClicked() {
    return false;
  }

  moveAxis() {
    return this.axis;
  }

  endFrame() {}
}
