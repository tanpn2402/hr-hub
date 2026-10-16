// Turns a picked file into a small JPEG data URL (the event, images included, is one hrhub.data value capped at 1 MB).
import { MAX_IMAGE_CHARS } from './quiz.js';

const MAX_SIDE = 960;

/** Resolves with a data URL no longer than MAX_IMAGE_CHARS, or rejects with a Vietnamese message. */
export async function imageToDataUrl(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Hãy chọn một file hình ảnh.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Không đọc được hình ảnh này.'));
      el.src = url;
    });
    let scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    for (let attempt = 0; attempt < 6; attempt++) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; // JPEG has no transparency
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.8, 0.65, 0.5]) {
        const data = canvas.toDataURL('image/jpeg', quality);
        if (data.length <= MAX_IMAGE_CHARS) return data;
      }
      scale *= 0.75;
    }
    throw new Error('Hình ảnh quá lớn, hãy chọn ảnh nhỏ hơn.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Downloads an image link (it must allow cross-origin requests, as Wikimedia does) and shrinks it like a picked file. */
export async function imageUrlToDataUrl(url) {
  let blob;
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) throw new Error(String(response.status));
    blob = await response.blob();
  } catch {
    throw new Error('Không tải được hình từ link (link sai hoặc trang không cho phép).');
  }
  return imageToDataUrl(blob);
}
