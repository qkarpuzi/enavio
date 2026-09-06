/* ==========================================================
   ENAVIO AI — brain-scene.js
   Loads the brain .glb model and renders it as a stylized
   "cyber" wireframe/node visualization inside the hero canvas.
   Falls back to the procedural node-orb (script.js) if WebGL
   or the model fails to load. Skips entirely under
   prefers-reduced-motion (script.js draws a static fallback
   in that case instead).
   ========================================================== */

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

async function initBrainScene() {
  console.log("[Enavio] brain-scene.js starting…");

  if (prefersReducedMotion) {
    console.log("[Enavio] reduced motion is on — skipping 3D scene.");
    return;
  }

  const canvas = document.getElementById("node-orb");
  if (!canvas) {
    console.error("[Enavio] #node-orb canvas not found in the page.");
    return;
  }

  let THREE, GLTFLoader;
  try {
    THREE = await import("./assets/vendor/three.module.min.js");
    ({ GLTFLoader } = await import("./assets/vendor/GLTFLoader.js"));
    console.log("[Enavio] Three.js and GLTFLoader imported OK.");
  } catch (err) {
    console.error("[Enavio] Failed to import Three.js/GLTFLoader:", err);
    fallback(canvas);
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    console.log("[Enavio] WebGL renderer created OK.");
  } catch (err) {
    console.error("[Enavio] Failed to create WebGL renderer:", err);
    fallback(canvas);
    return;
  }

  const isTouch = window.matchMedia("(hover: none)").matches;
  const container = canvas.parentElement;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 3.4);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  // Lighting — kept low-intensity, this is meant to read as a
  // technical diagram, not a lit product render.
  scene.add(new THREE.AmbientLight(0x404040, 1.3));

  const rim = new THREE.DirectionalLight(0x4fd1e8, 0.7);
  rim.position.set(-2, 1, 2);
  scene.add(rim);

  const front = new THREE.DirectionalLight(0xf2f1ed, 0.35);
  front.position.set(1, 1, 3);
  scene.add(front);

  const group = new THREE.Group();
  scene.add(group);

  const accent = new THREE.Color(0x4fd1e8);
  const dark = new THREE.Color(0x0e0e10);

  function stylize(root) {
    root.traverse(function (child) {
      if (!child.isMesh) return;

      // Dark, translucent base so the wireframe reads clearly
      // against it, with just enough shading to feel dimensional.
      child.material = new THREE.MeshStandardMaterial({
        color: dark,
        metalness: 0.25,
        roughness: 0.65,
        transparent: true,
        opacity: 0.55
      });

      // Circuit-style wireframe overlay in the accent color.
      const wireGeo = new THREE.WireframeGeometry(child.geometry);
      const wireMat = new THREE.LineBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.5
      });
      child.add(new THREE.LineSegments(wireGeo, wireMat));

      // Faint node points at the vertices — ties this visual back
      // to the "network" language used throughout the rest of the site.
      const pointsMat = new THREE.PointsMaterial({
        color: accent,
        size: 0.012,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true
      });
      child.add(new THREE.Points(child.geometry, pointsMat));
    });
  }

  function frameAndCenter(object) {
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 1.7 / maxDim;
    object.scale.setScalar(scale);

    // position is applied in parent space and isn't affected by the
    // object's own scale, so the center offset has to be scaled too —
    // otherwise the (tiny, scaled-down) model gets translated by the
    // model's original, much larger unit magnitude and ends up
    // outside the camera's view.
    object.position.copy(center).multiplyScalar(-scale);
  }

  const loader = new GLTFLoader();
  console.log("[Enavio] Loading brain.glb…");

  loader.load(
    "./assets/enavio-brain.glb",
    function (gltf) {
      console.log("[Enavio] brain.glb loaded successfully.");
      stylize(gltf.scene);
      frameAndCenter(gltf.scene);
      group.add(gltf.scene);
      start();
    },
    undefined,
    function (err) {
      console.error("[Enavio] Failed to load brain.glb:", err);
      fallback(canvas);
    }
  );

  let animationId = null;
  let active = true;
  let targetTiltX = 0;
  let targetTiltY = 0;

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render() {
    group.rotation.y += 0.0022;
    group.rotation.x += (targetTiltX - group.rotation.x) * 0.04;
    group.rotation.y += (targetTiltY - group.rotation.y) * 0.0;

    renderer.render(scene, camera);
    if (active) animationId = requestAnimationFrame(render);
  }

  function start() {
    active = true;
    if (!animationId) render();
  }

  function stop() {
    active = false;
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });

  if (!isTouch) {
    container.addEventListener("mousemove", function (e) {
      const rect = container.getBoundingClientRect();
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      targetTiltX = ny * 0.4;
      targetTiltY += nx * 0.001;
    });
  }

  if ("IntersectionObserver" in window) {
    const obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) start();
        else stop();
      });
    });
    obs.observe(canvas.closest(".hero"));
  }
}

function fallback(canvas) {
  console.warn("[Enavio] Falling back to procedural node-orb.");
  if (typeof window.EnavioFallbackOrb === "function") {
    window.EnavioFallbackOrb(canvas);
  } else {
    console.error("[Enavio] window.EnavioFallbackOrb is not available — script.js may not have loaded yet.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBrainScene);
} else {
  initBrainScene();
}