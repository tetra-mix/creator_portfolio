import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { SceneContext } from '../../shared/three/scene';

// Options for placing a single glTF (.glb) model on the desk.
// Each model gets its own module that hardcodes these (see m5stackchan.ts).
export interface GltfPropOptions {
  // Path under public/ including extension, e.g. 'models/robot.glb'.
  file: string;
  // Desk-relative x,z. The y is computed automatically so the model's lowest
  // point rests on the desk (y=0), so the y you pass here is just an offset.
  position: [number, number, number];
  // Height in world units the model should occupy on the desk. The model is
  // auto-scaled to match. Omit/0 to keep the model's authored scale.
  targetHeight?: number;
  // Yaw in radians for facing direction.
  rotationY?: number;
  // Name of the clip to loop continuously (idle/ambient). Omit for none.
  autoplayClip?: string;
  // Clips that can play on click/tap. One is chosen at random each click.
  // `repeat` is how many times that clip loops (default 1). Omit/empty to make
  // the model non-clickable.
  clickClips?: ClickClip[];
}

export interface ClickClip {
  name: string;
  repeat?: number; // number of loops per click (default 1)
}

// userData contract for a clickable prop root. Mirrors the `isCover` / `isTab`
// pattern so interactions.ts can find it from a raycast hit and trigger playback.
export interface GltfPropUserData {
  isGltfProp: true;
  play: () => void; // play a random click clip (looping its configured count)
}

// Pick an AnimationClip by name (case-insensitive); fall back to the first clip.
function pickClip(clips: THREE.AnimationClip[], name: string): THREE.AnimationClip | null {
  if (clips.length === 0) return null;
  if (!name) return clips[0];
  const lower = name.toLowerCase();
  return clips.find((c) => c.name.toLowerCase() === lower) ?? clips[0];
}

// Generic helper: load one .glb, sit it on the desk at a sensible size, and wire
// up its animations. Fire-and-forget — the book renders immediately and the
// model appears whenever it finishes loading. Model-specific tuning lives in the
// caller (e.g. src/features/book/m5stackchan.ts), not here.
export function addGltfProp(ctx: SceneContext, options: GltfPropOptions): void {
  const { file, position, targetHeight = 0, rotationY = 0, autoplayClip, clickClips } = options;

  const loader = new GLTFLoader();
  // BASE_URL is a path (e.g. '/creator_portfolio/'), not an absolute URL, so it
  // can't be the base arg of `new URL` directly — anchor it to window.origin first.
  const base = new URL(import.meta.env.BASE_URL || '/', window.location.origin);
  const url = new URL(file, base).toString();

  loader.load(
    url,
    (gltf) => {
      const model = gltf.scene;
      model.rotation.y = rotationY;

      model.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });

      // --- Auto-fit: scale to targetHeight, then sit the bottom on the desk. ---
      // Models often have their origin at the body center (not the feet) and an
      // arbitrary export scale, so derive both from the bounding box after the
      // rotation above is applied.
      if (targetHeight > 0) {
        const size = new THREE.Vector3();
        new THREE.Box3().setFromObject(model).getSize(size);
        if (size.y > 0) model.scale.multiplyScalar(targetHeight / size.y);
      }

      // Recompute the box after scaling to find how far the lowest point sits
      // below the model's origin, then lift it so that point rests on y=0.
      const minY = new THREE.Box3().setFromObject(model).min.y;
      model.position.set(position[0], position[1] - minY, position[2]);

      // No animation clips: it's a static decoration, nothing more to wire up.
      if (gltf.animations.length === 0) {
        ctx.scene.add(model);
        return;
      }

      const mixer = new THREE.AnimationMixer(model);
      ctx.addUpdater((delta) => mixer.update(delta));

      const FADE = 0.2; // seconds for idle<->click crossfades

      // Looping idle/ambient clip that plays continuously.
      const idleClip = autoplayClip ? pickClip(gltf.animations, autoplayClip) : null;
      const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
      if (idleAction) {
        idleAction.setLoop(THREE.LoopRepeat, Infinity);
        idleAction.play();
      }

      // Clips triggered by clicking/tapping the model. One is chosen at random
      // per click, each looping its configured number of times. While a click
      // clip plays, the idle clip fades out and back in so they never blend.
      if (clickClips && clickClips.length > 0) {
        const resolved = clickClips
          .map((cc) => {
            const clip = pickClip(gltf.animations, cc.name);
            return clip ? { action: mixer.clipAction(clip), repeat: cc.repeat ?? 1 } : null;
          })
          .filter((x): x is { action: THREE.AnimationAction; repeat: number } => x !== null);

        if (resolved.length > 0) {
          const clickActions = new Set(resolved.map((r) => r.action));
          // When one of OUR click clips finishes, fade idle back in. The listener
          // fires for every action on this mixer, so ignore any we didn't trigger.
          mixer.addEventListener('finished', (e) => {
            const finished = (e as unknown as { action: THREE.AnimationAction }).action;
            if (!clickActions.has(finished)) return;
            if (idleAction) {
              idleAction.reset();
              idleAction.play();
              idleAction.fadeIn(FADE);
            }
          });

          (model.userData as GltfPropUserData) = {
            isGltfProp: true,
            play: () => {
              const pick = resolved[Math.floor(Math.random() * resolved.length)];
              // Stop any in-flight click animation so rapid taps don't blend.
              for (const r of resolved) r.action.stop();
              if (idleAction) idleAction.fadeOut(FADE);
              pick.action.reset();
              pick.action.setLoop(
                pick.repeat > 1 ? THREE.LoopRepeat : THREE.LoopOnce,
                Math.max(1, pick.repeat),
              );
              pick.action.clampWhenFinished = true;
              pick.action.fadeIn(FADE);
              pick.action.play();
            },
          };
        }
      }

      ctx.scene.add(model);
    },
    undefined,
    (err) => console.error('[gltfProp] failed to load', url, err),
  );
}
