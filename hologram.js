/* ═══════════════════════════════════════════════════════
   NICO TRADES — 3-D Brain Hologram v10
   One connected body + cerebellum.
   Temporal lobe = downward stretch deformation of the
   main cerebrum, separated by a Sylvian fissure notch.
   Gyri arc from top-down like the reference image.
   Three.js r160
   ═══════════════════════════════════════════════════════ */

(function initHologram() {
  if (!window.THREE) return;

  const canvas = document.getElementById('holoCanvas');
  if (!canvas) return;

  const parent = canvas.parentElement;
  let W = parent.offsetWidth;
  let H = parent.offsetHeight;
  if (!W || !H) { setTimeout(initHologram, 150); return; }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
  camera.position.z = 4.2;

  function gauss() {
    let u1;
    do { u1 = Math.random(); } while (u1 < 1e-8);
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * Math.random());
  }

  function fbm(x, y, z) {
    let v = 0, a = 0.5, f = 1.0;
    for (let o = 0; o < 4; o++) {
      const k = o * 1.7;
      v += a * (Math.sin(x*f*1.3+k) * Math.cos(y*f*1.1+k*1.4) * Math.sin(z*f*1.2+k*0.9));
      a *= 0.5; f *= 2.1;
    }
    return v;
  }

  /* ── Brain shape warp ───────────────────────────────
     Applied to raw ellipsoid points to create:
     · temporal lobe (downward front stretch)
     · Sylvian fissure (lateral groove)
     · occipital taper (rear narrowing)
     · flat inferior surface
  ─────────────────────────────────────────────────── */
  function brainWarp(x, y, z, SX, SY) {
    const xn = x / SX;   /* normalised x: -1=back, +1=front */
    const yn = y / SY;   /* normalised y: -1=bottom, +1=top */

    /* Temporal lobe stretch — lateral surface only (abs(z) is large).
       Pulls the front-lower area downward on each side. */
    const lateral = Math.abs(z / SZ);   /* 0 = medial, 1 = lateral edge */
    const tempMask = Math.max(0.0, xn)
                   * Math.max(0.0, -yn - 0.08)
                   * lateral;
    y -= tempMask * SY * 0.90;

    /* Sylvian fissure — shallow lateral groove above temporal */
    const ynS    = y / SY;
    const sylvMask = Math.exp(-(ynS + 0.05) * (ynS + 0.05) * 20.0)
                   * Math.max(0.0, xn + 0.10)
                   * lateral;
    z += Math.sign(z || 1) * sylvMask * 0.12;

    /* Flatten inferior surface */
    const yn2 = y / SY;
    if (yn2 < -0.55) {
      const fl = Math.min(1.0, (-0.55 - yn2) / 0.30);
      z *= (1.0 - fl * 0.35);
    }

    /* Occipital taper — narrow the rear */
    if (xn < -0.55) {
      const ot = Math.min(1.0, (-0.55 - xn) / 0.35);
      y += ot * 0.10 * SY;
    }

    return { x, y, z };
  }

  /* ════════════════════════════════════════════════════
     PARTICLE BUDGET
  ════════════════════════════════════════════════════ */
  const N_SURF = 280000;  /* cerebrum surface   */
  const N_FILL = 170000;  /* cerebrum interior  */
  const N_CB   =  30000;  /* cerebellum         */
  const N_AMB  =   2500;
  const N = N_SURF + N_FILL + N_CB + N_AMB;

  const pos = new Float32Array(N * 3);
  const siz = new Float32Array(N);
  const nrm = new Float32Array(N * 3);
  const bri = new Float32Array(N);

  const SX = 1.15, SY = 1.05, SZ = 0.78;

  /* ════════════════════════════════════════════════════
     CEREBRUM SURFACE
  ════════════════════════════════════════════════════ */
  for (let i = 0; i < N_SURF; i++) {
    let nx, ny, nz, nl;
    do {
      nx=gauss(); ny=gauss(); nz=gauss();
      nl=Math.sqrt(nx*nx+ny*ny+nz*nz);
    } while (nl<1e-5);
    nx/=nl; ny/=nl; nz/=nl;

    const sd = 0.93 + Math.random()*0.07;
    let x = nx*SX*sd, y = ny*SY*sd, z = nz*SZ*sd;

    /* Brain shape warp */
    ({ x, y, z } = brainWarp(x, y, z, SX, SY));

    /* Gyri: use polar angle from top so bands arc over dome */
    const r2  = Math.sqrt(x*x+y*y+z*z)+1e-5;
    const phi = Math.acos(Math.max(-1.0,Math.min(1.0, y/r2)));
    const lam = Math.atan2(z, x);

    const pn1 = fbm(x*2.5, y*2.5, z*2.5) * 3.8;
    const pn2 = fbm(x*5.0+1.3, y*5.0+2.7, z*5.0+0.6) * 2.0;

    const w1 = Math.sin(phi*7.5 + pn1) * 0.50;         /* concentric arcs  */
    const w2 = Math.sin(lam*4.5 + phi*2.5 + pn2) * 0.30; /* azimuthal vary  */
    const w3 = Math.sin(phi*14.0 + lam*2.0 + pn1*0.4) * 0.20; /* fine detail */
    const rw  = w1 + w2 + w3;

    const fold = rw * 0.062;
    x += (x/r2)*fold; y += (y/r2)*fold; z += (z/r2)*fold;

    pos[i*3]=x; pos[i*3+1]=y; pos[i*3+2]=z;

    const enx=x/(SX*SX), eny=y/(SY*SY), enz=z/(SZ*SZ);
    const enl=Math.sqrt(enx*enx+eny*eny+enz*enz)+1e-8;
    nrm[i*3]=enx/enl; nrm[i*3+1]=eny/enl; nrm[i*3+2]=enz/enl;

    const rs = Math.abs(rw);
    if      (rs>0.80) { siz[i]=0.108+(rs-0.80)*0.35; bri[i]=rs; }
    else if (rs>0.56) { siz[i]=0.076+(rs-0.56)*0.14; bri[i]=(rs-0.56)/0.24*0.55; }
    else if (rs>0.24) { siz[i]=0.078; bri[i]=0.0; }
    else              { siz[i]=0.048; bri[i]=0.0; }
  }

  /* ════════════════════════════════════════════════════
     CEREBRUM INTERIOR FILL
  ════════════════════════════════════════════════════ */
  for (let i = N_SURF; i < N_SURF+N_FILL; i++) {
    let nx, ny, nz, nl;
    do { nx=gauss(); ny=gauss(); nz=gauss(); nl=Math.sqrt(nx*nx+ny*ny+nz*nz); } while(nl<1e-5);
    nx/=nl; ny/=nl; nz/=nl;

    const rf = Math.cbrt(Math.random())*0.92;
    let x = nx*SX*rf, y = ny*SY*rf, z = nz*SZ*rf;

    ({ x, y, z } = brainWarp(x, y, z, SX, SY));

    pos[i*3]=x; pos[i*3+1]=y; pos[i*3+2]=z;

    const enx=x/(SX*SX), eny=y/(SY*SY), enz=z/(SZ*SZ);
    const enl=Math.sqrt(enx*enx+eny*eny+enz*enz)+1e-8;
    nrm[i*3]=enx/enl; nrm[i*3+1]=eny/enl; nrm[i*3+2]=enz/enl;
    siz[i]=0.055+Math.random()*0.016; bri[i]=0.0;
  }

  /* ════════════════════════════════════════════════════
     CEREBELLUM — small oval, back-bottom, connected
  ════════════════════════════════════════════════════ */
  const CXB=-0.88, CYB=-0.48, CZB=0.0;
  const CBX=0.25, CBY=0.18, CBZ=0.22;

  for (let i = N_SURF+N_FILL; i < N_SURF+N_FILL+N_CB; i++) {
    let nx, ny, nz, nl;
    do { nx=gauss(); ny=gauss(); nz=gauss(); nl=Math.sqrt(nx*nx+ny*ny+nz*nz); } while(nl<1e-5);
    nx/=nl; ny/=nl; nz/=nl;

    const sd = 0.88+Math.random()*0.12;
    const x = CXB + nx*CBX*sd;
    const y = CYB + ny*CBY*sd;
    const z = CZB + nz*CBZ*sd;

    pos[i*3]=x; pos[i*3+1]=y; pos[i*3+2]=z;

    const dx=x-CXB, dy=y-CYB, dz=z-CZB;
    const enx=dx/(CBX*CBX), eny=dy/(CBY*CBY), enz=dz/(CBZ*CBZ);
    const enl=Math.sqrt(enx*enx+eny*eny+enz*enz)+1e-8;
    nrm[i*3]=enx/enl; nrm[i*3+1]=eny/enl; nrm[i*3+2]=enz/enl;

    const cPh = fbm(x*3.5,y*3.5,z*3.5)*2.2;
    const cS  = Math.abs(Math.sin(dy*30.0 + cPh));
    if (cS>0.76)      { siz[i]=0.072+(cS-0.76)*0.16; bri[i]=cS; }
    else if (cS>0.48) { siz[i]=0.058; bri[i]=0.18; }
    else              { siz[i]=0.046; bri[i]=0.0; }
  }

  /* ════════════════════════════════════════════════════
     AMBIENT SPARKLE
  ════════════════════════════════════════════════════ */
  for (let i = N-N_AMB; i < N; i++) {
    let nx, ny, nz, nl;
    do { nx=gauss(); ny=gauss(); nz=gauss(); nl=Math.sqrt(nx*nx+ny*ny+nz*nz); } while(nl<1e-5);
    nx/=nl; ny/=nl; nz/=nl;
    const d=1.02+Math.random()*0.28;
    pos[i*3]=nx*SX*d; pos[i*3+1]=ny*SY*d; pos[i*3+2]=nz*SZ*d;
    nrm[i*3]=0; nrm[i*3+1]=0; nrm[i*3+2]=1;
    siz[i]=0.016+Math.random()*0.020; bri[i]=0.5+Math.random()*0.5;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize',    new THREE.BufferAttribute(siz, 1));
  geo.setAttribute('aNormal',  new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('aBri',     new THREE.BufferAttribute(bri, 1));

  const vertSrc = /* glsl */`
    attribute float aSize;
    attribute vec3  aNormal;
    attribute float aBri;

    varying float vDiffuse;
    varying float vRim;
    varying float vSpec;
    varying float vBri;
    varying float vRadius;

    void main() {
      vec4  mv   = modelViewMatrix * vec4(position, 1.0);
      float camZ = -mv.z;

      vec3 wNorm   = normalize(mat3(modelMatrix) * aNormal);
      vec3 keyDir  = normalize(vec3(0.55, 0.70, 1.00));
      float key    = max(0.0, dot(wNorm, keyDir));
      float fill   = max(0.0, dot(wNorm, normalize(vec3(-1.0,0.2,0.4)))) * 0.28;
      float rim    = pow(max(0.0, dot(wNorm, vec3(0.0,0.0,-1.0))), 3.0) * 0.55;

      vDiffuse = 0.08 + key*0.90 + fill;
      vRim     = rim;
      vBri     = aBri;
      vRadius  = length(position.xyz);

      vec3 halfVec = normalize(keyDir + vec3(0.0,0.0,1.0));
      vSpec = pow(max(0.0, dot(normalize(normalMatrix*aNormal), halfVec)), 48.0) * aBri;

      gl_PointSize = aSize * (230.0 / camZ);
      gl_Position  = projectionMatrix * mv;
    }
  `;

  const fragSrc = /* glsl */`
    varying float vDiffuse;
    varying float vRim;
    varying float vSpec;
    varying float vBri;
    varying float vRadius;

    void main() {
      vec2  uv = gl_PointCoord - 0.5;
      float d  = length(uv);
      if (d > 0.5) discard;

      float ball  = exp(-d*d*16.0);
      float solid = 1.0 - smoothstep(0.28, 0.50, d);
      float alpha = max(ball, solid*0.96);
      alpha *= 1.0 - smoothstep(1.35, 1.75, vRadius);

      vec3 baseCol  = mix(vec3(0.01,0.04,0.20), vec3(0.10,0.28,0.80),
                          clamp(vDiffuse,0.0,1.0));
      vec3 ridgeCol = mix(vec3(0.08,0.32,0.90), vec3(0.42,0.80,1.00),
                          clamp(vDiffuse,0.0,1.0));
      vec3 col = mix(baseCol, ridgeCol, vBri);
      col = mix(col, vec3(0.78,0.92,1.00), vSpec*0.85);
      col += vec3(0.04,0.28,0.70) * vRim * (1.0-vBri*0.5);

      gl_FragColor = vec4(col, alpha);
    }
  `;

  const mat = new THREE.ShaderMaterial({
    vertexShader: vertSrc, fragmentShader: fragSrc,
    transparent: true, depthWrite: true, alphaTest: 0.04,
    blending: THREE.NormalBlending,
  });

  const mesh = new THREE.Points(geo, mat);
  scene.add(mesh);

  let tMx=0, tMy=0, sMx=0, sMy=0;
  parent.addEventListener('mousemove', e => {
    const rc=parent.getBoundingClientRect();
    tMx= ((e.clientX-rc.left)/rc.width -0.5);
    tMy=-((e.clientY-rc.top) /rc.height-0.5);
  }, { passive:true });

  let autoRotY=0, time=0;
  function tick() {
    requestAnimationFrame(tick);
    time += 0.005;
    sMx += (tMx-sMx)*0.030;
    sMy += (tMy-sMy)*0.030;
    autoRotY += 0.0009;
    mesh.rotation.y = autoRotY + sMx*0.35;
    mesh.rotation.x = Math.sin(time*0.14)*0.028 + sMy*0.18;
    mesh.rotation.z = Math.sin(time*0.09)*0.009;
    renderer.render(scene, camera);
  }
  tick();
  canvas.classList.add('ready');

  window.addEventListener('resize', () => {
    W=parent.offsetWidth; H=parent.offsetHeight;
    camera.aspect=W/H; camera.updateProjectionMatrix();
    renderer.setSize(W,H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  }, { passive:true });

})();
