/**
 * Гэрийн 3D хөдөлгүүр — three.js + expo-gl (React-гүй, императив)
 *
 * АРХИТЕКТУР
 *   GerEngine   рендерер, үзэгдэл, гэрэл, камер, анимац, raycast
 *   cameraRig   камерын цэвэр математик              (tests/ger3d.test.ts)
 *   sceneRules  байрлуулсан эд → зангилааны харагдац  (tests/ger3d.test.ts)
 *   Ger3DView   React бүрхүүл: GLView, дохио зангаа, шошго
 *
 * ГҮЙЦЭТГЭЛ (дунд зэргийн Android утсанд зориулсан)
 *   • Текстургүй GLB, AO нь оройн өнгөнд шатаагдсан
 *   • Зөвхөн сарны гэрэл сүүдэр үүсгэнэ (1024²); доторх гал сүүдэргүй
 *   • Гэрлийг унтраахдаа `visible` биш `intensity = 0` — гэрлийн тоо
 *     өөрчлөгдвөл three.js бүх shader-ийг дахин хөрвүүлж дэлгэц гацна
 *   • Хөдөлгөөнгүй үед 30 FPS, харилцан үйлдэл ба шилжилтэд 60 FPS
 *   • Апп ард гарах / дэлгэц солигдоход рендер бүрэн зогсоно
 *
 * ⚠ THREE.JS 0.162.0-Д ТҮГЖСЭН (package.json-д «^»-гүй) — expo-gl-ийн шалтгаан:
 *   1. expo-gl EGL config-оо зөвхөн ES2 битээр сонгож ES3 контекст хүснэ;
 *      бүтэхгүй бол ES2 = WebGL1 руу буцна. Төхөөрөмжөөс хамаарна —
 *      Android эмулятор дээр EGL_BAD_MATCH (0x3009) гарч WebGL1 болсон.
 *   2. three r163+ WebGL1-ийг бүрэн хассан. Дээр нь expo-gl-ийн
 *      WebGL2RenderingContext нь WebGLRenderingContext-ээс удамшдаг тул
 *      r163+ жинхэнэ WebGL2 дээр ч «WebGL 1 is not supported» гэж унана.
 *   r162 нь WebGL1 ба WebGL2 хоёуланд ажилладаг сүүлийн хувилбар. Шинэчлэхээс
 *   өмнө энэ хоёр асуудал шийдэгдсэн эсэхийг эмулятор + бодит утсан дээр шалга.
 */
import * as THREE from 'three';
import type { ExpoWebGLRenderingContext } from 'expo-gl';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  clamp,
  clampLook,
  clampOrbit,
  damp,
  dampAngle,
  easeInOutCubic,
  lerp,
  lerpVec,
  lookAt,
  lookTarget,
  orbitFromPosition,
  orbitPosition,
  pathLength,
  pathParam,
  shortestAngle,
  type Look,
  type Orbit,
  type Vec3,
  ORBIT_LIMITS,
  fitRadius,
  type OrbitLimits,
} from './cameraRig';
import type { SceneState } from './sceneRules';

export type CameraMode = 'orbit' | 'entering' | 'inside' | 'exiting';
export type PickResult = { kind: 'item'; key: string } | { kind: 'door' } | null;
export interface Projected {
  x: number;
  y: number;
  visible: boolean;
}

const ORBIT_FOV = 50;
const INSIDE_FOV = 64;
const LIGHT_BASE = { stove: 14, hearth: 16, zul: 1.6 } as const;
const ANCHOR_RE = /^(anchor_|cam_|light_|smoke_|orbit_)/;

interface Transition {
  path: Vec3[];
  looks: Vec3[];
  t: number;
  duration: number;
  fovFrom: number;
  fovTo: number;
  to: 'inside' | 'orbit';
}

/** Давтагдах санамсаргүй тоо — одод дахин ачаалах бүрт үсрэхгүй */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Утааны зөөлөн толбо — зураг задлахгүй, санах ойд үүсгэнэ */
function softDot(): THREE.DataTexture {
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  const c = (n - 1) / 2;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const a = Math.max(0, 1 - Math.hypot(x - c, y - c) / c);
      const i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(a * a * (3 - 2 * a) * 255);
    }
  }
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
}

/**
 * expo-gl нь WebGL2-ийн цөөн функцийг бүрэн хэрэгжүүлээгүй:
 *   • three.js гаднаас контекст өгөхөд `getContextAttributes()`-ийг дууддаг
 *     — байхгүй эсвэл null бол эхлэхэд л унана.
 *   • `UNPACK_PREMULTIPLY_ALPHA_WEBGL`, `UNPACK_COLORSPACE_CONVERSION_WEBGL`
 *     дэмжигдээгүй — three текст бүрт дуудаж логийг дүүргэнэ.
 */
function patchContext(gl: ExpoWebGLRenderingContext): void {
  const g = gl as unknown as Record<string, unknown>;
  const defaults = {
    alpha: true,
    antialias: false,
    depth: true,
    stencil: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: 'default',
    failIfMajorPerformanceCaveat: false,
    desynchronized: false,
  };
  try {
    const orig =
      typeof g.getContextAttributes === 'function'
        ? (g.getContextAttributes as () => unknown).bind(gl)
        : null;
    g.getContextAttributes = () => {
      try {
        return (orig?.() as object | null) ?? defaults;
      } catch {
        return defaults;
      }
    };
    const pixelStorei = (gl.pixelStorei as (p: number, v: number | boolean) => void).bind(gl);
    const ignored = new Set([0x9241, 0x9243]);
    g.pixelStorei = (p: number, v: number | boolean) => {
      if (!ignored.has(p)) pixelStorei(p, v);
    };
  } catch {
    // Host object бичих эрхгүй бол анхны функцээр л үргэлжилнэ
  }
}

function isShown(o: THREE.Object3D | null): boolean {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

export class GerEngine {
  onFrame: (() => void) | null = null;
  onModeChange: ((mode: CameraMode) => void) | null = null;

  private readonly gl: ExpoWebGLRenderingContext;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly raycaster = new THREE.Raycaster();
  private readonly tmp = new THREE.Vector3();
  private readonly anchors = new Map<string, THREE.Vector3>();
  private readonly viewW: number;
  private readonly viewH: number;

  private root: THREE.Object3D | null = null;
  private envTexture: THREE.Texture | null = null;
  private flames: { mat: THREE.MeshStandardMaterial; base: number }[] = [];
  private smoke: THREE.Sprite[] = [];
  private smokeOrigin = new THREE.Vector3(0.22, 3.47, -0.22);
  private lights!: {
    stove: THREE.PointLight;
    hearth: THREE.PointLight;
    zul: THREE.PointLight;
    toono: THREE.PointLight;
    door: THREE.SpotLight;
  };
  private state: SceneState | null = null;

  private mode: CameraMode = 'orbit';
  private target: Vec3 = { x: 0, y: 1.35, z: 0 };
  private orbit: Orbit = { theta: 0.55, phi: 0.36, radius: 11.5 };
  private orbitGoal: Orbit = { theta: 0.55, phi: 0.36, radius: 11.5 };
  /** Дэлгэцийн харьцаанд тааруулсан анхдагч зай ба хязгаар (fitToAspect) */
  private fit = 11.5;
  private limits: OrbitLimits = { ...ORBIT_LIMITS };
  private look: Look = { yaw: 0, pitch: -0.12, fov: INSIDE_FOV };
  private lookGoal: Look = { yaw: 0, pitch: -0.12, fov: INSIDE_FOV };
  private insideEye: Vec3 = { x: 0, y: 1.68, z: 2.05 };
  private insideLook: Vec3 = { x: 0, y: 1.15, z: -1.4 };
  private doorEye: Vec3 = { x: 0, y: 1.6, z: 5.6 };
  private doorLook: Vec3 = { x: 0, y: 1.1, z: 3.0 };
  private transition: Transition | null = null;
  private fov = ORBIT_FOV;

  private running = false;
  private paused = false;
  private raf = 0;
  private frame = 0;
  private last = 0;
  private elapsed = 0;
  private lastInput = 0;

  constructor(gl: ExpoWebGLRenderingContext, viewW: number, viewH: number) {
    this.gl = gl;
    this.viewW = viewW;
    this.viewH = viewH;
    patchContext(gl);

    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const canvas = {
      width: w,
      height: h,
      clientWidth: w,
      clientHeight: h,
      style: {},
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      getContext: () => gl,
    } as unknown as HTMLCanvasElement;

    // WebGL1 дээр three «хуучирсан» гэж console.warn хийдэг. Энэ нь бидний
    // САНААТАЙ сонголт (дээрх тайлбарыг үз) тул Metro лог бохирдуулахгүй —
    // зөвхөн энэ нэг мессежийг, зөвхөн рендерер үүсгэх хормыг хамруулна.
    const warn = console.warn;
    console.warn = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes('WebGL 1 support was deprecated')) return;
      warn(...args);
    };
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        context: gl as unknown as WebGL2RenderingContext,
        antialias: false,
        powerPreference: 'high-performance',
      });
    } finally {
      console.warn = warn;
    }
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.camera = new THREE.PerspectiveCamera(ORBIT_FOV, w / h, 0.05, 400);
    this.fitToAspect(w / h);
    this.buildSky(w / viewW);
    this.buildLights();
  }

  // ─── Орчин ─────────────────────────────────────────────────────────

  /**
   * ⚠ Тогтмол зай босоо утсан дээр ажиллахгүй: 42° FOV-д хэвтээ өнцөг ~24°
   *   л тул 11.5 м-ээс гэр дэлгэцээс халиж байв. Зайг харьцаанаас тооцоолно.
   */
  private fitToAspect(aspect: number): void {
    this.fit = fitRadius(ORBIT_FOV, aspect);
    this.limits = { ...ORBIT_LIMITS, radiusMin: this.fit * 0.5, radiusMax: this.fit * 1.3 };
    this.orbit.radius = this.fit;
    this.orbitGoal.radius = this.fit;
  }

  private buildSky(px: number): void {
    const s = this.scene;
    s.background = new THREE.Color('#050912');
    s.fog = new THREE.FogExp2('#0B1424', 0.012);

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(190, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color('#03060D') },
          horizon: { value: new THREE.Color('#1B2A46') },
        },
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform vec3 top;
          uniform vec3 horizon;
          varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y, 0.0, 1.0);
            gl_FragColor = vec4(mix(horizon, top, pow(h, 0.55)), 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    );
    sky.renderOrder = -1;
    s.add(sky);

    // Одод — тэнгэрийн оройд нягт; гэрт орж тоонооор харахад харагдана
    const rand = mulberry32(20260911);
    const N = 650;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const th = rand() * Math.PI * 2;
      const y = 0.06 + 0.94 * Math.pow(rand(), 0.8);
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(th) * r * 170, y * 170, Math.sin(th) * r * 170], i * 3);
      const b = 0.35 + 0.65 * rand();
      col.set(rand() < 0.15 ? [b, b * 0.86, b * 0.62] : [b * 0.9, b * 0.95, b], i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    s.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({
          size: 1.7 * px,
          sizeAttenuation: false,
          vertexColors: true,
          fog: false,
          transparent: true,
          depthWrite: false,
        }),
      ),
    );

    // Долоон бурхан — хойд тэнгэрт (MuseumScreen-ийн 2D тэнгэртэй ижил хэлбэр)
    const dipper = [
      [0.05, 0.08], [0.11, 0.055], [0.165, 0.075], [0.215, 0.115],
      [0.295, 0.105], [0.3, 0.19], [0.225, 0.2],
    ].map(([u, v]) => {
      const az = (u - 0.175) * 2.2;
      const el = 0.8 - (v - 0.05) * 2.6;
      return new THREE.Vector3(
        Math.sin(az) * Math.cos(el),
        Math.sin(el),
        -Math.cos(az) * Math.cos(el),
      ).multiplyScalar(165);
    });
    const gold = new THREE.Color('#F5D38A');
    s.add(
      new THREE.Points(
        new THREE.BufferGeometry().setFromPoints(dipper),
        new THREE.PointsMaterial({ size: 3.4 * px, sizeAttenuation: false, color: gold, fog: false }),
      ),
    );
    const links = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 3].map((i) => dipper[i]);
    s.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(links),
        new THREE.LineBasicMaterial({ color: gold, transparent: true, opacity: 0.22, fog: false }),
      ),
    );

    // Тал нутаг + тэнгэрийн хаяаны уулс — манан уусгана
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(110, 64),
      new THREE.MeshStandardMaterial({ color: '#0F2019', roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    s.add(ground);

    const seg = 160;
    const hp: number[] = [];
    const hi: number[] = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const hgt = Math.max(
        0.8,
        3 + 2.4 * Math.sin(3 * a + 1) + 1.5 * Math.sin(7 * a + 2.3) + 0.9 * Math.sin(13 * a + 0.7),
      );
      const x = Math.cos(a) * 95;
      const z = Math.sin(a) * 95;
      hp.push(x, -0.5, z, x, hgt, z);
    }
    for (let i = 0; i < seg; i++) {
      const b = i * 2;
      hi.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
    const hills = new THREE.BufferGeometry();
    hills.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
    hills.setIndex(hi);
    s.add(new THREE.Mesh(hills, new THREE.MeshBasicMaterial({ color: '#0A1320', side: THREE.DoubleSide })));
  }

  private buildLights(): void {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#8095C8', '#18261E', 0.85));

    const moon = new THREE.DirectionalLight('#DCE5FF', 1.7);
    moon.position.set(-7, 11, 6);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    const cam = moon.shadow.camera;
    cam.left = -6.5;
    cam.right = 6.5;
    cam.top = 6.5;
    cam.bottom = -6.5;
    cam.near = 1;
    cam.far = 40;
    moon.shadow.bias = -0.0006;
    moon.shadow.normalBias = 0.025;
    moon.target.position.set(0, 1, 0);
    s.add(moon, moon.target);

    const stove = new THREE.PointLight('#FF9A45', LIGHT_BASE.stove, 9, 2);
    const hearth = new THREE.PointLight('#FF8E3C', 0, 9, 2);
    const zul = new THREE.PointLight('#FFC060', 0, 3.5, 2);
    const toono = new THREE.PointLight('#8EA7D9', 3, 6, 2);
    const door = new THREE.SpotLight('#FFB45C', 22, 9, 0.8, 0.6, 2);
    s.add(stove, hearth, zul, toono, door, door.target);
    this.lights = { stove, hearth, zul, toono, door };
  }

  // ─── Загвар ────────────────────────────────────────────────────────

  setModel(gltf: GLTF): void {
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const metals = new Set<THREE.MeshStandardMaterial>();
    const flames = new Map<THREE.MeshStandardMaterial, number>();

    root.traverse((o) => {
      if (ANCHOR_RE.test(o.name)) {
        this.anchors.set(o.name, o.getWorldPosition(new THREE.Vector3()));
      }
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mesh.receiveShadow = true;
      mesh.castShadow = mat.name !== 'blade';
      if (mat.emissive && mat.emissive.getHex() !== 0 && mat.emissiveIntensity > 0) {
        flames.set(mat, mat.emissiveIntensity);
      }
      if (mat.metalness >= 0.5) metals.add(mat);
    });
    this.flames = [...flames].map(([mat, base]) => ({ mat, base }));

    const at = (name: string, fallback: Vec3): Vec3 => {
      const v = this.anchors.get(name);
      return v ? { x: v.x, y: v.y, z: v.z } : fallback;
    };
    this.target = at('orbit_target', this.target);
    this.insideEye = at('cam_inside', this.insideEye);
    this.insideLook = at('cam_inside_look', this.insideLook);
    this.doorEye = at('cam_door', this.doorEye);
    this.doorLook = at('cam_door_look', this.doorLook);

    const place = (light: THREE.Object3D, name: string) => {
      const v = this.anchors.get(name);
      if (v) light.position.copy(v);
    };
    place(this.lights.stove, 'light_stove');
    place(this.lights.hearth, 'light_hearth');
    place(this.lights.zul, 'light_zul');
    place(this.lights.toono, 'light_toono');
    place(this.lights.door, 'light_door');
    this.lights.door.target.position.set(0.3, 0, this.lights.door.position.z + 3.2);
    const smoke = this.anchors.get('smoke_origin');
    if (smoke) this.smokeOrigin.copy(smoke);

    this.scene.add(root);
    this.root = root;
    this.buildSmoke();
    this.applyEnvironment(metals);
    if (this.state) this.applyState(this.state);
  }

  /**
   * Алт, хүрэлд л орчны тусгал — бүх материалд өгвөл гэрийн дотор саарал манантай болно.
   * ⚠ Зөвхөн WebGL2: PMREM нь half-float render target шаарддаг. expo-gl-ийн WebGL1
   *   дээр энэ нь найдваргүй бөгөөд GL алдаа exception шиддэггүй тул try/catch
   *   хамгаалж чадахгүй — алт хар болж харагддаг.
   */
  private applyEnvironment(metals: Set<THREE.MeshStandardMaterial>): void {
    if (!this.renderer.capabilities.isWebGL2) return;
    const ext = this.renderer.extensions;
    if (!ext.has('EXT_color_buffer_float') && !ext.has('EXT_color_buffer_half_float')) return;
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const room = new RoomEnvironment();
      this.envTexture = pmrem.fromScene(room, 0.04).texture;
      pmrem.dispose();
      (room as unknown as { dispose?: () => void }).dispose?.();
      metals.forEach((m) => {
        m.envMap = this.envTexture;
        m.envMapIntensity = 0.55;
        m.needsUpdate = true;
      });
    } catch {
      // Орчны тусгалгүй — алт бага зэрэг бүдэг ч ажиллана
    }
  }

  private buildSmoke(): void {
    const tex = softDot();
    for (let i = 0; i < 18; i++) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          color: '#E6D6B8',
          transparent: true,
          depthWrite: false,
          opacity: 0,
        }),
      );
      sprite.userData.phase = i / 18;
      this.scene.add(sprite);
      this.smoke.push(sprite);
    }
  }

  applyState(state: SceneState): void {
    this.state = state;
    if (!this.root) return;
    for (const [name, vis] of Object.entries(state.visible)) {
      const o = this.root.getObjectByName(name);
      if (o) o.visible = vis;
    }
  }

  // ─── Оролт ─────────────────────────────────────────────────────────

  getMode(): CameraMode {
    return this.mode;
  }

  cameraPosition(): Vec3 {
    const p = this.camera.position;
    return { x: p.x, y: p.y, z: p.z };
  }

  drag(dx: number, dy: number): void {
    this.lastInput = this.elapsed;
    if (this.mode === 'orbit') {
      this.orbitGoal = clampOrbit(
        {
          ...this.orbitGoal,
          theta: this.orbitGoal.theta - dx * 0.008,
          phi: this.orbitGoal.phi + dy * 0.005,
        },
        this.limits,
      );
    } else if (this.mode === 'inside') {
      this.lookGoal = clampLook({
        ...this.lookGoal,
        yaw: this.lookGoal.yaw + dx * 0.0055,
        pitch: this.lookGoal.pitch + dy * 0.0045,
      });
    }
  }

  pinch(scale: number): void {
    this.lastInput = this.elapsed;
    if (scale <= 0) return;
    if (this.mode === 'orbit') {
      this.orbitGoal = clampOrbit(
        { ...this.orbitGoal, radius: this.orbitGoal.radius / scale },
        this.limits,
      );
    } else if (this.mode === 'inside') {
      this.lookGoal = clampLook({ ...this.lookGoal, fov: this.lookGoal.fov / scale });
    }
  }

  pick(x: number, y: number): PickResult {
    if (!this.root || this.transition) return null;
    this.lastInput = this.elapsed;
    const ndc = new THREE.Vector2((x / this.viewW) * 2 - 1, -(y / this.viewH) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    for (const hit of this.raycaster.intersectObject(this.root, true)) {
      if (!isShown(hit.object)) continue;
      for (let o: THREE.Object3D | null = hit.object; o && o !== this.root; o = o.parent) {
        if (o.name.startsWith('item_')) return { kind: 'item', key: o.name.slice(5) };
      }
      const p = hit.point;
      if (this.mode === 'orbit' && Math.abs(p.x) < 0.8 && p.y < 1.9 && p.z > 2.6) return { kind: 'door' };
      // Эхний харагдах гадаргуу л тооцогдоно — ханын ард байгааг сонгохгүй
      return null;
    }
    return null;
  }

  /**
   * Гэрт орох: одоогийн байрлалаас тойрог нумаар хаалганы өмнө бууж,
   * БОСГЫГ ГИШГЭЛГҮЙ тонгойж орно (хаалганы өндөр 1.25 м), дотор нь
   * босож хоймор руу харна. Шулуун зам гэрийн дундуур гарч болох тул нум.
   */
  enter(): void {
    if (this.mode !== 'orbit' || !this.root) return;
    const door = orbitFromPosition(this.doorEye, this.target);
    const dTheta = shortestAngle(this.orbit.theta, door.theta);
    const steps = 10;
    const path: Vec3[] = [];
    const looks: Vec3[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      path.push(
        orbitPosition(
          {
            theta: this.orbit.theta + dTheta * t,
            phi: lerp(this.orbit.phi, door.phi, t),
            radius: lerp(this.orbit.radius, door.radius, t),
          },
          this.target,
        ),
      );
      looks.push(lerpVec(this.target, this.doorLook, t));
    }
    const duck = this.doorLook.y + 0.12;
    const outside = { x: 0.06, y: duck, z: this.doorLook.z + 0.45 };
    const inside = { x: 0.06, y: duck, z: this.doorLook.z - 0.55 };
    path.push(outside, inside, this.insideEye);
    looks.push(this.doorLook, lerpVec(this.doorLook, this.insideLook, 0.6), this.insideLook);
    this.startTransition(path, looks, 'inside');
  }

  /** Гарах: хоймор руу харсаар ухарч гарна, дараа нь дээш өргөгдөж гэрийг тойрно */
  exit(): void {
    if (this.mode !== 'inside') return;
    const duck = this.doorLook.y + 0.12;
    const cur = this.cameraPosition();
    const curLook = lookTarget(cur, this.look);
    const end = orbitPosition({ theta: 0.0, phi: 0.3, radius: this.fit * 0.95 }, this.target);
    const path = [
      cur,
      { x: 0.06, y: duck, z: this.doorLook.z - 0.55 },
      { x: 0.06, y: duck, z: this.doorLook.z + 0.45 },
      this.doorEye,
      end,
    ];
    const looks = [curLook, this.insideLook, this.insideLook, this.doorLook, this.target];
    this.startTransition(path, looks, 'orbit');
  }

  resetView(): void {
    this.lastInput = this.elapsed;
    if (this.mode === 'orbit') this.orbitGoal = { theta: 0.55, phi: 0.36, radius: this.fit };
    else if (this.mode === 'inside') {
      const la = lookAt(this.insideEye, this.insideLook);
      this.lookGoal = { yaw: la.yaw, pitch: la.pitch, fov: INSIDE_FOV };
    }
  }

  private startTransition(path: Vec3[], looks: Vec3[], to: 'inside' | 'orbit'): void {
    this.transition = {
      path,
      looks,
      t: 0,
      duration: clamp(1.4 + pathLength(path) * 0.13, 2.0, 3.6),
      fovFrom: this.fov,
      fovTo: to === 'inside' ? INSIDE_FOV : ORBIT_FOV,
      to,
    };
    this.setMode(to === 'inside' ? 'entering' : 'exiting');
  }

  private setMode(mode: CameraMode): void {
    this.mode = mode;
    this.lastInput = this.elapsed;
    this.onModeChange?.(mode);
  }

  // ─── Шошгоны проекц ────────────────────────────────────────────────

  project(anchor: string, out: Projected): Projected {
    const p = this.anchors.get(anchor);
    if (!p) {
      out.visible = false;
      return out;
    }
    this.tmp.copy(p).project(this.camera);
    out.x = (this.tmp.x + 1) * 0.5 * this.viewW;
    out.y = (1 - this.tmp.y) * 0.5 * this.viewH;
    out.visible =
      this.tmp.z > -1 && this.tmp.z < 1 && Math.abs(this.tmp.x) < 1.05 && Math.abs(this.tmp.y) < 1.05;
    return out;
  }

  // ─── Давталт ───────────────────────────────────────────────────────

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = Date.now();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const now = Date.now();
      const dt = Math.min((now - this.last) / 1000, 0.1);
      this.last = now;
      if (this.paused) return;
      this.update(dt);
      this.frame++;
      const busy = this.transition !== null || this.elapsed - this.lastInput < 1.5;
      if (!busy && this.frame % 2 === 1) return; // хөдөлгөөнгүй — 30 FPS
      this.renderer.render(this.scene, this.camera);
      this.gl.endFrameEXP();
      this.onFrame?.();
    };
    this.raf = requestAnimationFrame(loop);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.last = Date.now();
  }

  private update(dt: number): void {
    this.elapsed += dt;

    if (this.transition) {
      const tr = this.transition;
      tr.t = Math.min(1, tr.t + dt / tr.duration);
      const e = easeInOutCubic(tr.t);
      const { index, u } = pathParam(tr.path, e);
      const pos = lerpVec(tr.path[index], tr.path[index + 1] ?? tr.path[index], u);
      const look = lerpVec(tr.looks[index], tr.looks[index + 1] ?? tr.looks[index], u);
      this.fov = lerp(tr.fovFrom, tr.fovTo, e);
      this.camera.position.set(pos.x, pos.y, pos.z);
      this.camera.lookAt(look.x, look.y, look.z);
      if (tr.t >= 1) {
        this.transition = null;
        if (tr.to === 'inside') {
          const la = lookAt(this.insideEye, this.insideLook);
          this.look = { yaw: la.yaw, pitch: la.pitch, fov: INSIDE_FOV };
          this.lookGoal = { ...this.look };
          this.setMode('inside');
        } else {
          this.orbit = orbitFromPosition(pos, this.target);
          this.orbitGoal = clampOrbit({ ...this.orbit }, this.limits);
          this.setMode('orbit');
        }
      }
    } else if (this.mode === 'orbit') {
      // 5 сек хүрэлгүй бол аажим эргэлдэнэ — «амьд» диорама
      if (this.elapsed - this.lastInput > 5) this.orbitGoal.theta += dt * 0.08;
      this.orbit.theta = dampAngle(this.orbit.theta, this.orbitGoal.theta, 7, dt);
      this.orbit.phi = damp(this.orbit.phi, this.orbitGoal.phi, 7, dt);
      this.orbit.radius = damp(this.orbit.radius, this.orbitGoal.radius, 7, dt);
      this.fov = damp(this.fov, ORBIT_FOV, 6, dt);
      const p = orbitPosition(this.orbit, this.target);
      this.camera.position.set(p.x, p.y, p.z);
      this.camera.lookAt(this.target.x, this.target.y, this.target.z);
    } else if (this.mode === 'inside') {
      this.look.yaw = dampAngle(this.look.yaw, this.lookGoal.yaw, 9, dt);
      this.look.pitch = damp(this.look.pitch, this.lookGoal.pitch, 9, dt);
      this.look.fov = damp(this.look.fov, this.lookGoal.fov, 9, dt);
      this.fov = this.look.fov;
      const t = lookTarget(this.insideEye, this.look);
      this.camera.position.set(this.insideEye.x, this.insideEye.y, this.insideEye.z);
      this.camera.lookAt(t.x, t.y, t.z);
    }

    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
    this.animateFire();
    this.animateSmoke();
  }

  private animateFire(): void {
    const t = this.elapsed;
    const f =
      0.82 + 0.1 * Math.sin(t * 11.3) + 0.06 * Math.sin(t * 23.7 + 1.3) + 0.04 * Math.sin(t * 5.1 + 0.4);
    for (const fl of this.flames) fl.mat.emissiveIntensity = fl.base * f;
    const fire = this.state?.fire ?? 'stove';
    this.lights.stove.intensity = fire === 'stove' ? LIGHT_BASE.stove * f : 0;
    this.lights.hearth.intensity = fire === 'hearth' ? LIGHT_BASE.hearth * f : 0;
    this.lights.zul.intensity = this.state?.lamp ? LIGHT_BASE.zul * (0.94 + 0.06 * Math.sin(t * 7.7)) : 0;
  }

  private animateSmoke(): void {
    const t = this.elapsed;
    const o = this.smokeOrigin;
    for (const s of this.smoke) {
      const phase = s.userData.phase as number;
      const p = (phase + t * 0.085) % 1;
      const wobble = Math.sin(t * 0.7 + phase * 9) * 0.08;
      s.position.set(o.x + 0.9 * Math.pow(p, 1.6) + wobble, o.y + p * 2.4, o.z - 0.25 * p);
      const sc = 0.22 + 1.25 * p;
      s.scale.set(sc, sc, 1);
      (s.material as THREE.SpriteMaterial).opacity =
        (p < 0.1 ? p / 0.1 : Math.pow(1 - (p - 0.1) / 0.9, 1.4)) * 0.5;
    }
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.onFrame = null;
    this.onModeChange = null;
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
        mat.dispose();
      }
    });
    this.envTexture?.dispose();
    this.renderer.dispose();
  }
}
