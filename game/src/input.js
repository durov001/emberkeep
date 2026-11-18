// Keyboard + mouse state. Keys are tracked by e.code so WASD and arrows both
// work; edge-triggered actions (dash, nova, kindle, pause) are consumed once
// per press via pressed().

export function createInput(canvas) {
  const keys = new Set();
  const justPressed = new Set();
  const mouse = { x: 640, y: 360, down: false };

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    justPressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
    mouse.y = ((e.clientY - r.top) / r.height) * canvas.height;
  }
  function onMouseDown() {
    mouse.down = true;
  }
  function onMouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    mouse,
    down(code) {
      return keys.has(code);
    },
    pressed(code) {
      return justPressed.has(code);
    },
    // Movement vector from WASD / arrows, normalized.
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.SQRT2;
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    endFrame() {
      justPressed.clear();
    },
  };
}
