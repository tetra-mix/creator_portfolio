import * as THREE from 'three';
import {
  preloadMarkdownImages,
  renderMarkdownToCanvas,
  type LinkRect,
} from '../markdown/markdownRenderer';
import { bookContent } from '../../features/content/bookContent';
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
  canvas.width = 256;
  canvas.height = 350;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const tex = new THREE.CanvasTexture(canvas);
    pageTextureCache.set(key, tex);
    return tex;
  }

  const pageCount = CONFIG.pageCount;
  const logicalIndex = pageCount - 1 - index;
  const contentIndex = side === 'front' ? logicalIndex * 2 : logicalIndex * 2 + 1;
  const markdown = bookContent[contentIndex] || '';

  // Initial render (text + placeholders for images)
  const linkRects: LinkRect[] = [];
  renderMarkdownToCanvas(ctx, markdown, canvas.width, canvas.height, { linkRects });

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
  setPageLinks(index, side, canvas.width, canvas.height, linkRects);

  // If markdown includes images, preload them asynchronously and re-render when ready.
  // This keeps current sync API while allowing images.
  (async () => {
    try {
      const images = await preloadMarkdownImages(markdown);
      if (images.size > 0) {
        const linkRects2: LinkRect[] = [];
        renderMarkdownToCanvas(ctx!, markdown, canvas.width, canvas.height, {
          images,
          linkRects: linkRects2,
        });
        setPageLinks(index, side, canvas.width, canvas.height, linkRects2);
        tex.needsUpdate = true;
      }
    } catch {
      // ignore image failures
    }
  })();

  return tex;
}
