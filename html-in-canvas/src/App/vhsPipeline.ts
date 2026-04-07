import * as THREE from "three";

import commonGlsl from "./shaders/common.glsl?raw";
import bufferAGlsl from "./shaders/buffer-a.glsl?raw";
import bufferBGlsl from "./shaders/buffer-b.glsl?raw";
import bufferCGlsl from "./shaders/buffer-c.glsl?raw";
import bufferDGlsl from "./shaders/buffer-d.glsl?raw";
import imageGlsl from "./shaders/image.glsl?raw";

const VERT = `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

function shadertoyFrag(body: string) {
  return `
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec3 iResolution;
uniform float iTime;
uniform int iFrame;
uniform vec4 iMouse;
${commonGlsl}
${body}
void main() {
  vec2 fragCoord = vUv * iResolution.xy;
  mainImage(fragColor, fragCoord);
}`;
}

function makeTarget(w: number, h: number) {
  return new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    colorSpace: THREE.NoColorSpace,
  });
}

function makePass(fragBody: string) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]),
      3,
    ),
  );
  const mat = new THREE.RawShaderMaterial({
    vertexShader: VERT,
    fragmentShader: shadertoyFrag(fragBody),
    uniforms: {
      iChannel0: { value: null },
      iChannel1: { value: null },
      iResolution: { value: new THREE.Vector3() },
      iTime: { value: 0 },
      iFrame: { value: 0 },
      iMouse: { value: new THREE.Vector4() },
    },
    glslVersion: THREE.GLSL3,
    depthTest: false,
    depthWrite: false,
  });
  return { geo, mat, mesh: new THREE.Mesh(geo, mat) };
}

export interface VHSPipeline {
  render(
    renderer: THREE.WebGLRenderer,
    sourceTexture: THREE.Texture,
    width: number,
    height: number,
    time: number,
    frame: number,
  ): THREE.Texture;
  dispose(): void;
}

export function createVHSPipeline(): VHSPipeline {
  const passA = makePass(bufferAGlsl);
  const passB = makePass(bufferBGlsl);
  const passC = makePass(bufferCGlsl);
  const passD = makePass(bufferDGlsl);
  const passImage = makePass(imageGlsl);

  const orthoScene = new THREE.Scene();
  const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Ping-pong targets for buffer C (needs previous frame)
  let cTargets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null = null;
  let cIdx = 0;

  let targets: {
    w: number;
    h: number;
    a: THREE.WebGLRenderTarget;
    b: THREE.WebGLRenderTarget;
    d: THREE.WebGLRenderTarget;
    img: THREE.WebGLRenderTarget;
  } | null = null;

  function ensureTargets(w: number, h: number) {
    if (targets && targets.w === w && targets.h === h) return;
    targets?.a.dispose();
    targets?.b.dispose();
    targets?.d.dispose();
    targets?.img.dispose();
    cTargets?.[0].dispose();
    cTargets?.[1].dispose();
    targets = {
      w,
      h,
      a: makeTarget(w, h),
      b: makeTarget(w, h),
      d: makeTarget(w, h),
      img: makeTarget(w, h),
    };
    cTargets = [makeTarget(w, h), makeTarget(w, h)];
    cIdx = 0;
  }

  function runPass(
    renderer: THREE.WebGLRenderer,
    pass: ReturnType<typeof makePass>,
    target: THREE.WebGLRenderTarget,
    ch0: THREE.Texture | null,
    ch1: THREE.Texture | null,
    w: number,
    h: number,
    time: number,
    frame: number,
  ) {
    pass.mat.uniforms.iChannel0.value = ch0;
    pass.mat.uniforms.iChannel1.value = ch1;
    pass.mat.uniforms.iResolution.value.set(w, h, 1);
    pass.mat.uniforms.iTime.value = time;
    pass.mat.uniforms.iFrame.value = frame;

    orthoScene.clear();
    orthoScene.add(pass.mesh);
    renderer.setRenderTarget(target);
    renderer.render(orthoScene, orthoCamera);
  }

  return {
    render(renderer, sourceTexture, width, height, time, frame) {
      ensureTargets(width, height);
      const t = targets!;
      const [c0, c1] = cTargets!;
      const prevC = cIdx === 0 ? c1 : c0;
      const currC = cIdx === 0 ? c0 : c1;

      // A: source → bufA
      runPass(renderer, passA, t.a, sourceTexture, null, width, height, time, frame);
      // B: bufA → bufB
      runPass(renderer, passB, t.b, t.a.texture, null, width, height, time, frame);
      // C: bufB (ch0) + prevC (ch1) → currC
      runPass(renderer, passC, currC, t.b.texture, prevC.texture, width, height, time, frame);
      cIdx = 1 - cIdx;
      // D: currC → bufD
      runPass(renderer, passD, t.d, currC.texture, null, width, height, time, frame);
      // Image: bufD (ch0) + source (ch1) → img
      runPass(renderer, passImage, t.img, t.d.texture, sourceTexture, width, height, time, frame);

      renderer.setRenderTarget(null);
      return t.img.texture;
    },

    dispose() {
      [passA, passB, passC, passD, passImage].forEach(({ geo, mat }) => {
        geo.dispose();
        mat.dispose();
      });
      targets?.a.dispose();
      targets?.b.dispose();
      targets?.d.dispose();
      targets?.img.dispose();
      cTargets?.[0].dispose();
      cTargets?.[1].dispose();
    },
  };
}
