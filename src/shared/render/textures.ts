import * as THREE from 'three';
import {
  preloadMarkdownImages,
  renderMarkdownToCanvas,
  type LinkRect,
} from '../markdown/markdownRenderer';
import { getBookContent } from '../../features/content/state';
import { CONFIG } from '../three/config';
import type { PageSide } from '../three/types';
import { setPageLinks } from '../../features/interaction/linkRegistry';

export function createWoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Background
  ctx.fillStyle = '#DEB887';
  ctx.fillRect(0, 0, 512, 512);

  // Grain
  ctx.fillStyle = '#CD853F';
  for (let i = 0; i < 100; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const w = Math.random() * 200 + 50;
    const h = Math.random() * 2 + 1;
    ctx.fillRect(x, y, w, h);
  }

  // Stripes
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 1;
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * 25 + Math.random() * 10);
    ctx.lineTo(512, i * 25 + Math.random() * 10);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

const pageTextureCache = new Map<string, THREE.CanvasTexture>();

export function createPageTexture(index: number, side: PageSide): THREE.CanvasTexture {
  const key = `${index}:${side}`;
  const cached = pageTextureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  const logicalW = 256;
  const logicalH = 350;
  const scale = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
  canvas.width = Math.floor(logicalW * scale);
  canvas.height = Math.floor(logicalH * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const tex = new THREE.CanvasTexture(canvas);
    pageTextureCache.set(key, tex);
    return tex;
  }
  // High DPI: draw using logical units while the canvas is scaled
  if (scale !== 1) ctx.scale(scale, scale);

  const pageCount = CONFIG.pageCount;
  const logicalIndex = pageCount - 1 - index;
  const contentIndex = side === 'front' ? logicalIndex * 2 : logicalIndex * 2 + 1;
  const content = getBookContent();
  const markdown = content[contentIndex] || '';

  // Initial render (text + placeholders for images)
  const linkRects: LinkRect[] = [];
  renderMarkdownToCanvas(ctx, markdown, logicalW, logicalH, { linkRects });

  // Page number
  const pageNum = contentIndex + 1;
  ctx.fillStyle = '#000';
  ctx.font = '14px Arial';
  ctx.fillText(`${pageNum}`, 120, 330);

  const tex = new THREE.CanvasTexture(canvas);
  if (side === 'back') {
    tex.center.set(0.5, 0.5);
    tex.rotation = Math.PI;
  }
  pageTextureCache.set(key, tex);
  // Persist link rectangles for interactions (click navigation)
  // Scale link rects to physical pixel coordinates
  const scaled = linkRects.map((r) => ({
    x: r.x * scale,
    y: r.y * scale,
    w: r.w * scale,
    h: r.h * scale,
    url: r.url,
  }));
  setPageLinks(index, side, canvas.width, canvas.height, scaled);

  // If markdown includes images, preload them asynchronously and re-render when ready.
  // This keeps current sync API while allowing images.
  (async () => {
    try {
      const images = await preloadMarkdownImages(markdown);
      if (images.size > 0) {
        const linkRects2: LinkRect[] = [];
        renderMarkdownToCanvas(ctx!, markdown, logicalW, logicalH, {
          images,
          linkRects: linkRects2,
        });
        const scaled2 = linkRects2.map((r) => ({
          x: r.x * scale,
          y: r.y * scale,
          w: r.w * scale,
          h: r.h * scale,
          url: r.url,
        }));
        setPageLinks(index, side, canvas.width, canvas.height, scaled2);
        tex.needsUpdate = true;
      }
    } catch {
      // ignore image failures
    }
  })();

  return tex;
}
