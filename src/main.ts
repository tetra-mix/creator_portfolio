import { CONFIG } from './config'
import { bookContent } from './bookContent'
import { createScene } from './scene'
import { createBook, createDesk } from './book'
import { makeSetPageTexture, setupInteractions } from './interactions'
import { createDeskProps } from './props'

function init() {
  const app = document.getElementById('app')
  if (!app) return

  CONFIG.pageCount = Math.max(1, Math.ceil(bookContent.length / 2))

  const ctx = createScene(app)

  createDesk(ctx.scene)
  createDeskProps(ctx.scene)
  const { pageGroups, frontCoverMesh } = createBook(ctx.scene)

  setupInteractions(ctx, frontCoverMesh, pageGroups)

  ctx.renderer.setAnimationLoop(() => {
    ctx.controls.update()
    ctx.renderer.render(ctx.scene, ctx.camera)
  })

  ;(window as any).setPageTexture = makeSetPageTexture(pageGroups)
}

init()
