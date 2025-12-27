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
  // 小物（プロップ）
  propsEnabled: true,
  propsMargin: 0.6,
  pencil: {
    length: 2.0,
    radius: 0.04,
    color: 0xF2C94C, // yellow body
    eraserColor: 0xF2994A, // orange/eraser band
  },
  mug: {
    radiusTop: 0.5,
    radiusBottom: 0.5,
    height: 0.8,
    thickness: 0.06,
    color: 0xdddddd,
    handleSide: 'right' as 'left' | 'right',
  },
  // 付箋タブ設定
  tabsEnabled: true,
  tabSize: { width: 0.28, height: 0.5 },
  tabOffsetX: 0.005, // ページ右端からの隙間（内側の余白）
  tabOutsideX: 0.02, // 表紙右端の外側にどれだけ出すか（重なり防止）
  tabs: [
    // v: 0..1 で高さ方向の位置（0=下端, 1=上端）
    // pageIndex は 1-based（例: 1=1ページ目, 2=2ページ目）
    { label: 'Intro', pageIndex: 4, color: 0xffcc66, v: 0.8 },
    { label: 'About', pageIndex: 8, color: 0x66ccff, v: 0.6 },
    { label: 'Projects', pageIndex: 12, color: 0x99dd55, v: 0.4 },
  ] as Array<{ label: string; pageIndex: number; color?: number; v?: number; hitWidth?: number; hitHeight?: number }>,
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
  // Desk/texture orientation
  deskRotationX: -Math.PI / 2,
  woodRotation: Math.PI / 2,
}
