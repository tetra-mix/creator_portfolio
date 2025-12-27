import type * as THREE from 'three'
import type { PageSide } from './shared/three/types'

declare global {
  interface Window {
    setPageTexture: (pageIndex: number, texture: THREE.Texture, side?: PageSide) => void
  }
}

export {}
