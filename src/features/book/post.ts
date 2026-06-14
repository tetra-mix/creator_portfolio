import * as THREE from 'three';
import type { SceneContext } from '../../shared/three/scene';
import { CONFIG } from '../../shared/three/config';
import { addGltfProp } from './gltfProp';
import type { MailboxUserData } from '../../shared/three/types';

// The mailbox/post that sits on the desk beside the contact letter. Clicking it
// while writing posts the letter (see interactions.ts). It deliberately has NO
// clickClips, so addGltfProp does not give it the generic `isGltfProp`/`play()`
// click behaviour; instead we tag its root with `isMailbox` via onReady so the
// interaction layer can special-case it.
export function addPost(ctx: SceneContext): void {
  addGltfProp(ctx, {
    file: 'models/post.glb', // public/ 起点
    position: [CONFIG.post.position.x, CONFIG.post.position.y, CONFIG.post.position.z],
    targetHeight: CONFIG.post.targetHeight,
    rotationY: CONFIG.post.rotationY,
    onReady: (root) => {
      // Measure the world-space "slot" the letter flies into once, now — the
      // bounding box is static, so there's no need to recompute it per send.
      const box = new THREE.Box3().setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const slot = new THREE.Vector3(
        center.x + size.x * CONFIG.post.slotOffsetX,
        box.min.y + size.y * CONFIG.post.slotOffsetY,
        center.z + size.z * CONFIG.post.slotOffsetZ,
      );
      (root.userData as MailboxUserData) = { isMailbox: true, slot };
      root.name = 'mailbox';
    },
  });
}
