(() => {
  "use strict";
  const audio = document.getElementById("victory-audio");
  const button = document.getElementById("victory-audio-button");
  const status = document.getElementById("victory-audio-status");
  const controls = document.getElementById("victory-audio-controls");
  let unlocked = false, priming = false, achieved = false, autoPaused = false, generation = 0;
  audio.volume = .7;
  function update() {
    button.disabled = !achieved;
    button.textContent = "播放";
  }
  function reset() {
    generation++; achieved = false; autoPaused = false; priming = false;
    audio.pause(); audio.muted = false;
    try { audio.currentTime = 0; } catch (_) {}
    controls.hidden = true; status.textContent = ""; update();
  }
  // Prime this same media element in the Start/Resume click gesture.
  // Browsers may still reject later playback; keep an explicit play button available.
  function unlock() {
    if (achieved) { if (autoPaused) play(false); return; }
    if (unlocked || priming) return;
    priming = true; const token = ++generation; audio.muted = true;
    let result;
    try { result = audio.play(); } catch (_) { priming = false; audio.muted = false; return; }
    Promise.resolve(result).then(() => {
      if (token !== generation) return;
      audio.pause(); audio.currentTime = 0; audio.muted = false;
      unlocked = true; priming = false; update();
    }).catch(() => {
      if (token !== generation) return;
      priming = false; audio.muted = false;
    });
  }
  function play(fromStart = true) {
    achieved = true; autoPaused = false; priming = false;
    const token = ++generation; audio.muted = false; audio.playbackRate = 1;
    if (fromStart || audio.ended) { try { audio.currentTime = 0; } catch (_) {} }
    button.disabled = false; controls.hidden = true; status.textContent = "";
    let result;
    try { result = audio.play(); } catch (error) { failed(error, token); return; }
    Promise.resolve(result).then(() => {
      if (token !== generation) return;
      // A hidden page must never start late after buffering.
      if (document.hidden) { pause(); return; }
      unlocked = true; controls.hidden = true; status.textContent = ""; update();
    }).catch(error => failed(error, token));
  }
  function failed(error, token) {
    if (token !== generation) return;
    controls.hidden = false;
    status.textContent = error && error.name === "NotAllowedError"
      ? "浏览器需要确认，请点播放按钮。" : "音乐未能播放，可点击按钮重试。";
    update();
  }
  function pause() {
    if (!achieved) return;
    autoPaused = !audio.paused || autoPaused;
    generation++; audio.pause(); update();
  }
  button.addEventListener("click", () => {
    if (!achieved) return;
    if (audio.paused) play(false);
    else { generation++; autoPaused = false; audio.pause(); status.textContent = "音乐已暂停。"; update(); }
  });
  audio.addEventListener("ended", () => { autoPaused = false; controls.hidden = true; status.textContent = ""; update(); });
  audio.addEventListener("error", () => { if (achieved) { controls.hidden = false; status.textContent = "音乐加载失败，可点击按钮重试。"; update(); } });
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
  window.addEventListener("pagehide", pause);
  window.victorySound = { reset, unlock, play, pause };
  update();
})();
