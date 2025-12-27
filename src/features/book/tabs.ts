import * as THREE from 'three'
import { CONFIG } from '../../shared/three/config'
import type { TabUserData, PageMeshUserData } from '../../shared/three/types'

// Attach tabs to page groups so they stay parallel to pages and move with flips.
export function createTabs(pageGroups: THREE.Group[]): THREE.Mesh[] {
  if (!CONFIG.tabsEnabled || !CONFIG.tabs?.length) return []
  const { pageWidth, pageHeight } = CONFIG
  const { width, height } = CONFIG.tabSize
  // Compute an offset so tabs are attached to the page edge
  // while ensuring their outer edge extends beyond the cover edge slightly.
  const coverOverhangX = CONFIG.coverOverhangX
  const outsideGap = CONFIG.tabOutsideX

  const tabs: THREE.Mesh[] = []
  for (const t of CONFIG.tabs) {
    // Tabs are configured using 1-based content page numbers for UX.
    // Convert to 0-based index for internal mapping.
    // Navigation operates on spreads (pairs of pages). Map content index -> spread index.
    const contentIndex = Math.max(0, (t.pageIndex ?? 1) - 1)
    const spreadIndex = Math.floor(contentIndex / 2)
    // Physical page group index is reversed relative to logical spread order.
    const groupIndex = pageGroups.length - 1 - spreadIndex
    const group = pageGroups[groupIndex]
    if (!group) continue

    const v = Math.min(1, Math.max(0, t.v ?? 0.5))
    const localZ = (v - 0.5) * pageHeight

    const geo = new THREE.PlaneGeometry(width, height)
    const baseColor = t.color ?? 0xffcc66
    const mat = new THREE.MeshStandardMaterial({ color: baseColor, side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(geo, mat)
    // Make the tab coplanar with the page (page lies in XZ plane)
    mesh.rotation.x = -Math.PI / 2
    // Keep the tab attached to the page: inner edge near page right edge.
    // But ensure the outer edge protrudes past the cover's outer edge by `outsideGap`.
    // Condition: pageWidth + offsetX + width >= (pageWidth + coverOverhangX) + outsideGap
    // => offsetX >= coverOverhangX + outsideGap - width
    const requiredOffset = coverOverhangX + outsideGap - width
    const attachOffsetX = Math.max(CONFIG.tabOffsetX, requiredOffset)
    // Attach to the correct face: even contentIndex -> front, odd -> back
    const side: 'front' | 'back' = (contentIndex % 2 === 0) ? 'front' : 'back'
    // Place relative to the page mesh so the tab stays coplanar to the correct side
    // centerX = pageWidth + (tabWidth/2) + attachOffsetX (from spine to outer edge)
    mesh.position.set(pageWidth + (width / 2) + attachOffsetX, 0.002, localZ)
    // Store both the spread index and the exact target flips so even/odd pages are handled.
    const targetFlips = spreadIndex + (contentIndex % 2 === 1 ? 1 : 0)
    ;(mesh.userData as TabUserData) = {
      isTab: true,
      targetPageIndex: spreadIndex,
      label: t.label,
      baseColor,
      contentIndex,
      targetFlips,
    }
    mesh.name = `tab:${t.label ?? t.pageIndex}`
    mesh.castShadow = true
    mesh.receiveShadow = true
    // Optional larger hitbox to make clicking easier
    const hW = t.hitWidth ?? width
    const hH = t.hitHeight ?? height
    if (hW > width || hH > height) {
      const hitGeo = new THREE.PlaneGeometry(hW, hH)
      const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
      const hit = new THREE.Mesh(hitGeo, hitMat)
      hit.rotation.x = -Math.PI / 2
      hit.position.set(0, 0.001, 0) // slightly above the visual tab to avoid z-fighting
      ;(hit.userData as TabUserData) = {
        isTab: true,
        targetPageIndex: spreadIndex,
        label: t.label,
        baseColor,
        contentIndex,
        targetFlips,
      }
      hit.name = `${mesh.name}:hit`
      mesh.add(hit)
    }
    // Parent to the matching page mesh for correct “side” association
    const anchor = group.children.find(c => (c as THREE.Mesh).userData && (c as THREE.Mesh).userData.isPageMesh && ((c as THREE.Mesh).userData as PageMeshUserData).side === side) as THREE.Mesh | undefined
    if (anchor) anchor.add(mesh)
    else group.add(mesh)
    tabs.push(mesh)
  }
  return tabs
}
