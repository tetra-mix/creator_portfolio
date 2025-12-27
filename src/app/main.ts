import { CONFIG } from '../shared/three/config';
import { bookContent } from '../features/content/bookContent';
import { createScene } from '../shared/three/scene';
import { createBook, createDesk } from '../features/book/book';
import { makeSetPageTexture, setupInteractions } from '../features/interaction/interactions';
import { createTabs } from '../features/book/tabs';
import { createDeskProps } from '../features/book/props';

function init() {
  const app = document.getElementById('app');
  if (!app) return;

  CONFIG.pageCount = Math.max(1, Math.ceil(bookContent.length / 2));

  const ctx = createScene(app);

  createDesk(ctx.scene);
  createDeskProps(ctx.scene);
  const { pageGroups, frontCoverMesh } = createBook(ctx.scene);
  const tabs = createTabs(pageGroups);

  setupInteractions(ctx, frontCoverMesh, pageGroups, tabs);

  ctx.renderer.setAnimationLoop(() => {
    ctx.controls.update();
    ctx.renderer.render(ctx.scene, ctx.camera);
  });

  window.setPageTexture = makeSetPageTexture(pageGroups);
}

init();
