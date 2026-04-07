import { signal, useSignalEffect } from "@preact/signals";
import { type FunctionalComponent, type JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";
import * as THREE from "three";
import { createVHSPipeline, type VHSPipeline } from "./vhsPipeline";
import "./styles.css";

const SEGMENTS_X = 40;
const SEGMENTS_Y = 40;

const curveDepth = signal(0.7);
const webglError = signal<string | null>(null);

const WICG_EXAMPLES = [
  {
    id: "complex-text",
    label: "Complex Text",
    liveUrl: "/demos/wicg/complex-text.html",
    sourceUrl: "/demos/wicg/complex-text.html",
  },
  {
    id: "pie-chart",
    label: "Pie Chart",
    liveUrl: "/demos/wicg/pie-chart.html",
    sourceUrl: "/demos/wicg/pie-chart.html",
  },
  {
    id: "webgpu-jelly-slider",
    label: "WebGPU Jelly Slider",
    liveUrl: "/demos/wicg/webgpu-jelly-slider/index.html",
    sourceUrl: "/demos/wicg/webgpu-jelly-slider/",
  },
  {
    id: "webgl",
    label: "WebGL Cube",
    liveUrl: "/demos/wicg/webGL.html",
    sourceUrl: "/demos/wicg/webGL.html",
  },
  {
    id: "text-input",
    label: "Text Input",
    liveUrl: "/demos/wicg/text-input.html",
    sourceUrl: "/demos/wicg/text-input.html",
  },
  {
    id: "blurring",
    label: "Blurring",
    liveUrl: "/demos/wicg/blurring.html",
    sourceUrl: "/demos/wicg/blurring.html",
  },
  {
    id: "magnifying-glass",
    label: "Magnifying Glass",
    liveUrl: "/demos/wicg/magnifying-glass.html",
    sourceUrl: "/demos/wicg/magnifying-glass.html",
  },
  {
    id: "pixelated",
    label: "Pixelated",
    liveUrl: "/demos/wicg/pixelated.html",
    sourceUrl: "/demos/wicg/pixelated.html",
  },
  {
    id: "dot-shaded-contact",
    label: "Dot-shaded Contact",
    liveUrl: "/demos/wicg/dot-shaded-contact.html",
    sourceUrl: "/demos/wicg/dot-shaded-contact.html",
  },
  {
    id: "sphere-html-three",
    label: "HTML Sphere (Three.js)",
    liveUrl: "/demos/wicg/sphere-html-three.html",
    sourceUrl: "/demos/wicg/sphere-html-three.html",
  },
  {
    id: "sphere-html-three-ripple",
    label: "HTML Sphere Ripple (Three.js)",
    liveUrl: "/demos/wicg/sphere-html-three-ripple.html",
    sourceUrl: "/demos/wicg/sphere-html-three-ripple.html",
  },
  {
    id: "website-shatter-shooter",
    label: "Website Shatter Shooter",
    liveUrl: "/demos/wicg/website-shatter-shooter.html",
    sourceUrl: "/demos/wicg/website-shatter-shooter.html",
  },
  {
    id: "todo-puzzle",
    label: "Todo Puzzle",
    liveUrl: "/demos/wicg/todo-puzzle.html",
    sourceUrl: "/demos/wicg/todo-puzzle.html",
  },
] as const;

const App: FunctionalComponent = () => {
  const experimentalCanvasAttributes = {
    layoutsubtree: true,
  } as JSX.HTMLAttributes<HTMLCanvasElement>;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geometry = useRef<THREE.PlaneGeometry>();
  const camera = useRef<THREE.PerspectiveCamera>();

  useEffect(() => {
    geometry.current = new THREE.PlaneGeometry(2, 2, SEGMENTS_X, SEGMENTS_Y);

    return () => {
      geometry.current?.dispose();
    };
  }, []);

  useSignalEffect(() => {
    const curveDepthValue = curveDepth.value;
    if (!camera.current) return;
    // As depth decreases (flatter), move camera back so the surface fills the view
    camera.current.position.z = 1.5 + (0.7 - curveDepthValue) * 1;
  });

  useSignalEffect(() => {
    const depth = curveDepth.value;
    const positions = geometry.current!.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      positions.setZ(i, -depth * (x * x + y * y));
    }
    positions.needsUpdate = true;
    geometry.current!.computeVertexNormals();
    geometry.current!.computeBoundingSphere();
    geometry.current!.computeBoundingBox();
  });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const handleContextCreationError = (event: Event) => {
      event.preventDefault();
      webglError.value =
        "WebGL context creation failed in this browser session. Try relaunching Canary without GPU-disabled flags.";
    };
    canvas.addEventListener("webglcontextcreationerror", handleContextCreationError);

    // Scene
    const scene = new THREE.Scene();
    camera.current = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
    camera.current.position.set(0, 0, 1.5);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch {
      webglError.value =
        "WebGL context creation failed in this browser session. Try relaunching Canary without GPU-disabled flags.";
      canvas.removeEventListener("webglcontextcreationerror", handleContextCreationError);
      return () => {};
    }
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(devicePixelRatio);
    webglError.value = null;

    // Texture backed by the canvas's first child element via texElementImage2D
    const gl = renderer.getContext() as WebGLRenderingContext & {
      texElementImage2D: (
        target: GLenum,
        level: GLint,
        internalformat: GLint,
        format: GLenum,
        type: GLenum,
        element: Element,
      ) => void;
    };

    // Allocate the GL texture ourselves so we can use texElementSubImage2D
    const glTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, glTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    const texture = new THREE.Texture();
    texture.isRenderTargetTexture = true; // prevent Three.js from uploading
    texture.colorSpace = THREE.SRGBColorSpace;
    // Inject our GL handle into Three.js's property map
    (renderer.properties.get(texture) as Record<string, unknown>).__webglTexture = glTexture;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry.current!, material);
    scene.add(mesh);

    const vhs = new URLSearchParams(location.search).has("vhs");
    let vhsPipeline: VHSPipeline | null = null;
    if (vhs) {
      vhsPipeline = createVHSPipeline();
    }

    // Animation loop — repaint every frame
    let rafId: number;
    let frame = 0;
    const startTime = performance.now();
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      if (vhsPipeline) {
        const time = (performance.now() - startTime) / 1000;
        const vhsTexture = vhsPipeline.render(
          renderer,
          texture,
          innerWidth * devicePixelRatio,
          innerHeight * devicePixelRatio,
          time,
          frame,
        );
        material.map = vhsTexture;
      }
      renderer.render(scene, camera.current!);
      frame++;
    };

    animate();

    // Pointermove → UV → translate element so texture point stays under mouse
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const updateElementPosition = (x: number, y: number) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((x - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((y - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera.current!);
      const intersects = raycaster.intersectObject(mesh);

      if (intersects.length > 0 && intersects[0].uv) {
        const uv = intersects[0].uv!;
        const el = canvas.firstElementChild as HTMLElement | null;
        if (!el) return;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const texX = uv.x * w;
        const texY = (1 - uv.y) * h;
        // Mouse position relative to the canvas
        const mouseX = x - rect.left;
        const mouseY = y - rect.top;
        // Translate so texPoint lands under the mouse
        el.style.transform = `translate(${mouseX - texX}px, ${mouseY - texY}px)`;
      }
    };

    const handleElementPointerPosition = (e: PointerEvent) => {
      updateElementPosition(e.clientX, e.clientY);
    };

    canvas.addEventListener("pointermove", handleElementPointerPosition);
    canvas.addEventListener("pointerdown", handleElementPointerPosition);

    // Resize handler
    const handleResize = () => {
      camera.current!.aspect = innerWidth / innerHeight;
      camera.current!.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    };
    addEventListener("resize", handleResize);

    const canvasPaint = () => {
      const element = canvas.firstElementChild;
      if (!element) return;
      // Bind via raw GL, bypassing Three.js state cache, then upload
      // const state = (renderer as any).state;
      // state.reset(); // force Three.js to re-bind everything on next render
      gl.bindTexture(gl.TEXTURE_2D, glTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, element);
    };

    canvas.addEventListener("paint", canvasPaint);
    canvas.requestPaint();

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("pointermove", handleElementPointerPosition);
      canvas.removeEventListener("pointerdown", handleElementPointerPosition);
      canvas.removeEventListener("paint", canvasPaint);
      canvas.removeEventListener("webglcontextcreationerror", handleContextCreationError);
      removeEventListener("resize", handleResize);
      vhsPipeline?.dispose();
      renderer.dispose();
      material.dispose();
      texture.dispose();
    };
  }, []);

  return (
    <canvas ref={canvasRef} {...experimentalCanvasAttributes}>
      <div class="canvas-content">
        <div class="button-row">
          {WICG_EXAMPLES.map((example) => (
            <a
              key={example.id}
              href={example.liveUrl}
              target="_blank"
              rel="noreferrer"
              title={`View source: ${example.sourceUrl}`}
            >
              {example.label}
            </a>
          ))}
        </div>
        <div class="text">
          {webglError.value && <p class="error-banner">{webglError.value}</p>}
          <p>
            This element is mapped to something that's kinda sphere-ish. However, text selection
            still works as expected.
          </p>

          <p>
            This works because, on pointermove, the real element is given a transform so the point
            of the real element matches up to the point of the texture under the mouse. This means
            things like{" "}
            <a href="https://jakearchibald.com" target="_blank">
              links
            </a>{" "}
            will just work.
          </p>

          <p>
            For simple 2D cases, it still makes sense to have a nice high-level way to handle this,
            but I think this proves that for complex non-flat cases, it's relatively simple to make
            things work.
          </p>

          <p>
            I'm sure there are edges cases with things like anchor-positioning and top-layer
            content, like a custom select element's picker:{" "}
          </p>

          <div>
            <select>
              <option>Oh</option>
              <option>no</option>
            </select>
          </div>

          <p>
            Ah, yeah, it moves around on mouse move, and I'm not handling moving the element on
            focus. But the general capability is proven, I think.
          </p>
        </div>
        <div class="range-row">
          <input
            type="range"
            min="-1"
            max="0.7"
            step="any"
            value={curveDepth}
            onInput={(e) => {
              curveDepth.value = Number((e.target as HTMLInputElement).value);
            }}
          />
        </div>
      </div>
    </canvas>
  );
};

export default App;
