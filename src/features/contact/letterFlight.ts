import * as THREE from 'three';
import { gsap } from 'gsap';

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
// For now the sheet lifts off the desk, tilts, shrinks and floats up out of
// frame (as if mailed), then resets to its resting pose so the form is ready
// again. This is intentionally a self-contained step: a future version can swap
// this out for a mailbox-insertion animation without touching the send logic —
// contactForm calls back into here via the `onSent` hook.
export function playLetterFlight(mesh: THREE.Mesh, onComplete?: () => void): void {
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

  // Lift + tilt as it leaves the desk.
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

  // Then sail up and away, shrinking and fading out.
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
