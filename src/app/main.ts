import * as THREE from 'three';
import { CONFIG } from '../shared/three/config';
import { loadBookContent } from '../features/content/loader';
import { setBookContent } from '../features/content/state';
import { createScene } from '../shared/three/scene';
import { createBook, createDesk } from '../features/book/book';
import { makeSetPageTexture, setupInteractions } from '../features/interaction/interactions';
import { createTabs } from '../features/book/tabs';
import { createDeskProps } from '../features/book/props';
import { addM5StackChan } from '../features/book/m5stackchan';

async function init() {
  const app = document.getElementById('app');
  if (!app) return;

  const content = await loadBookContent();
  setBookContent(content);
  CONFIG.pageCount = Math.max(1, Math.ceil(content.length / 2));

  const ctx = createScene(app);

  createDesk(ctx.scene);
  createDeskProps(ctx.scene);
  const { pageGroups, frontCoverMesh } = createBook(ctx.scene);
  const tabs = createTabs(pageGroups);

  // Load Blender props asynchronously so they never block first paint.
  // Guard against any sync failure so it can't tear down the render loop.
  try {
    addM5StackChan(ctx);
  } catch (err) {
    console.error('[main] failed to add Blender props', err);
  }

  setupInteractions(ctx, frontCoverMesh, pageGroups, tabs);

  const clock = new THREE.Clock();
  ctx.renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    ctx.controls.update();
    ctx.runUpdaters(delta);
    ctx.renderer.render(ctx.scene, ctx.camera);
  });

  window.setPageTexture = makeSetPageTexture(pageGroups);
}

init();
