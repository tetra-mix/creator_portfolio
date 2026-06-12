import type { SceneContext } from '../../shared/three/scene';
import { addGltfProp } from './gltfProp';

// M5Stack-chan desk prop. Tuning is hardcoded here; the generic loading/animation
// logic lives in gltfProp.ts. Add more models by copying this pattern into a
// sibling file and calling addGltfProp with that model's settings.
//
// Clip names in this glb: idle / idle2 / idle3 / kubihuri / up-down /
//   walk / walk-run / walk-slow
export function addM5StackChan(ctx: SceneContext): void {
  addGltfProp(ctx, {
    file: 'models/m5stackchan.glb', // public/ 起点
    // 本は x≈0〜3.12 / z≈-2.06〜+2.06 を占有する。その右上（右かつ奥）に置く。
    position: [4.2, 0, -2.4],
    targetHeight: 1.1, // 机の上でのモデルの高さ(units)。自動スケール
    rotationY: -Math.PI / 5, // 本の方を向くよう少し回す
    autoplayClip: 'idle', // 常時ゆらゆら
    // クリック/タップでランダムに再生。up-down は頷き、kubihuri は首振り。
    clickClips: [{ name: 'up-down' }, { name: 'kubihuri' }],
  });
}
