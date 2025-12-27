import * as THREE from 'three'
import { gsap } from 'gsap'
import type { SceneContext } from './scene'
import { CONFIG } from './config'
import type { CoverUserData, PageGroupUserData, PageMeshUserData, PageSide, TabUserData } from './types'

export function setupInteractions(ctx: SceneContext, frontCover: THREE.Mesh, pageGroups: THREE.Group[], extraTargets: THREE.Object3D[] = []) {
  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()
  let busy = false
  let hoveredTab: THREE.Mesh | null = null
  const HIGHLIGHT = 0xffff88

  function onWindowResize() {
    ctx.camera.aspect = window.innerWidth / window.innerHeight
    ctx.camera.updateProjectionMatrix()
    ctx.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  //

  function computeDesiredFlipsFromObject(obj: THREE.Object3D): number {
    const total = pageGroups.length
    // Walk up to find the page mesh and its group
    let cur: THREE.Object3D | null = obj
    let pageMesh: THREE.Mesh | null = null
    let group: THREE.Group | null = null
    while (cur) {
      const udAny = cur.userData as Partial<PageMeshUserData & PageGroupUserData>
      if ((udAny as PageMeshUserData).isPageMesh && cur instanceof THREE.Mesh) pageMesh = cur as THREE.Mesh
      if ((udAny as PageGroupUserData).pageIndex != null && cur instanceof THREE.Group) { group = cur as THREE.Group; break }
      cur = cur.parent
    }
    if (pageMesh && group) {
      const side = (pageMesh.userData as PageMeshUserData).side
      const gIndex = (group.userData as PageGroupUserData).pageIndex
      // Absolute desired flipped count so that:
      // - front side target is on right stack top: flips = total - 1 - gIndex
      // - back side target is on left stack:      flips = total - gIndex
      const flips = side === 'front' ? (total - 1 - gIndex) : (total - gIndex)
      return Math.max(0, Math.min(total, flips))
    }
    // Fallback: derive from TabUserData if available
    const ud = obj.userData as Partial<TabUserData>
    if (ud && typeof ud.contentIndex === 'number') {
      const p = ud.contentIndex
      const s = Math.floor(p / 2)
      const flips = (p % 2 === 0) ? s : (s + 1)
      return Math.max(0, Math.min(total, flips))
    }
    if (ud && typeof ud.targetFlips === 'number') return Math.max(0, Math.min(total, ud.targetFlips))
    if (ud && typeof ud.targetPageIndex === 'number') return Math.max(0, Math.min(total, ud.targetPageIndex))
    return 0
  }

  function onMouseClick(event: MouseEvent) {
    if (busy) return
    // If a tab is currently hovered, prioritize its navigation.
    if (hoveredTab) {
      const ud = hoveredTab.userData as TabUserData
      if (ud && ud.isTab) {
        const flips = computeDesiredFlipsFromObject(hoveredTab)
        navigateToFlipCount(flips)
        return
      }
    }
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse, ctx.camera)

    const targets: THREE.Object3D[] = [frontCover, ...pageGroups, ...extraTargets]
    const intersects = raycaster.intersectObjects(targets, true)
    if (intersects.length === 0) return

    // Prioritize tabs regardless of occluding pages
    for (const hit of intersects) {
      const ud0 = hit.object.userData as Partial<CoverUserData & PageMeshUserData & TabUserData> & { isTab?: boolean }
      if (ud0.isTab) {
        const flips = computeDesiredFlipsFromObject(hit.object)
        navigateToFlipCount(flips)
        return
      }
    }

    const validTargets = getInteractiveObjects(frontCover, pageGroups)
    for (const hit of intersects) {
      const targetMesh = hit.object as THREE.Mesh
      const ud = targetMesh.userData as Partial<CoverUserData & PageMeshUserData>

      const root = getRootObject(targetMesh)
      if (!validTargets.includes(root)) continue

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

  function countFlipped(): number {
    let c = 0
    for (const g of pageGroups) if ((g.userData as PageGroupUserData).isFlipped) c++
    return c
  }

  function rightTopIndex(): number {
    for (let i = pageGroups.length - 1; i >= 0; i--) {
      if (!(pageGroups[i].userData as PageGroupUserData).isFlipped) return i
    }
    return -1
  }

  function leftTopIndex(): number {
    for (let i = 0; i < pageGroups.length; i++) {
      if ((pageGroups[i].userData as PageGroupUserData).isFlipped) return i
    }
    return -1
  }

  // Flip pages one by one until we reach the desired flip count
  function navigateToFlipCount(desiredFlips: number) {
    const total = pageGroups.length
    const target = Math.max(0, Math.min(total, desiredFlips))
    const dur = CONFIG.animDuration
    const stepDelay = dur + 0.06 // small safety margin
    let delay = 0
    busy = true

    // Ensure cover is open first
    const coverUD = frontCover.userData as CoverUserData
    if (!coverUD.isOpen) {
      toggleCover(frontCover)
      delay += stepDelay
    }

    // Decide direction
    const startFlipped = countFlipped()
    if (target > startFlipped) {
      // flip forward: take from right stack top repeatedly
      for (let k = 0; k < target - startFlipped; k++) {
        gsap.delayedCall(delay, () => {
          const idx2 = rightTopIndex()
          if (idx2 === -1) return
          const g2 = pageGroups[idx2]
          togglePage(g2)
        })
        delay += stepDelay
      }
    } else if (target < startFlipped) {
      // flip backward: take from left stack top repeatedly
      for (let k = 0; k < startFlipped - target; k++) {
        gsap.delayedCall(delay, () => {
          const idx2 = leftTopIndex()
          if (idx2 === -1) return
          const g2 = pageGroups[idx2]
          togglePage(g2)
        })
        delay += stepDelay
      }
    }

    gsap.delayedCall(delay, () => { busy = false })
  }

  function onMouseMove(event: MouseEvent) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse, ctx.camera)

    const hits = raycaster.intersectObjects(extraTargets, true)
    let newHover: THREE.Mesh | null = null
    for (const h of hits) {
      const u = h.object.userData as Partial<TabUserData>
      if (u && u.isTab) {
        const obj = h.object
        let vis: THREE.Mesh | null = null
        if (obj instanceof THREE.Mesh) {
          const mat = obj.material
          if (mat instanceof THREE.MeshStandardMaterial) {
            vis = obj
          }
        }
        if (!vis && obj.parent && obj.parent instanceof THREE.Mesh) {
          vis = obj.parent
        }
        newHover = vis
        break
      }
    }
    if (hoveredTab !== newHover) {
      if (hoveredTab) {
        const udPrev = hoveredTab.userData as TabUserData
        const mPrev = hoveredTab.material as THREE.MeshStandardMaterial
        if (udPrev.baseColor != null) mPrev.color.setHex(udPrev.baseColor)
      }
      hoveredTab = newHover
      if (hoveredTab) {
        const ud = hoveredTab.userData as TabUserData
        const m = hoveredTab.material as THREE.MeshStandardMaterial
        if (ud.baseColor == null) ud.baseColor = (m.color as THREE.Color).getHex()
        m.color.setHex(HIGHLIGHT)
      }
    }
  }

  window.addEventListener('resize', onWindowResize)
  window.addEventListener('click', onMouseClick)
  window.addEventListener('mousemove', onMouseMove)

  return { dispose: () => {
    window.removeEventListener('resize', onWindowResize)
    window.removeEventListener('click', onMouseClick)
    window.removeEventListener('mousemove', onMouseMove)
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

//
