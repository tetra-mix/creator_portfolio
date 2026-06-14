import * as THREE from 'three';

export const CONFIG = {
  // カメラ位置（少し斜めの俯瞰）
  cameraPos: new THREE.Vector3(0, 6, 4),
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
    color: 0xf2c94c, // yellow body
    eraserColor: 0xf2994a, // orange/eraser band
  },
  mug: {
    radiusTop: 0.5,
    radiusBottom: 0.5,
    height: 0.8,
    thickness: 0.06,
    color: 0xdddddd,
    handleSide: 'right' as 'left' | 'right',
  },
  // お問い合わせ便箋。本の右側にやや離して、机に 45 度斜めで平置きする。
  // クリックするとカメラが斜めから回り込んで便箋に正対する（interactions.ts）。
  letter: {
    position: new THREE.Vector3(5.6, 0.011, 0.6), // 本よりさらに右。y は机からわずかに浮かせる
    rotationY: -Math.PI / 4, // 机の上で 45 度ひねって置く（時計回り）
    size: { width: 2.2, height: 3.0 },
    color: 0xfaf3e0,
    // letter mode のカメラの寄り方。
    // viewDistance: 便箋からカメラまでの距離（寄り具合。角度を変えても一定）。
    // viewPitchDeg: 見下ろし角（0=真横/水平, 90=真上）。ここだけで傾きを調整できる。
    viewDistance: 5.0,
    viewPitchDeg: 58,
  },
  // 投函ポスト（郵便受け）。便箋の画面右側に置き、letter mode の視界に入れる。
  // クリックすると便箋がポストへ飛んで入り、メールが送信される（interactions.ts）。
  post: {
    position: new THREE.Vector3(7.6, 0, 2.5), // 便箋(5.6,0,0.6)のさらに右（カメラ右方向に寄せる）
    targetHeight: 1.6, // 机の上でのモデル高さ(units)。自動スケール
    rotationY: (Math.PI / 3) * 4, // 240°（投函口の向き）
    // 便箋が飛び込む投函口の位置。モデルのバウンディングボックスを基準にした割合。
    // slotOffsetY: 高さ方向（0=底, 1=天面）。slotOffsetX/Z: 中心からの水平ずれ
    // （-0.5〜0.5 でボックス幅・奥行きの半分。投函口が中心から外れている場合に調整）。
    slotOffsetY: 0.9,
    slotOffsetX: 0,
    slotOffsetZ: 0,
  },
  // 付箋タブ設定
  tabsEnabled: true,
  tabSize: { width: 0.28, height: 0.5 },
  tabOffsetX: 0.005, // ページ右端からの隙間（内側の余白）
  tabOutsideX: 0.02, // 表紙右端の外側にどれだけ出すか（重なり防止）
  tabs: [
    // v: 0..1 で高さ方向の位置（0=下端, 1=上端）
    // pageIndex は 1-based（例: 1=1ページ目, 2=2ページ目）
    { label: 'About', pageIndex: 2, color: 0xffcc66, v: 0.2 },
    { label: 'Projects', pageIndex: 8, color: 0x99dd55, v: 0.4 },
  ] as Array<{
    label: string;
    pageIndex: number;
    color?: number;
    v?: number;
    hitWidth?: number;
    hitHeight?: number;
  }>,
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
};
