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

