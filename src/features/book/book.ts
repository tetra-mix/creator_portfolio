import * as THREE from 'three'
import { CONFIG } from '../../shared/three/config'
import { createWoodTexture, createPageTexture } from '../../shared/render/textures'
import type { CoverUserData, PageGroupUserData, PageMeshUserData } from '../../shared/three/types'

export interface BookBuild {
  bookGroup: THREE.Group
  frontCoverMesh: THREE.Mesh
  pageGroups: THREE.Group[]
}

export function createDesk(scene: THREE.Scene): void {
  const geometry = new THREE.PlaneGeometry(20, 20)
  const material = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.7, metalness: 0.05 })
  const texture = createWoodTexture()
  material.map = texture
  material.color.setHex(0xffffff)
  if (material.map) {
    material.map.center.set(0.5, 0.5)
    material.map.rotation = CONFIG.woodRotation
    material.map.needsUpdate = true
  }
  const desk = new THREE.Mesh(geometry, material)
  desk.rotation.x = CONFIG.deskRotationX
  desk.receiveShadow = true
  scene.add(desk)
}

export function createBook(scene: THREE.Scene): BookBuild {
  const { pageWidth, pageHeight, coverThickness, pageCount, pageThickness } = CONFIG
  const bookGroup = new THREE.Group()
  scene.add(bookGroup)

  // Back cover
  const coverWidth = pageWidth + CONFIG.coverOverhangX
  const coverDepth = pageHeight + CONFIG.coverOverhangZ
  const backCoverGeo = new THREE.BoxGeometry(coverWidth, coverThickness, coverDepth)
  const coverMat = new THREE.MeshStandardMaterial({ color: CONFIG.bookCoverColor, roughness: 0.6, metalness: 0.08 })
  const backCover = new THREE.Mesh(backCoverGeo, coverMat)
  // Pivot沿い（x=0）に背表紙を合わせるため半幅分だけ+Xへ
  backCover.position.set(coverWidth / 2, coverThickness / 2, 0)
  backCover.castShadow = true
  backCover.receiveShadow = true
  bookGroup.add(backCover)

  // Front cover with pivot
  const frontCoverGeo = new THREE.BoxGeometry(coverWidth, coverThickness, coverDepth)
  const frontCoverMesh = new THREE.Mesh(frontCoverGeo, coverMat)
  frontCoverMesh.position.set(coverWidth / 2, 0, 0)
  frontCoverMesh.castShadow = true
  const frontCoverPivot = new THREE.Group()
  frontCoverPivot.add(frontCoverMesh)
  const totalThickness = coverThickness + pageCount * pageThickness + coverThickness / 2
  frontCoverPivot.position.set(0, totalThickness, 0)
  ;(frontCoverMesh.userData as CoverUserData) = { isCover: true, isOpen: false, parentPivot: frontCoverPivot }
  bookGroup.add(frontCoverPivot)

  // Pages
  const pageGroups: THREE.Group[] = []
  const pageGeo = new THREE.PlaneGeometry(pageWidth, pageHeight)
  pageGeo.rotateX(-Math.PI / 2)
  pageGeo.translate(pageWidth / 2, 0, 0)
  const EPS = 0.001

  for (let i = 0; i < pageCount; i++) {
    const pageGroup = new THREE.Group()

    const frontMat = new THREE.MeshStandardMaterial({ color: CONFIG.pageColor, side: THREE.FrontSide, roughness: 0.85, metalness: 0.0 })
    const frontMesh = new THREE.Mesh(pageGeo, frontMat)
    frontMesh.castShadow = true
    frontMesh.receiveShadow = true
    ;(frontMesh.userData as PageMeshUserData) = { isPageMesh: true, side: 'front' }

    const backMat = new THREE.MeshStandardMaterial({ color: CONFIG.pageColor, side: THREE.FrontSide, roughness: 0.85, metalness: 0.0 })
    const backMesh = new THREE.Mesh(pageGeo, backMat)
    backMesh.rotation.x = Math.PI
    backMesh.castShadow = true
    backMesh.receiveShadow = true
    ;(backMesh.userData as PageMeshUserData) = { isPageMesh: true, side: 'back' }

    // Textures
    frontMat.map = createPageTexture(i, 'front')
    backMat.map = createPageTexture(i, 'back')

    pageGroup.add(frontMesh)
    pageGroup.add(backMesh)

    const yPos = coverThickness + i * pageThickness + EPS
    pageGroup.position.set(0, yPos, 0)
    ;(pageGroup.userData as PageGroupUserData) = { pageIndex: i, isFlipped: false }
    bookGroup.add(pageGroup)
    pageGroups.push(pageGroup)
  }

  return { bookGroup, frontCoverMesh, pageGroups }
}
