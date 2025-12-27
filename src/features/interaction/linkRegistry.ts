import type { PageSide } from '../../shared/three/types'
import type { LinkRect } from '../../shared/markdown/markdownRenderer'

type Key = string
function key(pageIndex: number, side: PageSide): Key { return `${pageIndex}:${side}` }

type PageLinks = { w: number; h: number; rects: LinkRect[] }

const registry = new Map<Key, PageLinks>()

export function setPageLinks(pageIndex: number, side: PageSide, w: number, h: number, rects: LinkRect[]) {
  registry.set(key(pageIndex, side), { w, h, rects: rects.slice() })
}

export function findLinkAt(pageIndex: number, side: PageSide, u: number, v: number): string | null {
  const entry = registry.get(key(pageIndex, side))
  if (!entry) return null
  const px = u * entry.w
  const py = (1 - v) * entry.h // UV y=0 at bottom -> canvas y=0 at top
  for (const r of entry.rects) {
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r.url
  }
  return null
}

