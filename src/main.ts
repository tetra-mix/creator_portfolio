import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { gsap } from 'gsap';

// --- Configuration ---
const CONFIG = {
  cameraPos: new THREE.Vector3(0, 4, 8),
  deskColor: 0x8B4513, // SaddleBrown
  bookCoverColor: 0x2F4F4F, // DarkSlateGray
  pageColor: 0xFFFAF0, // FloralWhite
  pageCount: 5,
  pageWidth: 3,
  pageHeight: 4,
  pageThickness: 0.02, // Very thin for pages
  coverThickness: 0.1,
  animDuration: 0.8,
  animEase: "power2.inOut"
};

// --- Globals ---
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;

const pages: THREE.Mesh[] = [];
let bookGroup: THREE.Group;

// --- Initialization ---
function init() {
  const app = document.getElementById('app');
  if (!app) return;

  // 1. Scene Setup
  scene = new THREE.Scene();
  // scene.background = new THREE.Color(0x222222); // Handled by CSS, but good to have fallback

  // 2. Camera
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.copy(CONFIG.cameraPos);

  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  app.appendChild(renderer.domElement);

  // 4. Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 5;
  controls.maxDistance = 15;
  controls.maxPolarAngle = Math.PI / 2 - 0.1; // Don't go below the desk

  // 5. Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
  dirLight.position.set(5, 10, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  scene.add(dirLight);

  // 6. Objects
  createDesk();
  createBook();

  // 7. Interaction
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('click', onMouseClick);

  // 8. Loop
  renderer.setAnimationLoop(animate);
}

// --- Object Creation ---

function createDesk() {
  const geometry = new THREE.PlaneGeometry(20, 20);
  const material = new THREE.MeshStandardMaterial({ 
    color: 0xdddddd,
    roughness: 0.8,
    metalness: 0.1
  });

  // Generate wood texture
  const texture = createWoodTexture();
  if (texture) {
    material.map = texture;
    material.color.setHex(0xffffff); // Use texture color
  }

  const desk = new THREE.Mesh(geometry, material);
  desk.rotation.x = -Math.PI / 2;
  desk.receiveShadow = true;
  scene.add(desk);
}

function createWoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null as any;

  // Background
  ctx.fillStyle = '#8B5A2B';
  ctx.fillRect(0, 0, 512, 512);

  // Grain
  ctx.fillStyle = '#A0522D';
  for (let i = 0; i < 100; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const w = Math.random() * 200 + 50;
    const h = Math.random() * 2 + 1;
    ctx.fillRect(x, y, w, h);
  }
  
  // Stripes
  ctx.strokeStyle = '#6F4E37';
  ctx.lineWidth = 2;
  for (let i = 0; i < 20; i++) {
     ctx.beginPath();
     ctx.moveTo(0, i * 25 + Math.random() * 10);
     ctx.lineTo(512, i * 25 + Math.random() * 10);
     ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

function createBook() {
  bookGroup = new THREE.Group();
  scene.add(bookGroup);

  const { pageWidth, pageHeight, coverThickness, pageCount, pageThickness } = CONFIG;
  const spineWidth = pageCount * pageThickness + 0.1; // Approximate spine width

  // 1. Back Cover (Bottom)
  const backCoverGeo = new THREE.BoxGeometry(pageWidth, coverThickness, pageHeight);
  const coverMat = new THREE.MeshStandardMaterial({ color: CONFIG.bookCoverColor });
  const backCover = new THREE.Mesh(backCoverGeo, coverMat);
  // Position: centered horizontally, slightly up from desk
  backCover.position.set(pageWidth / 2, coverThickness / 2, 0); 
  backCover.castShadow = true;
  backCover.receiveShadow = true;
  bookGroup.add(backCover);

  // 2. Front Cover (Top - initially closed)
  // To make it rotatable like a page, we need a pivot.
  // We'll create a container for the cover that pivots at the spine.
  const frontCoverGeo = new THREE.BoxGeometry(pageWidth, coverThickness, pageHeight);
  const frontCoverMesh = new THREE.Mesh(frontCoverGeo, coverMat);
  frontCoverMesh.position.set(pageWidth / 2, 0, 0); // Offset from pivot
  frontCoverMesh.castShadow = true;
  
  // Create a pivot group for the front cover
  // The pivot should be at x=0 (spine)
  const frontCoverPivot = new THREE.Group();
  frontCoverPivot.add(frontCoverMesh);
  
  // Position the pivot on top of the pages
  // Bottom of cover should be at: coverThickness (Back) + pageCount * pageThickness
  // Pivot is at center of cover, so add coverThickness/2
  const totalThickness = coverThickness + (pageCount * pageThickness) + (coverThickness / 2);
  frontCoverPivot.position.set(0, totalThickness, 0);
  
  // Mark as cover for raycasting
  frontCoverMesh.userData = { isCover: true, isOpen: false, parentPivot: frontCoverPivot };
  
  bookGroup.add(frontCoverPivot);
  pages.push(frontCoverMesh); // Add to pages array for interaction

  // 3. Pages
  const pageGeo = new THREE.PlaneGeometry(pageWidth, pageHeight);
  // Rotate geometry to lie flat (X-Z plane)
  pageGeo.rotateX(-Math.PI / 2);
  // Shift geometry so pivot is at left edge
  pageGeo.translate(pageWidth / 2, 0, 0);

  const EPS = 0.001; // Tiny offset to prevent z-fighting

  for (let i = 0; i < pageCount; i++) {
    const pageGroup = new THREE.Group();
    
    // Front Mesh (Facing Up)
    const frontMat = new THREE.MeshStandardMaterial({ 
      color: CONFIG.pageColor,
      side: THREE.FrontSide // Only visible from front
    });
    const frontMesh = new THREE.Mesh(pageGeo, frontMat);
    frontMesh.castShadow = true;
    frontMesh.receiveShadow = true;
    frontMesh.userData = { isPageMesh: true, side: 'front' };
    
    // Back Mesh (Facing Down)
    // We can use the same geometry but we need it to face down.
    // Or we can clone geometry and rotate it?
    // Easier: Create a mesh with the same geometry, but rotate the MESH PI around X?
    // Wait, geometry is already rotated -PI/2 X.
    // If we rotate mesh PI around X, it will flip.
    // But pivot is at 0,0,0 (spine).
    // If we rotate around X axis (spine), it flips "book-wise" (spine axis is Z? No, spine is Z axis).
    // We want to flip the face orientation.
    // Let's just use a second mesh with BackSide? No, texture would be mirrored.
    // We want distinct texture.
    // Let's create a back mesh that is identical but rotated Math.PI around X (local)?
    // No, local X is along the page width? No, we translated geometry.
    // Let's just make a second geometry for back? Or just rotate the back mesh 180 deg around X (spine)?
    // If we rotate 180 around X (spine), it goes to the other side of the book (left).
    // We want it to be in the same place (right), just facing down.
    // So we need it to be "flipped" in place.
    // Scale y = -1?
    // Let's try: BackMesh with same geometry, but material side = FrontSide, and we rotate it?
    // Actually, just creating a mesh with `side: BackSide` and applying the texture mirrored?
    // Or:
    // FrontMesh: Normal up.
    // BackMesh: Normal down.
    // To get Normal down with same geometry: Rotate X by PI?
    // If we rotate X by PI, the geometry (which is +X from pivot) will stay +X?
    // No, rotation is around (0,0,0).
    // Geometry points: (0,0,0) to (W,0,H).
    // Rotate X PI: (x,0,z) -> (x, 0, -z).
    // So it flips along Z axis. That's not what we want (that flips along spine direction).
    // We want to flip "upside down" (Normal flip).
    // Actually, `PlaneGeometry` normals are +Z (before our rotation).
    // We rotated X -PI/2. So normals are +Y.
    // We want normals -Y.
    // Rotate X PI?
    // Normal (0,1,0) -> (0,-1,0).
    // Position (x,0,z) -> (x,0,-z).
    // So Z coordinates flip.
    // If page is symmetric in Z (height), it's fine?
    // Page is centered in Z? No.
    // Geometry is created with width, height. Centered?
    // `new PlaneGeometry(w, h)` -> centered at 0.
    // We translated X by w/2.
    // Z is from -h/2 to h/2.
    // So flipping Z is fine! It's symmetric.
    
    const backMat = new THREE.MeshStandardMaterial({ 
      color: CONFIG.pageColor,
      side: THREE.FrontSide
    });
    const backMesh = new THREE.Mesh(pageGeo, backMat);
    backMesh.rotation.x = Math.PI;
    backMesh.castShadow = true;
    backMesh.receiveShadow = true;
    backMesh.userData = { isPageMesh: true, side: 'back' };

    // Generate textures
    const frontTex = createPageTexture(i, 'front');
    const backTex = createPageTexture(i, 'back');
    
    // Fix back texture orientation
    backTex.center.set(0.5, 0.5);
    backTex.rotation = Math.PI;
    
    frontMat.map = frontTex;
    backMat.map = backTex;

    pageGroup.add(frontMesh);
    pageGroup.add(backMesh);

    // Stack them
    const yPos = coverThickness + (i * pageThickness) + EPS;
    pageGroup.position.set(0, yPos, 0);
    
    pageGroup.userData = { pageIndex: i, isFlipped: false };
    
    bookGroup.add(pageGroup);
    // We need to store the GROUP in pages array for animation logic, 
    // but Raycaster hits MESH.
    // We'll store groups in `pages` array, but we need a way to raycast.
    // Raycaster can check recursive.
    // Let's change `pages` to store Groups? 
    // The current code expects `pages` to be Meshes for `intersectObjects`.
    // If we pass groups to `intersectObjects(..., true)`, it works.
    pages.push(pageGroup as any); 
  }
}

function createPageTexture(index: number, side: 'front' | 'back'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 350;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.fillStyle = '#FFF';
    ctx.fillRect(0,0,256,350);
    ctx.fillStyle = '#000';
    ctx.font = '20px Arial';
    
    // Invert index for display so top page (last index) is Page 1
    const logicalIndex = CONFIG.pageCount - 1 - index;
    const pageNum = side === 'front' ? logicalIndex * 2 + 1 : logicalIndex * 2 + 2;
    
    const text = `Page ${pageNum}`;
    ctx.fillText(text, 50, 50);
    
    // Add some lines
    for(let j=0; j<10; j++) {
      ctx.fillRect(20, 80 + j*20, 200, 2);
    }
    
    // Add page number at bottom
    ctx.font = '14px Arial';
    ctx.fillText(`${pageNum}`, 120, 330);

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
}

// --- Interaction ---

function onMouseClick(event: MouseEvent) {
  // Normalize mouse coordinates
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // Intersect with all pages (including cover)
  const intersects = raycaster.intersectObjects(pages, true);

  if (intersects.length > 0) {
    // Determine which objects are currently interactive (top of stacks)
    const validTargets = getInteractiveObjects();

    // Find the first intersection that is a valid target
    for (const intersect of intersects) {
      const targetMesh = intersect.object as THREE.Mesh;
      const root = getRootObject(targetMesh);
      
      if (validTargets.includes(root)) {
        if (targetMesh.userData.isCover) {
          toggleCover(targetMesh);
        } else if (targetMesh.userData.isPageMesh) {
          const pageGroup = targetMesh.parent as THREE.Group;
          if (pageGroup && pageGroup.userData.pageIndex !== undefined) {
            togglePage(pageGroup);
          }
        }
        return; // Stop after triggering the top-most valid object
      }
    }
  }
}

function getRootObject(mesh: THREE.Mesh): THREE.Object3D {
  if (mesh.userData.isCover) return mesh;
  if (mesh.userData.isPageMesh && mesh.parent) return mesh.parent;
  return mesh;
}

function getInteractiveObjects(): THREE.Object3D[] {
  const interactive: THREE.Object3D[] = [];
  
  // Pages are at indices 1..N in 'pages' array
  // pages[0] is Front Cover Mesh
  const frontCover = pages[0];
  const pageGroups = pages.slice(1) as unknown as THREE.Group[];
  
  const isOpen = frontCover.userData.isOpen;

  if (!isOpen) {
    // Cover is closed (Right side, top)
    interactive.push(frontCover);
    // No other pages are interactive on right (covered)
    // No pages on left
  } else {
    // Cover is open (Left side, bottom)
    
    // 1. Right Stack Top
    // Find highest index that is NOT flipped
    let topRight: THREE.Group | null = null;
    for (let i = pageGroups.length - 1; i >= 0; i--) {
      if (!pageGroups[i].userData.isFlipped) {
        topRight = pageGroups[i];
        break;
      }
    }
    if (topRight) interactive.push(topRight);
    
    // 2. Left Stack Top
    // Find lowest index that IS flipped
    let topLeft: THREE.Group | null = null;
    for (let i = 0; i < pageGroups.length; i++) {
      if (pageGroups[i].userData.isFlipped) {
        topLeft = pageGroups[i];
        break;
      }
    }
    
    if (topLeft) {
      interactive.push(topLeft);
    } else {
      // If no pages are flipped, the open cover is the top of the left stack
      interactive.push(frontCover);
    }
  }
  
  return interactive;
}

function toggleCover(mesh: THREE.Mesh) {
  const pivot = mesh.userData.parentPivot as THREE.Group;
  const isOpen = mesh.userData.isOpen;
  
  // Open: Rotate to -Math.PI (flat on left). 
  // Note: We used positive rotation in previous step? 
  // Let's stick to the direction that worked (flipping up).
  // If previous was positive and worked, we use positive.
  // Target: Math.PI (fully flat).
  const targetRot = isOpen ? 0 : Math.PI; 
  
  // Stacking logic:
  // Right Y: Pivot position (Center of cover)
  // = coverThickness (Back) + pageCount * pageThickness + coverThickness/2
  const rightY = CONFIG.coverThickness + (CONFIG.pageCount * CONFIG.pageThickness) + (CONFIG.coverThickness / 2);
  const leftY = CONFIG.coverThickness / 2; 

  const targetY = isOpen ? rightY : leftY;

  gsap.to(pivot.rotation, {
    z: targetRot, 
    duration: CONFIG.animDuration,
    ease: CONFIG.animEase
  });
  
  gsap.to(pivot.position, {
    y: targetY,
    duration: CONFIG.animDuration,
    ease: CONFIG.animEase,
    onComplete: () => {
      mesh.userData.isOpen = !isOpen;
    }
  });
}

function togglePage(group: THREE.Group) {
  const isFlipped = group.userData.isFlipped;
  const index = group.userData.pageIndex;
  
  // Rotation Logic:
  // Make all pages lie flat to simulate gravity.
  // Stacking is handled by Y position.
  const openRot = Math.PI;
  const targetRot = isFlipped ? 0 : openRot; 
  
  const EPS = 0.001;
  
  // Stacking logic (Y position):
  const rightY = CONFIG.coverThickness + (index * CONFIG.pageThickness) + EPS;
  // Left Y: Sit on top of Front Cover (which is at coverThickness)
  // Stack order: Index 4 is bottom, Index 0 is top.
  const leftY = CONFIG.coverThickness + ((CONFIG.pageCount - 1 - index) * CONFIG.pageThickness) + EPS;

  const targetY = isFlipped ? rightY : leftY;
  
  gsap.to(group.rotation, {
    z: targetRot,
    duration: CONFIG.animDuration,
    ease: CONFIG.animEase
  });

  gsap.to(group.position, {
    y: targetY,
    duration: CONFIG.animDuration,
    ease: CONFIG.animEase,
    onComplete: () => {
      group.userData.isFlipped = !isFlipped;
    }
  });
}

// --- API Hook ---
// Exposed on window for easy access if needed, or just exported
(window as any).setPageTexture = setPageTexture;

export function setPageTexture(pageIndex: number, texture: THREE.Texture, side: 'front' | 'back' = 'front'): void {
  // Find the group
  const group = pages.find(p => p.userData.pageIndex === pageIndex) as unknown as THREE.Group;
  if (!group) return;
  
  // Find the mesh inside the group
  const mesh = group.children.find(c => c.userData.side === side) as THREE.Mesh;
  if (!mesh) return;
  
  // Clone texture if back side to avoid affecting other uses
  if (side === 'back') {
    texture = texture.clone();
    texture.center.set(0.5, 0.5);
    texture.rotation = Math.PI;
  }
  
  const mat = mesh.material as THREE.MeshStandardMaterial;
  mat.map = texture;
  mat.needsUpdate = true;
}

// --- Utils ---
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  controls.update();
  renderer.render(scene, camera);
}

// Start
init();
