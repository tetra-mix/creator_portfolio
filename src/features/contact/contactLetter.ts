import * as THREE from 'three';
import { CONFIG } from '../../shared/three/config';
import { createLetterCanvas, type LetterCanvas } from './letterCanvas';
import type { ContactLetterUserData } from '../../shared/three/types';

export interface ContactLetter {
  mesh: THREE.Mesh;
  canvas: LetterCanvas;
}

// A sheet of stationery lying flat on the desk, off to the right of the book and
// turned at an angle. It "peeks" into view in book mode; clicking it pans the
// camera around to face it (see interactions.ts), where the user writes directly
// onto the paper. Returns the mesh (a raycast target) and the canvas (so the
// writer can render typed text onto it).
export function createContactLetter(scene: THREE.Scene): ContactLetter {
  const { width, height } = CONFIG.letter.size;

  // Lay the plane flat on the desk (XZ plane), matching how book pages are
  // oriented (see book.ts `pageGeo.rotateX(-Math.PI / 2)`).
  const geo = new THREE.PlaneGeometry(width, height);
  geo.rotateX(-Math.PI / 2);

  const canvas = createLetterCanvas();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, // let the texture supply the paper color
    map: canvas.texture,
    roughness: 0.85,
    metalness: 0.0,
  });
  mat.toneMapped = false;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(CONFIG.letter.position);
  // Yaw the flat sheet so it sits at an angle on the desk (the geometry is
  // already baked flat via rotateX above, so this only spins it about Y).
  mesh.rotation.y = CONFIG.letter.rotationY;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'contactLetter';
  (mesh.userData as ContactLetterUserData) = { isContactLetter: true };

  scene.add(mesh);
  return { mesh, canvas };
}
