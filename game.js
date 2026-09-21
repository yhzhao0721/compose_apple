/* global Matter */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const canvas = $("game-canvas"), ctx = canvas.getContext("2d");
  const overlay = $("overlay"), overlayButton = $("overlay-button");
  const W = 520, H = 700, LEFT = 30, RIGHT = 490, FLOOR = 665, DANGER = 160;
  const RANDOM_CHARACTER_COUNT = 9, DROP_COOLDOWN_MS = 280, PHYSICS_SPEED = 2;
  const RADII = [15, 20, 27, 35, 45, 55, 66, 78, 91, 121];
  const POINTS = [1, 3, 6, 10, 15, 21, 28, 36, 45, 70];
  const NAMES = ["阿噗噜派", "大哥", "哐哐哐", "莎草妈妈", "小蛋糕", "一只小兔兔", "csy", "dcy", "mon3tr", "omni", "tt", "wc", "wsy", "zbra", "zdx"];
  const images = new Map();
  let levels = [], score = 0, best = 0, next = 0, aim = W / 2;
  let mode = "loading", cooldown = 0, dangerTime = 0, won = false;
  let activePointer = null, activeTouch = null, dpr = 1, lastTime = 0, accumulator = 0;
  let engine, mergeQueue = [], animation, lastTouchTime = 0;
  const STEP = 1000 / 60;
  try { best = Math.max(0, Number(localStorage.getItem("composeAppleBest")) || 0); } catch (_) { /* Storage can be unavailable in private browsers. */ }
  $("best-score").textContent = best;
  function showOverlay(title, text, button) {
    $("overlay-title").textContent = title; $("overlay-text").textContent = text;
    overlayButton.textContent = button || ""; overlayButton.hidden = !button;
    $("cancel-restart").hidden = mode !== "confirm"; overlay.hidden = false;
    if (button) overlayButton.focus({ preventScroll: true });
  }
  if (!window.Matter || !ctx) {
    showOverlay("游戏资源没有加载成功", "请重新打开页面，或确认游戏文件已完整复制。", "重新加载");
    overlayButton.onclick = () => location.reload(); return;
  }
  const { Engine, Bodies, Body, Composite, Events } = Matter;
  engine = Engine.create({ gravity: { y: 1.05, scale: .001 }, enableSleeping: false });
  function shuffledRound() {
    const pool = NAMES.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, RANDOM_CHARACTER_COUNT).concat("苹果乐");
  }
  function randomLevel() { const r = Math.random(); return r < .68 ? 0 : r < .91 ? 1 : 2; }
  function imagePath(name) { return "assets/characters/" + encodeURIComponent(name) + ".jpg"; }
  function setImage(element, name) { element.src = imagePath(name); element.alt = name; element.draggable = false; }
  function updatePreview() { setImage($("next-image"), levels[next]); $("next-name").textContent = levels[next]; }
  function updateLineup() {
    $("lineup").textContent = "";
    levels.forEach((name, i) => {
      const li = document.createElement("li"), image = new Image(), label = document.createElement("span");
      setImage(image, name); label.textContent = `${i + 1}. ${name}`;
      li.append(image, label); $("lineup").append(li);
    });
  }
  function resetRound() {
    Composite.clear(engine.world, false); Engine.clear(engine);
    Composite.add(engine.world, [
      Bodies.rectangle(W / 2, FLOOR + 25, RIGHT - LEFT + 60, 50, { isStatic: true }),
      Bodies.rectangle(LEFT - 25, H / 2, 50, H * 3, { isStatic: true }),
      Bodies.rectangle(RIGHT + 25, H / 2, 50, H * 3, { isStatic: true })
    ]);
    levels = shuffledRound(); score = 0; cooldown = 0; dangerTime = 0; won = false;
    mergeQueue = []; activePointer = null; activeTouch = null; aim = W / 2; next = randomLevel();
    $("score").textContent = "0"; $("status").textContent = "本局阵容已就位，向苹果乐出发！";
    updatePreview(); updateLineup(); resume();
  }
  function resume() {
    mode = "playing"; overlay.hidden = true; accumulator = 0; lastTime = 0;
    $("pause-button").textContent = "暂停"; canvas.focus({ preventScroll: true });
  }
  function pause() {
    if (mode !== "playing") return;
    mode = "paused"; activePointer = null; activeTouch = null; accumulator = 0;
    $("pause-button").textContent = "继续";
    showOverlay("休息一下", "回来时，朋友们还在原地等你。", "继续游戏");
  }
  function fruit(x, y, level) {
    const r = RADII[level];
    const body = Bodies.circle(Math.max(LEFT + r, Math.min(RIGHT - r, x)), Math.min(y, FLOOR - r), r,
      { restitution: .18, friction: .3, frictionStatic: .6, frictionAir: .02, density: .0014, label: "fruit" });
    body.game = { level, born: engine.timing.timestamp, merging: false }; return body;
  }
  function drop() {
    if (mode !== "playing" || cooldown > 0) return;
    Composite.add(engine.world, fruit(aim, 65, next)); cooldown = DROP_COOLDOWN_MS; next = randomLevel(); updatePreview();
  }
  function queueCollisions(event) {
    if (mode !== "playing") return;
    event.pairs.forEach(({ bodyA: a, bodyB: b }) => {
      if (!a.game || !b.game || a.game.merging || b.game.merging || a.game.level !== b.game.level || a.game.level >= levels.length - 1) return;
      a.game.merging = b.game.merging = true; mergeQueue.push([a, b]);
    });
  }
  Events.on(engine, "collisionStart", queueCollisions);
  Events.on(engine, "collisionActive", queueCollisions);
  // Defer world changes until the solver finishes; each body can merge once per step.
  Events.on(engine, "afterUpdate", () => {
    const queue = mergeQueue; mergeQueue = [];
    queue.forEach(([a, b]) => {
      const level = a.game.level + 1;
      const upgraded = fruit((a.position.x + b.position.x) / 2, (a.position.y + b.position.y) / 2, level);
      Body.setVelocity(upgraded, { x: (a.velocity.x + b.velocity.x) / 2, y: (a.velocity.y + b.velocity.y) / 2 });
      Composite.remove(engine.world, a); Composite.remove(engine.world, b); Composite.add(engine.world, upgraded);
      score += POINTS[level]; $("score").textContent = score;
      if (score > best) { best = score; $("best-score").textContent = best; try { localStorage.setItem("composeAppleBest", String(best)); } catch (_) {} }
      if (level === levels.length - 1 && !won) { won = true; $("status").textContent = "🍎 合成苹果乐啦！可以继续挑战更高分。"; }
    });
  });
  function tick() {
    // Two stable physics steps per gameplay tick: the same fall takes half the time.
    // Cooldown and danger timers still advance once, in unaccelerated gameplay time.
    for (let step = 0; step < PHYSICS_SPEED; step++) Engine.update(engine, STEP);
    cooldown = Math.max(0, cooldown - STEP);
    const unsafe = Composite.allBodies(engine.world).some(b => b.game && !b.game.merging && (engine.timing.timestamp - b.game.born) / PHYSICS_SPEED > 2800 && b.position.y - b.circleRadius < DANGER && Math.abs(b.velocity.y) < 1.5);
    dangerTime = unsafe ? dangerTime + STEP : Math.max(0, dangerTime - STEP * 2);
    if (dangerTime > 1500) {
      mode = "ended"; activePointer = null; activeTouch = null;
      showOverlay("这一局，收获满满", `本局 ${score} 分 · 最佳 ${best} 分。再抽九位朋友，重新出发吧。`, "再来一局");
    }
  }
  function paintImage(name, x, y, radius, alpha = 1) {
    const image = images.get(name);
    ctx.save(); ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = "#efd8b6"; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    if (image && image.naturalWidth) {
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, x - radius, y - radius, radius * 2, radius * 2);
    } else { ctx.fillStyle = "#754e38"; ctx.font = "14px sans-serif"; ctx.textAlign = "center"; ctx.fillText(name || "?", x, y + 5); }
    ctx.restore(); ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.strokeStyle = "#71512e33"; ctx.lineWidth = 1.5; ctx.stroke();
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#fffdf6"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#f8eddb"; ctx.fillRect(0, 0, W, DANGER);
    ctx.strokeStyle = dangerTime > 0 ? "#db382a" : "#cc8976"; ctx.lineWidth = dangerTime > 0 ? 3 : 2;
    ctx.setLineDash([7, 7]); ctx.beginPath(); ctx.moveTo(LEFT, DANGER); ctx.lineTo(RIGHT, DANGER); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#b16652"; ctx.font = "13px sans-serif"; ctx.textAlign = "right";
    ctx.fillText(dangerTime > 0 ? "小心！快超过危险线了" : "危险线", RIGHT - 8, DANGER - 10);
    ctx.fillStyle = "#b7c891"; ctx.fillRect(LEFT, FLOOR, RIGHT - LEFT, H - FLOOR);
    ctx.fillStyle = "#d8c29f"; ctx.fillRect(LEFT - 5, 0, 5, H); ctx.fillRect(RIGHT, 0, 5, H);
    Composite.allBodies(engine.world).forEach(b => { if (b.game && !b.game.merging) paintImage(levels[b.game.level], b.position.x, b.position.y, b.circleRadius); });
    if (mode === "playing") {
      const r = RADII[next], x = Math.max(LEFT + r, Math.min(RIGHT - r, aim));
      ctx.save(); ctx.strokeStyle = "#be9d6970"; ctx.setLineDash([4, 7]); ctx.beginPath(); ctx.moveTo(x, 65 + r); ctx.lineTo(x, FLOOR); ctx.stroke(); ctx.restore();
      paintImage(levels[next], x, 65, r, cooldown > 0 ? .35 : .75);
    }
  }
  function frame(time) {
    if (mode === "playing") {
      if (lastTime) accumulator += Math.min(time - lastTime, 100);
      while (accumulator >= STEP && mode === "playing") { tick(); accumulator -= STEP; }
    }
    lastTime = time; draw(); animation = requestAnimationFrame(frame);
  }
  function setAim(clientX) { const rect = canvas.getBoundingClientRect(); aim = Math.max(LEFT, Math.min(RIGHT, (clientX - rect.left) * W / rect.width)); }
  if (window.PointerEvent) {
    canvas.addEventListener("pointerdown", e => {
      if (mode !== "playing" || !e.isPrimary || e.button !== 0 || activePointer !== null) return;
      activePointer = e.pointerId; setAim(e.clientX); canvas.setPointerCapture(e.pointerId); e.preventDefault();
    });
    canvas.addEventListener("pointermove", e => { if (e.pointerId === activePointer || (e.pointerType === "mouse" && activePointer === null)) setAim(e.clientX); });
    canvas.addEventListener("pointerup", e => { if (e.pointerId !== activePointer) return; activePointer = null; setAim(e.clientX); drop(); });
    const cancel = () => { activePointer = null; };
    canvas.addEventListener("pointercancel", cancel); canvas.addEventListener("lostpointercapture", cancel);
  } else {
    canvas.addEventListener("touchstart", e => { e.preventDefault(); lastTouchTime = Date.now(); if (mode !== "playing" || activeTouch !== null || e.touches.length !== 1) return; activeTouch = e.changedTouches[0].identifier; setAim(e.changedTouches[0].clientX); }, { passive: false });
    canvas.addEventListener("touchmove", e => { e.preventDefault(); const touch = Array.from(e.touches).find(t => t.identifier === activeTouch); if (touch) setAim(touch.clientX); }, { passive: false });
    canvas.addEventListener("touchend", e => { e.preventDefault(); lastTouchTime = Date.now(); const touch = Array.from(e.changedTouches).find(t => t.identifier === activeTouch); if (!touch) return; activeTouch = null; setAim(touch.clientX); drop(); }, { passive: false });
    canvas.addEventListener("touchcancel", () => { activeTouch = null; });
    canvas.addEventListener("click", e => { if (Date.now() - lastTouchTime < 1000) return; setAim(e.clientX); drop(); });
  }
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.addEventListener("keydown", e => {
    if (mode !== "playing") return;
    if (["ArrowLeft", "ArrowRight", " ", "Enter"].includes(e.key)) e.preventDefault();
    if (e.key === "ArrowLeft") aim = Math.max(LEFT, aim - 15);
    if (e.key === "ArrowRight") aim = Math.min(RIGHT, aim + 15);
    if ((e.key === " " || e.key === "Enter") && !e.repeat) drop();
    if (e.key === "Escape") pause();
  });
  $("pause-button").onclick = () => { if (mode === "paused") resume(); else pause(); };
  $("restart-button").onclick = () => {
    if (mode === "loading" || mode === "error") return;
    if (mode === "playing" || mode === "paused") {
      pause(); mode = "confirm";
      showOverlay("换一组新朋友？", "本局进度会清空，重新随机抽取九位朋友。", "确认换一局");
    } else if (mode !== "confirm") resetRound();
  };
  $("cancel-restart").onclick = resume;
  overlayButton.onclick = () => { if (mode === "paused") resume(); else resetRound(); };
  // Keep the physics world fixed. Only CSS display size and backing-store density change.
  function resize() {
    activePointer = null; activeTouch = null;
    const viewport = window.visualViewport;
    if (viewport && viewport.scale > 1.01) return;
    const height = viewport ? viewport.height : window.innerHeight;
    const toolbarTop = document.querySelector(".game-toolbar").getBoundingClientRect().top + window.scrollY;
    const available = Math.max(250, height - toolbarTop - 115);
    const scale = Number($("display-size").value);
    document.documentElement.style.setProperty("--board-width", Math.round(Math.min(520, available * W / H) * scale) + "px");
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); draw();
  }
  $("display-size").onchange = resize;
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => { pause(); resize(); });
  if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { pause(); cancelAnimationFrame(animation); }
    else { lastTime = 0; cancelAnimationFrame(animation); animation = requestAnimationFrame(frame); resize(); }
  });
  window.addEventListener("pagehide", pause);
  window.addEventListener("pageshow", () => { lastTime = 0; resize(); });
  resize(); animation = requestAnimationFrame(frame);
  Promise.all(NAMES.concat("苹果乐").map(name => new Promise(resolve => {
    const image = new Image(); images.set(name, image);
    let settled = false;
    const finish = ok => { if (settled) return; settled = true; clearTimeout(timer); resolve(ok); };
    const timer = setTimeout(() => finish(false), 10000);
    image.onload = () => finish(true); image.onerror = () => finish(false); image.src = imagePath(name);
  }))).then(results => {
    if (results.some(ok => !ok)) {
      mode = "error"; showOverlay("部分图片没有加载成功", "请检查网络或重新打开页面，加载完整图片后再开始。", "重新加载"); overlayButton.onclick = () => location.reload();
    } else {
      mode = "ready"; $("status").textContent = "15 位朋友随机登场，苹果乐始终压轴。";
      showOverlay("一起合成苹果乐", "按住画面左右拖动，松手投放。相同头像碰在一起，就能长大一级。", "开始游戏");
    }
  });
})();
