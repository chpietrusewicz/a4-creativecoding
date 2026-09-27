import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Pane } from "tweakpane";
import { createNoise2D } from "simplex-noise";
import alea from "alea";

// ---------- field notes toggle ----------
const fieldNotes = document.getElementById("field-notes");
const fieldNotesToggle = document.getElementById("field-notes-toggle");
fieldNotesToggle.addEventListener("click", () => {
  const collapsed = fieldNotes.classList.toggle("collapsed");
  fieldNotesToggle.setAttribute("aria-expanded", String(!collapsed));
});

// ---------- renderer / scene / camera ----------
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14201d);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(60, 55, 60);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.05;

scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(80, 100, 40);
scene.add(sun);

const SIZE = 100;
const SEGMENTS = 128;

const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
geometry.rotateX(-Math.PI / 2);

const material = new THREE.MeshStandardMaterial({
  color: 0x7c9070,
  flatShading: true,
  side: THREE.DoubleSide,
});

const terrain = new THREE.Mesh(geometry, material);
scene.add(terrain);

const waterGeometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
waterGeometry.rotateX(-Math.PI / 2);

const waterMaterial = new THREE.MeshStandardMaterial({
  color: 0x006eff,
  transparent: true,
  opacity: 0.75,
  side: THREE.DoubleSide,
});

const water = new THREE.Mesh(waterGeometry, waterMaterial);

water.position.y = -0.15;
scene.add(water);

const params = {
  frequency: 0.05,
  elevation: 8,
  octaves: 4,
  smoothing: 0,
  seed: 1,
  wireframe: false,
  color: "#7c9070",
  islandRadius: 1,
  falloffSharpness: 2,
  seaLevel: -0.15,
};

const gridSize = SEGMENTS + 1;
const maxRadius = SIZE / 2;

function regenerate() {
  const posAttr = geometry.attributes.position,
    noise2D = createNoise2D(alea(params.seed)),
    heights = new Float32Array(gridSize * gridSize);

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i),
      z = posAttr.getZ(i);

    let amplitude = 1,
      frequency = params.frequency,
      sum = 0,
      maxAmplitude = 0;

    for (let o = 0; o < params.octaves; o++) {
      sum += noise2D(x * frequency, z * frequency) * amplitude;
      maxAmplitude += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }

    const distance = Math.sqrt(x * x + z * z),
      normalizedDistance = distance / (maxRadius * params.islandRadius),
      falloff = Math.pow(
        Math.max(0, 1 - normalizedDistance),
        params.falloffSharpness,
      );

    heights[i] = (sum / maxAmplitude) * params.elevation * falloff;
  }

  for (let pass = 0; pass < params.smoothing; pass++) {
    const source = heights.slice();
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const idx = row * gridSize + col;
        let sum = source[idx],
          count = 1;
        if (col > 0) {
          sum += source[idx - 1];
          count++;
        }
        if (col < gridSize - 1) {
          sum += source[idx + 1];
          count++;
        }
        if (row > 0) {
          sum += source[idx - gridSize];
          count++;
        }
        if (row < gridSize - 1) {
          sum += source[idx + gridSize];
          count++;
        }
        heights[idx] = sum / count;
      }
    }
  }

  for (let i = 0; i < posAttr.count; i++) {
    posAttr.setY(i, heights[i]);
  }
  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();

  material.wireframe = params.wireframe;
  material.color.set(params.color);
  water.position.y = params.seaLevel;
}

const pane = new Pane({ container: document.getElementById("controls") });

pane
  .addBinding(params, "frequency", { min: 0.01, max: 0.2, step: 0.005 })
  .on("change", regenerate);
pane
  .addBinding(params, "elevation", { min: 0, max: 30, step: 0.5 })
  .on("change", regenerate);
pane
  .addBinding(params, "octaves", { min: 1, max: 6, step: 1 })
  .on("change", regenerate);
pane
  .addBinding(params, "smoothing", { min: 0, max: 10, step: 1 })
  .on("change", regenerate);
pane.addBinding(params, "wireframe").on("change", regenerate);
pane.addBinding(params, "color").on("change", regenerate);
pane
  .addBinding(params, "islandRadius", { min: 0.2, max: 1.5, step: 0.05 })
  .on("change", regenerate);
pane
  .addBinding(params, "falloffSharpness", { min: 0.5, max: 6, step: 0.25 })
  .on("change", regenerate);
pane
  .addBinding(params, "seaLevel", { min: -10, max: 10, step: 0.25 })
  .on("change", regenerate);
pane.addButton({ title: "New seed" }).on("click", () => {
  params.seed = Math.floor(Math.random() * 100000);
  regenerate();
});

regenerate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
