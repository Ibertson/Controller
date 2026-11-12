/** Reduz uma imagem no navegador e devolve JPEG em data URL (recorta no centro para a proporção pedida). */
export function resizeImage(file: File, width: number, height: number, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) { reject(new Error("Escolha um arquivo de imagem.")); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ratio = width / height;
      let sw = img.width, sh = img.width / ratio;
      if (sh > img.height) { sh = img.height; sw = img.height * ratio; }
      const c = document.createElement("canvas");
      c.width = width; c.height = height;
      c.getContext("2d")!.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não deu para abrir essa imagem.")); };
    img.src = url;
  });
}
