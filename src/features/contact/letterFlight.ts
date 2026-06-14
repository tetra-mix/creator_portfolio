import * as THREE from 'three';
import { gsap } from 'gsap';
import { CONFIG } from '../../shared/three/config';

// Flight tuning, relative to the letter's resting pose (world units / radians).
// Kept here so a future mailbox-insertion variant can replace these wholesale.
const FLIGHT = {
  liftY: 1.4, // initial hop up off the desk
  liftZ: -1.2, // initial drift away from the camera
  liftTiltX: -0.9, // tilt as it lifts
  liftTiltZ: 0.5,
  awayY: 6, // final height before it leaves frame
  awayZ: -4, // final drift away
  endScale: 0.2, // shrink factor at the end
};

// "Posting" animation played when a letter is sent successfully.
//
// If a `target` (the post's slot, in world space) is given, the sheet lifts off
// the desk, then dives into the slot — shrinking, standing on edge and fading as
// it's "mailed". Without a target (e.g. the post hasn't loaded) it falls back to
// the old float-up-and-away. Either way it restores its resting pose afterward so
// the form can be reused. contactForm calls back into here via the `onSent` hook.
export function playLetterFlight(
  mesh: THREE.Mesh,
  target: THREE.Vector3 | null,
  onComplete?: () => void,
): void {
  // Capture the resting pose so we can restore it after the flight.
  const home = {
    px: mesh.position.x,
    py: mesh.position.y,
    pz: mesh.position.z,
    rx: mesh.rotation.x,
    ry: mesh.rotation.y,
    rz: mesh.rotation.z,
    scale: mesh.scale.x,
  };

  const mat = mesh.material as THREE.MeshStandardMaterial;
  const startOpacity = mat.opacity;
  const startTransparent = mat.transparent;
  mat.transparent = true;

  gsap.killTweensOf(mesh.position);
  gsap.killTweensOf(mesh.rotation);
  gsap.killTweensOf(mesh.scale);
  gsap.killTweensOf(mat);

  const tl = gsap.timeline({
    onComplete: () => {
      // Restore resting pose and material so the form can be used again.
      mesh.position.set(home.px, home.py, home.pz);
      mesh.rotation.set(home.rx, home.ry, home.rz);
      mesh.scale.setScalar(home.scale);
      mat.opacity = startOpacity;
      mat.transparent = startTransparent;
      mat.needsUpdate = true;
      onComplete?.();
    },
  });

  if (target) {
    // Convert the slot's world position into the mesh's parent space (the mesh
    // tweens in local coordinates). Letter is parented to the scene, so this is
    // world == local, but stay correct if that ever changes.
    const local = mesh.parent ? mesh.parent.worldToLocal(target.clone()) : target.clone();

    // Phase A: pick up off the desk and tilt toward the post. The sheet lies
    // flat (its length runs along Z), so tilting it by `tiltA` dips its far edge
    // by (length/2)*sin(tiltA) below the centre. Lift past that — plus a margin —
    // so the tilted sheet never clips into the desk (y=0).
    const tiltA = 0.4;
    const liftA = (CONFIG.letter.size.height / 2) * Math.sin(tiltA) + 0.4;
    tl.to(mesh.position, { y: home.py + liftA, duration: 0.45, ease: 'power2.out' }, 0);
    tl.to(mesh.rotation, { x: home.rx + tiltA, duration: 0.45, ease: 'power2.out' }, 0);

    // Phase B: dive into the slot — move to it, stand on edge, shrink, fade.
    tl.to(
      mesh.position,
      { x: local.x, y: local.y, z: local.z, duration: 0.55, ease: 'power2.in' },
      0.4,
    );
    tl.to(mesh.rotation, { x: Math.PI / 2, duration: 0.55, ease: 'power2.in' }, 0.4);
    tl.to(
      mesh.scale,
      {
        x: home.scale * 0.12,
        y: home.scale * 0.12,
        z: home.scale * 0.12,
        duration: 0.55,
        ease: 'power2.in',
      },
      0.4,
    );
    tl.to(mat, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 0.6);
    return;
  }

  // Fallback: lift + tilt off the desk, then sail up and away, shrinking + fading.
  tl.to(
    mesh.position,
    { y: home.py + FLIGHT.liftY, z: home.pz + FLIGHT.liftZ, duration: 0.55, ease: 'power2.out' },
    0,
  );
  tl.to(
    mesh.rotation,
    {
      x: home.rx + FLIGHT.liftTiltX,
      z: home.rz + FLIGHT.liftTiltZ,
      duration: 0.55,
      ease: 'power2.out',
    },
    0,
  );
  tl.to(
    mesh.position,
    { y: home.py + FLIGHT.awayY, z: home.pz + FLIGHT.awayZ, duration: 0.7, ease: 'power2.in' },
    0.5,
  );
  tl.to(
    mesh.scale,
    {
      x: home.scale * FLIGHT.endScale,
      y: home.scale * FLIGHT.endScale,
      z: home.scale * FLIGHT.endScale,
      duration: 0.7,
      ease: 'power2.in',
    },
    0.5,
  );
  tl.to(mat, { opacity: 0, duration: 0.55, ease: 'power2.in' }, 0.65);
}
