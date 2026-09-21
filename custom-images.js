/* Local-only image decoding. Full-size photos are released after a square thumbnail is made. */
(() => {
  "use strict";
  let sequence = 0;
  function decode(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const timer = setTimeout(() => finish(new Error("图片读取超时")), 15000);
      function finish(error) {
        clearTimeout(timer); image.onload = image.onerror = null;
        if (error) reject(error); else resolve(image);
      }
      image.onload = () => finish();
      image.onerror = () => finish(new Error("无法读取图片，请使用浏览器支持的图片格式"));
      image.src = src;
    });
  }
  async function load(files, minimum) {
    if (files.length < minimum) throw new Error(`请至少选择 ${minimum} 张过程图片，目前选了 ${files.length} 张。`);
    const entries = [];
    // Decode sequentially so a large selection does not decode all original photos at once.
    for (const file of files) {
      if (file.type && !file.type.startsWith("image/")) throw new Error(`「${file.name}」不是图片。`);
      const url = URL.createObjectURL(file);
      try {
        const original = await decode(url);
        const side = Math.min(original.naturalWidth, original.naturalHeight);
        if (!side) throw new Error("图片尺寸无效");
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = Math.min(side, 512);
        canvas.getContext("2d").drawImage(original, (original.naturalWidth - side) / 2, (original.naturalHeight - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
        const image = await decode(canvas.toDataURL("image/png"));
        entries.push({ id: `custom-${++sequence}`, name: file.name.replace(/\.[^.]+$/, "") || "自定义图片", image });
      } catch (error) {
        throw new Error(`「${file.name}」读取失败：${error.message}`);
      } finally { URL.revokeObjectURL(url); }
    }
    return entries;
  }
  window.customImages = { load };
})();
