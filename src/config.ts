import * as THREE from 'three'

export const CONFIG = {
  // カメラ位置（少し斜めの俯瞰）
  cameraPos: new THREE.Vector3(0, 7, 5),
  deskColor: 0x8b4513,
  bookCoverColor: 0xa83a07,
  pageColor: 0xfffaf0,
  pageCount: 0, // to be set at runtime based on content
  pageWidth: 3,
  pageHeight: 4,
  pageThickness: 0.02,
  coverThickness: 0.1,
  // 表紙サイズの余白（ページよりわずかに大きく）
  coverOverhangX: 0.12, // 外側方向（背表紙側はフラットのまま）
  coverOverhangZ: 0.12, // 上下方向に合計でこの分広げる
  animDuration: 0.8,
  animEase: 'power2.inOut' as const,
  // Lighting (indoor, slightly bright, natural)
  ambientIntensity: 0.7,
  dirIntensity: 1.2,
  hemiIntensity: 0.6,
  exposure: 0.95,
  ambientColor: 0xfff2e6,
  dirColor: 0xfff0dc,
  hemiSkyColor: 0xfff1e0,
  hemiGroundColor: 0x4a4a4a,
}
