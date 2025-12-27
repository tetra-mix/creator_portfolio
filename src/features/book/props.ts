import * as THREE from 'three';
import { CONFIG } from '../../shared/three/config';

export function createDeskProps(scene: THREE.Scene) {
  if (!CONFIG.propsEnabled) return;
  const group = new THREE.Group();

  // Compute safe placements outside the book footprint
  const coverWidth = CONFIG.pageWidth + CONFIG.coverOverhangX;
  const coverDepth = CONFIG.pageHeight + CONFIG.coverOverhangZ;
  const m = CONFIG.propsMargin;
  const leftX = -coverWidth - m;
  const rightX = coverWidth - m;
  const topZ = coverDepth / 2 + m;
  const bottomZ = -coverDepth / 2 - m;

  // Pencil (top edge, to the right)
  const pencil = createPencil();
  pencil.position.set(rightX, 0, topZ + 0.3);
  pencil.rotateX(Math.PI / 48);
  group.add(pencil);

  // Mug (bottom edge, place mug group on the left side; handle remains on mug's right local side)
  const mug = createMug();
  mug.position.set(leftX, THREE.BackSide / 2, bottomZ);
  group.add(mug);

  scene.add(group);
}

function createPencil(): THREE.Object3D {
  const g = new THREE.Group();
  const { length, radius, color, eraserColor } = CONFIG.pencil;

  // Body
  const bodyGeo = new THREE.CylinderGeometry(radius, radius, length, 12);
  const bodyMat = new THREE.MeshStandardMaterial({ color });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  // Tip (cone)
  const tipGeo = new THREE.ConeGeometry(radius * 0.9, radius * 2.2, 12);
  const tipMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63 });
  const tip = new THREE.Mesh(tipGeo, tipMat);
  // Place tip at the top end, pointing outward (no inversion)
  tip.position.y = length / 2 + (radius * 2.2) / 2;
  tip.castShadow = true;

  // Eraser band
  const bandGeo = new THREE.CylinderGeometry(radius * 1.05, radius * 1.05, radius * 0.6, 16);
  const bandMat = new THREE.MeshStandardMaterial({
    color: eraserColor,
    metalness: 0.2,
    roughness: 0.4,
  });
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.position.y = -length / 2 + radius * 0.3;
  band.castShadow = true;

  g.add(body, tip, band);
  // Lay the pencil on the desk
  g.rotation.z = Math.PI / 2;
  // Local elevation to rest on desk (global Y is added by parent placement)
  g.position.y = radius;
  return g;
}

function createMug(): THREE.Object3D {
  const g = new THREE.Group();
  const { radiusTop, radiusBottom, height, thickness, color } = CONFIG.mug;

  // Outer wall
  const outerGeo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 24);
  const outerMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.05 });
  const outer = new THREE.Mesh(outerGeo, outerMat);
  outer.castShadow = true;
  outer.receiveShadow = true;

  // Inner wall (subtract visually by flipping normals and slightly smaller radius)
  const innerGeo = new THREE.CylinderGeometry(
    radiusTop - thickness,
    radiusBottom - thickness,
    height * 0.95,
    24,
  );
  innerGeo.scale(1, 1, 1);
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    side: THREE.BackSide,
    roughness: 0.6,
  });
  const inner = new THREE.Mesh(innerGeo, innerMat);

  // Handle (full ring)
  const ringRadius = radiusTop * 0.55;
  const tubeRadius = thickness * 0.5;
  const handleGeo = new THREE.TorusGeometry(
    ringRadius, // ring radius
    tubeRadius, // tube radius
    16, // radial segments
    32, // tubular segments
    Math.PI * 2, // full circle
  );
  const handleMat = outerMat;
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.name = 'mugHandle';
  handle.position.set(radiusTop + thickness * 0.25, 0, 0);
  handle.castShadow = true;

  g.add(outer, inner, handle);
  // Elevate mug so it sits on the desk; X/Z set by parent placement
  g.position.y = height / 2;
  return g;
}
