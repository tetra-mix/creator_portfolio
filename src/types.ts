import * as THREE from 'three'

export type PageSide = 'front' | 'back'

export interface CoverUserData {
  isCover: true
  isOpen: boolean
  parentPivot: THREE.Group
}

export interface PageMeshUserData {
  isPageMesh: true
  side: PageSide
}

export interface PageGroupUserData {
  pageIndex: number
  isFlipped: boolean
}

export type AnyUserData = Partial<CoverUserData & PageMeshUserData & PageGroupUserData>

export interface TabUserData {
  isTab: true
  targetPageIndex: number
  label?: string
  baseColor?: number
  // Optional: content page index this tab represents (0-based)
  contentIndex?: number
  // Optional: exact target flips (number of pages to be flipped to left)
  targetFlips?: number
}
