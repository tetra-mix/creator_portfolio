import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CONFIG } from './config'

export interface SceneContext {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
}

export function createScene(app: HTMLElement): SceneContext {
  const scene = new THREE.Scene()

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.copy(CONFIG.cameraPos)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = CONFIG.exposure
  app.appendChild(renderer.domElement)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.minDistance = 5
  controls.maxDistance = 15
  controls.maxPolarAngle = Math.PI / 2 - 0.1
  // Fix camera: disable user interaction and lock view
  controls.enabled = false
  controls.target.set(0, 0, 0)
  camera.lookAt(0, 0, 0)

  // Lights
  scene.add(new THREE.AmbientLight(CONFIG.ambientColor as any, CONFIG.ambientIntensity))
  const hemi = new THREE.HemisphereLight(CONFIG.hemiSkyColor as any, CONFIG.hemiGroundColor as any, CONFIG.hemiIntensity)
  hemi.position.set(0, 8, 0)
  scene.add(hemi)
  const dirLight = new THREE.DirectionalLight(CONFIG.dirColor as any, CONFIG.dirIntensity)
  dirLight.position.set(4, 6, 2)
  dirLight.castShadow = true
  dirLight.shadow.mapSize.width = 1024
  dirLight.shadow.mapSize.height = 1024
  ;(dirLight.shadow as any).radius = 3
  scene.add(dirLight)

  return { scene, camera, renderer, controls }
}
