import * as THREE from 'three'
import { gsap } from 'gsap'
import type { SceneContext } from './scene'
import { CONFIG } from './config'
import type { CoverUserData, PageGroupUserData, PageMeshUserData, PageSide } from './types'

export function setupInteractions(ctx: SceneContext, frontCover: THREE.Mesh, pageGroups: THREE.Group[]) {
  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()

  function onWindowResize() {
    ctx.camera.aspect = window.innerWidth / window.innerHeight
    ctx.camera.updateProjectionMatrix()
    ctx.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  function onMouseClick(event: MouseEvent) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse, ctx.camera)

    const targets: THREE.Object3D[] = [frontCover, ...pageGroups]
    const intersects = raycaster.intersectObjects(targets, true)
    if (intersects.length === 0) return

    const validTargets = getInteractiveObjects(frontCover, pageGroups)
    for (const hit of intersects) {
      const targetMesh = hit.object as THREE.Mesh
      const root = getRootObject(targetMesh)
      if (!validTargets.includes(root)) continue

      const ud = targetMesh.userData as Partial<CoverUserData & PageMeshUserData>
      if (ud.isCover) {
        toggleCover(targetMesh as THREE.Mesh)
        return
      }
      if (ud.isPageMesh) {
        const group = targetMesh.parent as THREE.Group
        togglePage(group)
        return
      }
    }
  }

  window.addEventListener('resize', onWindowResize)
  window.addEventListener('click', onMouseClick)

  return { dispose: () => {
    window.removeEventListener('resize', onWindowResize)
    window.removeEventListener('click', onMouseClick)
  } }
}

export function makeSetPageTexture(pageGroups: THREE.Group[]) {
  return function setPageTexture(pageIndex: number, texture: THREE.Texture, side: PageSide = 'front') {
    const group = pageGroups.find(g => (g.userData as PageGroupUserData).pageIndex === pageIndex)
    if (!group) return
    const mesh = group.children.find(c => (c.userData as PageMeshUserData).side === side) as THREE.Mesh | undefined
    if (!mesh) return
    if (side === 'back') {
      texture = texture.clone()
      texture.center.set(0.5, 0.5)
      texture.rotation = Math.PI
    }
    const mat = mesh.material as THREE.MeshStandardMaterial
    mat.map = texture
    mat.needsUpdate = true
  }
}

function getRootObject(mesh: THREE.Mesh): THREE.Object3D {
  const ud = mesh.userData as Partial<CoverUserData & PageMeshUserData>
  if (ud.isCover) return mesh
  if (ud.isPageMesh && mesh.parent) return mesh.parent
  return mesh
}

function getInteractiveObjects(frontCover: THREE.Mesh, pageGroups: THREE.Group[]): THREE.Object3D[] {
  const interactive: THREE.Object3D[] = []
  const isOpen = (frontCover.userData as CoverUserData).isOpen

  if (!isOpen) {
    interactive.push(frontCover)
  } else {
    // Right stack top: highest index not flipped
    let topRight: THREE.Group | null = null
    for (let i = pageGroups.length - 1; i >= 0; i--) {
      if (!(pageGroups[i].userData as PageGroupUserData).isFlipped) { topRight = pageGroups[i]; break }
    }
    if (topRight) interactive.push(topRight)

    // Left stack top: lowest index that is flipped
    let topLeft: THREE.Group | null = null
    for (let i = 0; i < pageGroups.length; i++) {
      if ((pageGroups[i].userData as PageGroupUserData).isFlipped) { topLeft = pageGroups[i]; break }
    }
    if (topLeft) interactive.push(topLeft); else interactive.push(frontCover)
  }

  return interactive
}

function toggleCover(mesh: THREE.Mesh) {
  const ud = mesh.userData as CoverUserData
  const pivot = ud.parentPivot
  const isOpen = ud.isOpen

  const targetRot = isOpen ? 0 : Math.PI
  const rightY = CONFIG.coverThickness + CONFIG.pageCount * CONFIG.pageThickness + CONFIG.coverThickness / 2
  const leftY = CONFIG.coverThickness / 2
  const targetY = isOpen ? rightY : leftY

  gsap.to(pivot.rotation, { z: targetRot, duration: CONFIG.animDuration, ease: CONFIG.animEase })
  gsap.to(pivot.position, {
    y: targetY,
    duration: CONFIG.animDuration,
    ease: CONFIG.animEase,
    onComplete: () => { ud.isOpen = !isOpen },
  })
}

function togglePage(group: THREE.Group) {
  const ud = group.userData as PageGroupUserData
  const isFlipped = ud.isFlipped
  const index = ud.pageIndex

  const openRot = Math.PI
  const targetRot = isFlipped ? 0 : openRot
  const EPS = 0.001
  const rightY = CONFIG.coverThickness + index * CONFIG.pageThickness + EPS
  const leftY = CONFIG.coverThickness + (CONFIG.pageCount - 1 - index) * CONFIG.pageThickness + EPS
  const targetY = isFlipped ? rightY : leftY

  gsap.to(group.rotation, { z: targetRot, duration: CONFIG.animDuration, ease: CONFIG.animEase })
  gsap.to(group.position, {
    y: targetY,
    duration: CONFIG.animDuration,
    ease: CONFIG.animEase,
    onComplete: () => { ud.isFlipped = !isFlipped },
  })
}

