import * as THREE from 'three';
import { gsap } from 'gsap';
import type { SceneContext } from '../../shared/three/scene';
import { CONFIG } from '../../shared/three/config';
import type {
  CoverUserData,
  PageGroupUserData,
  PageMeshUserData,
  PageSide,
  TabUserData,
} from '../../shared/three/types';
import { findLinkAt } from './linkRegistry';
import type { GltfPropUserData } from '../book/gltfProp';
import { createLetterWriter } from '../contact/contactForm';
import type { ContactLetter } from '../contact/contactLetter';
import { playLetterFlight } from '../contact/letterFlight';

type ViewMode = 'book' | 'letter';

// glTF props are added to the scene asynchronously, so collect them fresh
// on each pointer event rather than caching at setup time.
function collectGltfProps(scene: THREE.Scene): THREE.Object3D[] {
  return scene.children.filter((o) => (o.userData as Partial<GltfPropUserData>).isGltfProp);
}

export function setupInteractions(
  ctx: SceneContext,
  frontCover: THREE.Mesh,
  pageGroups: THREE.Group[],
  extraTargets: THREE.Object3D[] = [],
  contact?: ContactLetter,
) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let busy = false;
  let hoveredTab: THREE.Mesh | null = null;
  const HIGHLIGHT = 0xffff88;
  const contactLetter = contact?.mesh;
  const letterCanvas = contact?.canvas;

  // --- Camera view modes: 'book' (default) and 'letter' (writing). ---
  // Clicking the peeking letter orbits the camera around to face the angled
  // sheet; clicking the peeking book orbits back. The user writes directly on
  // the paper via a hidden input (no modal).
  let viewMode: ViewMode = 'book';
  const currentTarget = new THREE.Vector3(0, 0, 0);
  // lookAt is imperative, so re-apply the (tweened) target every frame.
  ctx.addUpdater(() => ctx.camera.lookAt(currentTarget));
  const writer = contact ? createLetterWriter(contact.canvas) : null;
  // True from a successful send until the "letter flies off" animation finishes;
  // gates letter taps so the in-flight sheet can't be re-submitted.
  let posting = false;

  // Viewport-based zoom-out so the scene stays framed on small screens.
  function viewportScale(): number {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const aspect = w / h;
    let scale = 1;
    if (w <= 360) scale = 1.9;
    else if (w <= 480) scale = 1.7;
    else if (w <= 640) scale = 1.5;
    else if (w <= 820) scale = 1.25;
    else scale = 1;
    if (aspect < 0.7) scale *= 1.1;
    return scale;
  }

  // Camera position + lookAt target for a given mode.
  // - book:   look at the origin from the default raised/tilted offset.
  // - letter: orbit around to face the angled sheet. The look-down angle is set
  //           purely by viewPitchDeg (0 = level, 90 = straight down); the zoom
  //           is the fixed viewDistance, so changing the pitch only tilts the
  //           view without moving the camera nearer/farther. The whole offset is
  //           then yawed by the letter's rotation so we end up square to it.
  function cameraPlacementForMode(mode: ViewMode) {
    const scale = viewportScale();
    if (mode === 'letter') {
      const target = CONFIG.letter.position.clone();
      const pitch = THREE.MathUtils.degToRad(CONFIG.letter.viewPitchDeg);
      // Unit direction from the letter toward the camera: raised by `pitch`,
      // horizontal part pointing along +Z (toward the default viewing side).
      const dir = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch));
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), CONFIG.letter.rotationY);
      const dist = CONFIG.letter.viewDistance * scale;
      return { pos: target.clone().addScaledVector(dir, dist), target };
    }
    return {
      pos: new THREE.Vector3(0, CONFIG.cameraPos.y * scale, CONFIG.cameraPos.z * scale),
      target: new THREE.Vector3(0, 0, 0),
    };
  }

  // Pan the camera (position + lookAt target) to the given mode.
  function panToMode(mode: ViewMode, onComplete?: () => void) {
    const { pos, target } = cameraPlacementForMode(mode);
    busy = true;
    gsap.to(ctx.camera.position, {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      duration: CONFIG.animDuration,
      ease: CONFIG.animEase,
    });
    gsap.to(currentTarget, {
      x: target.x,
      y: target.y,
      z: target.z,
      duration: CONFIG.animDuration,
      ease: CONFIG.animEase,
      onUpdate: () => ctx.camera.lookAt(currentTarget),
      onComplete: () => {
        ctx.controls.target.copy(currentTarget);
        busy = false;
        onComplete?.();
      },
    });
  }

  // --- "Tap the book" teaser: the cover peeks open and closes on a loop ---
  // until the user interacts for the first time, hinting that the book is clickable.
  const TEASER_OPEN_ANGLE = 0.1; // radians the cover lifts at the peak of the hint
  let teaser: gsap.core.Timeline | null = null;
  let teaserStopped = false;

  function startCoverTeaser() {
    const coverUD = frontCover.userData as CoverUserData;
    if (coverUD.isOpen) return; // never run once the book is open
    const pivot = coverUD.parentPivot;
    teaser = gsap.timeline({ repeat: -1, repeatDelay: 1.1, delay: 1.0 });
    teaser
      .to(pivot.rotation, {
        z: TEASER_OPEN_ANGLE,
        duration: 0.7,
        ease: 'sine.inOut',
      })
      .to(pivot.rotation, {
        z: 0,
        duration: 0.7,
        ease: 'sine.inOut',
      });
  }

  // Stop the teaser the moment the user does anything.
  // settleClosed=true gently returns the half-open cover to closed (e.g. on hover);
  // when a click is about to open the cover, leave it so toggleCover owns the rotation.
  function stopCoverTeaser(settleClosed = false) {
    if (teaserStopped) return;
    teaserStopped = true;
    if (teaser) {
      teaser.kill();
      teaser = null;
    }
    const coverUD = frontCover.userData as CoverUserData;
    gsap.killTweensOf(coverUD.parentPivot.rotation);
    if (settleClosed && !coverUD.isOpen) {
      gsap.to(coverUD.parentPivot.rotation, { z: 0, duration: 0.25, ease: 'sine.out' });
    }

    // Fade out the "tap to open" text hint on first interaction.
    const hint = document.getElementById('click-hint');
    if (hint) {
      hint.classList.add('is-hidden');
      window.setTimeout(() => hint.remove(), 700);
    }
  }

  function onWindowResize() {
    ctx.camera.aspect = window.innerWidth / window.innerHeight;
    ctx.camera.updateProjectionMatrix();
    ctx.renderer.setSize(window.innerWidth, window.innerHeight);
    adjustCameraForViewport();
  }

  // Place the camera for the ACTIVE view mode (book or letter). Used on init and
  // resize, so resizing while writing a letter keeps the letter centered instead
  // of snapping back to the book.
  function adjustCameraForViewport() {
    const { pos, target } = cameraPlacementForMode(viewMode);
    ctx.camera.position.copy(pos);
    currentTarget.copy(target);
    ctx.camera.lookAt(currentTarget);
    ctx.controls.target.copy(currentTarget);
  }

  //

  function computeDesiredFlipsFromObject(obj: THREE.Object3D): number {
    const total = pageGroups.length;
    // Walk up to find the page mesh and its group
    let cur: THREE.Object3D | null = obj;
    let pageMesh: THREE.Mesh | null = null;
    let group: THREE.Group | null = null;
    while (cur) {
      const udAny = cur.userData as Partial<PageMeshUserData & PageGroupUserData>;
      if ((udAny as PageMeshUserData).isPageMesh && cur instanceof THREE.Mesh)
        pageMesh = cur as THREE.Mesh;
      if ((udAny as PageGroupUserData).pageIndex != null && cur instanceof THREE.Group) {
        group = cur as THREE.Group;
        break;
      }
      cur = cur.parent;
    }
    if (pageMesh && group) {
      const side = (pageMesh.userData as PageMeshUserData).side;
      const gIndex = (group.userData as PageGroupUserData).pageIndex;
      // Absolute desired flipped count so that:
      // - front side target is on right stack top: flips = total - 1 - gIndex
      // - back side target is on left stack:      flips = total - gIndex
      const flips = side === 'front' ? total - 1 - gIndex : total - gIndex;
      return Math.max(0, Math.min(total, flips));
    }
    // Fallback: derive from TabUserData if available
    const ud = obj.userData as Partial<TabUserData>;
    if (ud && typeof ud.contentIndex === 'number') {
      const p = ud.contentIndex;
      const s = Math.floor(p / 2);
      const flips = p % 2 === 0 ? s : s + 1;
      return Math.max(0, Math.min(total, flips));
    }
    if (ud && typeof ud.targetFlips === 'number')
      return Math.max(0, Math.min(total, ud.targetFlips));
    if (ud && typeof ud.targetPageIndex === 'number')
      return Math.max(0, Math.min(total, ud.targetPageIndex));
    return 0;
  }

  // Has a raycast from the current pointer hit the contact letter mesh?
  function pointerHitsLetter(): boolean {
    if (!contactLetter) return false;
    return raycaster.intersectObject(contactLetter, true).length > 0;
  }

  // The UV (0..1, three.js convention) where the pointer hits the letter, or null.
  function pointerLetterUV(): THREE.Vector2 | null {
    if (!contactLetter) return null;
    const hit = raycaster.intersectObject(contactLetter, true)[0];
    return hit?.uv ?? null;
  }

  // Has a raycast from the current pointer hit the book (cover or any page)?
  function pointerHitsBook(): boolean {
    return raycaster.intersectObjects([frontCover, ...pageGroups], true).length > 0;
  }

  function onMouseClick(event: MouseEvent) {
    // First user action ends the "tap the book" teaser animation
    // and settles the half-open cover back to closed.
    stopCoverTeaser(true);
    if (busy) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, ctx.camera);

    // --- Letter mode: tap a field to switch the caret, tap the book to leave. ---
    // Hard-gate so book flips / tabs never fire while writing the letter.
    if (viewMode === 'letter') {
      // While the sent letter is flying off, ignore all letter taps so it can't
      // be re-submitted or re-focused mid-animation.
      if (posting) return;

      const uv = pointerLetterUV();
      if (uv && letterCanvas) {
        const hit = letterCanvas.hitTest(uv.x, uv.y);
        if (hit === 'send') {
          // Submit; on success, fly the letter off and return to book view.
          writer?.submit(() => {
            posting = true;
            // Pan back to the book shortly after lift-off for a smooth exit.
            window.setTimeout(() => {
              viewMode = 'book';
              panToMode('book');
            }, 700);
            if (contactLetter) {
              playLetterFlight(contactLetter, () => {
                // Flight done: clear the sheet and release the lock.
                writer?.reset();
                posting = false;
              });
            } else {
              writer?.reset();
              posting = false;
            }
          });
          return;
        }
        if (hit) {
          writer?.focusField(hit);
          return;
        }
      }
      if (pointerHitsBook()) {
        writer?.end();
        viewMode = 'book';
        panToMode('book'); // camera-only; book keeps its page state
      }
      return;
    }

    // --- Book mode: clicking the peeking letter orbits over to face it. ---
    if (pointerHitsLetter()) {
      viewMode = 'letter';
      // Pick the tapped field (default subject) and focus the hidden input NOW
      // (synchronously in the click handler) so mobile keyboards open — iOS
      // ignores focus() fired later from the pan callback.
      const uv = pointerLetterUV();
      const hit = uv && letterCanvas ? letterCanvas.hitTest(uv.x, uv.y) : null;
      // Opening the letter focuses a writable field; 'send'/null fall back to subject.
      const field = hit === 'subject' || hit === 'email' || hit === 'message' ? hit : 'subject';
      writer?.begin(field);
      panToMode('letter');
      return;
    }

    // If a tab is currently hovered, prioritize its navigation.
    if (hoveredTab) {
      const ud = hoveredTab.userData as TabUserData;
      if (ud && ud.isTab) {
        const flips = computeDesiredFlipsFromObject(hoveredTab);
        navigateToFlipCount(flips);
        return;
      }
    }

    // Include any clickable glTF props sitting directly under the scene.
    const targets: THREE.Object3D[] = [
      frontCover,
      ...pageGroups,
      ...extraTargets,
      ...collectGltfProps(ctx.scene),
    ];
    const intersects = raycaster.intersectObjects(targets, true);
    if (intersects.length === 0) return;

    // Prioritize tabs regardless of occluding pages
    for (const hit of intersects) {
      const ud0 = hit.object.userData as Partial<CoverUserData & PageMeshUserData & TabUserData> & {
        isTab?: boolean;
      };
      if (ud0.isTab) {
        const flips = computeDesiredFlipsFromObject(hit.object);
        navigateToFlipCount(flips);
        return;
      }
    }

    // glTF prop: walk up from the hit mesh to the prop root and play it.
    for (const hit of intersects) {
      let cur: THREE.Object3D | null = hit.object;
      while (cur) {
        const pud = cur.userData as Partial<GltfPropUserData>;
        if (pud.isGltfProp && typeof pud.play === 'function') {
          pud.play();
          return;
        }
        cur = cur.parent;
      }
    }

    const validTargets = getInteractiveObjects(frontCover, pageGroups);
    // Consider only the first visible hit whose root is in current interactive set
    let firstVisible: THREE.Intersection | null = null;
    for (const h of intersects) {
      const root = getRootObject(h.object as THREE.Mesh);
      if (validTargets.includes(root)) {
        firstVisible = h;
        break;
      }
    }
    // If first visible is a page mesh, handle link click
    if (firstVisible) {
      const obj = firstVisible.object as THREE.Object3D;
      const ud = obj.userData as Partial<PageMeshUserData>;
      if ((ud as PageMeshUserData).isPageMesh && firstVisible.uv) {
        // Find owning page group
        let parent: THREE.Object3D | null = obj;
        let ownerGroup: THREE.Group | null = null;
        while (parent) {
          const pud = parent.userData as Partial<PageGroupUserData>;
          if (pud.pageIndex != null && parent instanceof THREE.Group) {
            ownerGroup = parent as THREE.Group;
            break;
          }
          parent = parent.parent;
        }
        if (ownerGroup) {
          const pageIndex = (ownerGroup.userData as PageGroupUserData).pageIndex;
          const side = (obj.userData as PageMeshUserData).side;
          const uvx = side === 'back' ? 1 - firstVisible.uv.x : firstVisible.uv.x;
          const uvy = side === 'back' ? 1 - firstVisible.uv.y : firstVisible.uv.y;
          const url = findLinkAt(pageIndex, side as PageSide, uvx, uvy);
          if (url) {
            window.open(url, '_blank');
            return;
          }
        }
      }
    }
    for (const hit of intersects) {
      const targetMesh = hit.object as THREE.Mesh;
      const ud = targetMesh.userData as Partial<CoverUserData & PageMeshUserData>;

      const root = getRootObject(targetMesh);
      if (!validTargets.includes(root)) continue;

      if (ud.isCover) {
        toggleCover(targetMesh as THREE.Mesh);
        return;
      }
      if (ud.isPageMesh) {
        const group = targetMesh.parent as THREE.Group;
        togglePage(group);
        return;
      }
    }
  }

  function countFlipped(): number {
    let c = 0;
    for (const g of pageGroups) if ((g.userData as PageGroupUserData).isFlipped) c++;
    return c;
  }

  function rightTopIndex(): number {
    for (let i = pageGroups.length - 1; i >= 0; i--) {
      if (!(pageGroups[i].userData as PageGroupUserData).isFlipped) return i;
    }
    return -1;
  }

  function leftTopIndex(): number {
    for (let i = 0; i < pageGroups.length; i++) {
      if ((pageGroups[i].userData as PageGroupUserData).isFlipped) return i;
    }
    return -1;
  }

  // Flip pages one by one until we reach the desired flip count
  function navigateToFlipCount(desiredFlips: number) {
    const total = pageGroups.length;
    const target = Math.max(0, Math.min(total, desiredFlips));
    const dur = CONFIG.animDuration;
    const stepDelay = dur + 0.06; // small safety margin
    let delay = 0;
    busy = true;

    // Ensure cover is open first
    const coverUD = frontCover.userData as CoverUserData;
    if (!coverUD.isOpen) {
      toggleCover(frontCover);
      delay += stepDelay;
    }

    // Decide direction
    const startFlipped = countFlipped();
    if (target > startFlipped) {
      // flip forward: take from right stack top repeatedly
      for (let k = 0; k < target - startFlipped; k++) {
        gsap.delayedCall(delay, () => {
          const idx2 = rightTopIndex();
          if (idx2 === -1) return;
          const g2 = pageGroups[idx2];
          togglePage(g2);
        });
        delay += stepDelay;
      }
    } else if (target < startFlipped) {
      // flip backward: take from left stack top repeatedly
      for (let k = 0; k < startFlipped - target; k++) {
        gsap.delayedCall(delay, () => {
          const idx2 = leftTopIndex();
          if (idx2 === -1) return;
          const g2 = pageGroups[idx2];
          togglePage(g2);
        });
        delay += stepDelay;
      }
    }

    gsap.delayedCall(delay, () => {
      busy = false;
    });
  }

  function onMouseMove(event: MouseEvent) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, ctx.camera);

    // Show a pointer cursor only over things a click actually responds to.
    // The clickable set depends on the view mode.
    let clickableTargets: THREE.Object3D[];
    if (viewMode === 'letter') {
      // Only "go back to the book" is actionable while writing.
      clickableTargets = [frontCover, ...pageGroups];
    } else {
      // Book mode: top page(s)/cover, tabs, props, and the peeking letter.
      clickableTargets = [
        ...getInteractiveObjects(frontCover, pageGroups),
        ...extraTargets,
        ...collectGltfProps(ctx.scene),
        ...(contactLetter ? [contactLetter] : []),
      ];
    }
    const clickableHits = raycaster.intersectObjects(clickableTargets, true);
    ctx.renderer.domElement.style.cursor = clickableHits.length > 0 ? 'pointer' : 'default';

    // Tab hover highlight only applies in book mode.
    if (viewMode === 'letter') {
      if (hoveredTab) {
        const udPrev = hoveredTab.userData as TabUserData;
        const mPrev = hoveredTab.material as THREE.MeshStandardMaterial;
        if (udPrev.baseColor != null) mPrev.color.setHex(udPrev.baseColor);
        hoveredTab = null;
      }
      return;
    }

    const hits = raycaster.intersectObjects(extraTargets, true);
    let newHover: THREE.Mesh | null = null;
    for (const h of hits) {
      const u = h.object.userData as Partial<TabUserData>;
      if (u && u.isTab) {
        const obj = h.object;
        let vis: THREE.Mesh | null = null;
        if (obj instanceof THREE.Mesh) {
          const mat = obj.material;
          if (mat instanceof THREE.MeshStandardMaterial) {
            vis = obj;
          }
        }
        if (!vis && obj.parent && obj.parent instanceof THREE.Mesh) {
          vis = obj.parent;
        }
        newHover = vis;
        break;
      }
    }
    if (hoveredTab !== newHover) {
      if (hoveredTab) {
        const udPrev = hoveredTab.userData as TabUserData;
        const mPrev = hoveredTab.material as THREE.MeshStandardMaterial;
        if (udPrev.baseColor != null) mPrev.color.setHex(udPrev.baseColor);
      }
      hoveredTab = newHover;
      if (hoveredTab) {
        const ud = hoveredTab.userData as TabUserData;
        const m = hoveredTab.material as THREE.MeshStandardMaterial;
        if (ud.baseColor == null) ud.baseColor = (m.color as THREE.Color).getHex();
        m.color.setHex(HIGHLIGHT);
      }
    }
  }

  // Pointer events support both mouse and touch
  const onPointerDown = (e: PointerEvent) => {
    onMouseClick({ clientX: e.clientX, clientY: e.clientY } as MouseEvent);
  };
  const onPointerMove = (e: PointerEvent) => {
    onMouseMove({ clientX: e.clientX, clientY: e.clientY } as MouseEvent);
  };

  window.addEventListener('resize', onWindowResize);
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  // Initial camera fit
  adjustCameraForViewport();

  // Begin the "tap the book" teaser once everything is set up.
  startCoverTeaser();

  return {
    dispose: () => {
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      if (teaser) teaser.kill();
      writer?.dispose();
    },
  };
}

export function makeSetPageTexture(pageGroups: THREE.Group[]) {
  return function setPageTexture(
    pageIndex: number,
    texture: THREE.Texture,
    side: PageSide = 'front',
  ) {
    const group = pageGroups.find((g) => (g.userData as PageGroupUserData).pageIndex === pageIndex);
    if (!group) return;
    const mesh = group.children.find((c) => (c.userData as PageMeshUserData).side === side) as
      | THREE.Mesh
      | undefined;
    if (!mesh) return;
    if (side === 'back') {
      texture = texture.clone();
      texture.center.set(0.5, 0.5);
      texture.rotation = Math.PI;
    }
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.map = texture;
    mat.needsUpdate = true;
  };
}

function getRootObject(mesh: THREE.Mesh): THREE.Object3D {
  const ud = mesh.userData as Partial<CoverUserData & PageMeshUserData>;
  if (ud.isCover) return mesh;
  if (ud.isPageMesh && mesh.parent) return mesh.parent;
  return mesh;
}

function getInteractiveObjects(
  frontCover: THREE.Mesh,
  pageGroups: THREE.Group[],
): THREE.Object3D[] {
  const interactive: THREE.Object3D[] = [];
  const isOpen = (frontCover.userData as CoverUserData).isOpen;

  if (!isOpen) {
    interactive.push(frontCover);
  } else {
    // Right stack top: highest index not flipped
    let topRight: THREE.Group | null = null;
    for (let i = pageGroups.length - 1; i >= 0; i--) {
      if (!(pageGroups[i].userData as PageGroupUserData).isFlipped) {
        topRight = pageGroups[i];
        break;
      }
    }
    if (topRight) interactive.push(topRight);

    // Left stack top: lowest index that is flipped
    let topLeft: THREE.Group | null = null;
    for (let i = 0; i < pageGroups.length; i++) {
      if ((pageGroups[i].userData as PageGroupUserData).isFlipped) {
        topLeft = pageGroups[i];
        break;
      }
    }
    if (topLeft) interactive.push(topLeft);
    else interactive.push(frontCover);
  }

  return interactive;
}

function toggleCover(mesh: THREE.Mesh) {
  const ud = mesh.userData as CoverUserData;
  const pivot = ud.parentPivot;
  const isOpen = ud.isOpen;

  // Cancel any leftover teaser tween so it doesn't fight this open/close animation.
  gsap.killTweensOf(pivot.rotation);

  const targetRot = isOpen ? 0 : Math.PI;
  const rightY =
    CONFIG.coverThickness + CONFIG.pageCount * CONFIG.pageThickness + CONFIG.coverThickness / 2;
  const leftY = CONFIG.coverThickness / 2;
  const targetY = isOpen ? rightY : leftY;

  gsap.to(pivot.rotation, { z: targetRot, duration: CONFIG.animDuration, ease: CONFIG.animEase });
  gsap.to(pivot.position, {
    y: targetY,
    duration: CONFIG.animDuration,
    ease: CONFIG.animEase,
    onComplete: () => {
      ud.isOpen = !isOpen;
    },
  });
}

function togglePage(group: THREE.Group) {
  const ud = group.userData as PageGroupUserData;
  const isFlipped = ud.isFlipped;
  const index = ud.pageIndex;

  const openRot = Math.PI;
  const targetRot = isFlipped ? 0 : openRot;
  const EPS = 0.001;
  const rightY = CONFIG.coverThickness + index * CONFIG.pageThickness + EPS;
  const leftY = CONFIG.coverThickness + (CONFIG.pageCount - 1 - index) * CONFIG.pageThickness + EPS;
  const targetY = isFlipped ? rightY : leftY;

  gsap.to(group.rotation, { z: targetRot, duration: CONFIG.animDuration, ease: CONFIG.animEase });
  gsap.to(group.position, {
    y: targetY,
    duration: CONFIG.animDuration,
    ease: CONFIG.animEase,
    onComplete: () => {
      ud.isFlipped = !isFlipped;
    },
  });
}

//
//
