/* ============================================================
   Kiana Lee film portfolio engine (multi-page)
   GSAP + ScrollTrigger + Lenis (vendored in /vendor).
   Every feature guards on its markup, so all pages share this file:
   - home:        preloader + static hero + intro
   - other pages: wipe-in veil + page-header intro
   - yosemite:    pinned horizontal roll with live frame counter
   - contact:     booking form -> prefilled email
   ============================================================ */

(function () {
  "use strict";

  gsap.registerPlugin(ScrollTrigger);
  // ScrollTrigger manages scrollRestoration itself; the inline <head> script
  // already set it to "manual" before ScrollTrigger loaded and captured it.
  ScrollTrigger.clearScrollMemory("manual");

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const isHome = !!document.querySelector(".preloader");

  /* ---------------- split text ---------------- */

  document.querySelectorAll("[data-split]").forEach((el) => {
    const words = el.textContent.split(" ");
    el.textContent = "";
    words.forEach((word, w) => {
      const wordSpan = document.createElement("span");
      wordSpan.className = "word";
      for (const ch of word) {
        const s = document.createElement("span");
        s.className = "ch";
        s.textContent = ch;
        wordSpan.appendChild(s);
      }
      el.appendChild(wordSpan);
      if (w < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
  });

  /* intro targets: hero (home) or page header (subpages) */
  const introRoot = document.querySelector(".hero") || document.querySelector(".page-head");
  if (!reduced && introRoot) {
    gsap.set(introRoot.querySelectorAll(".ch"), { yPercent: 115 });
    gsap.set(introRoot.querySelectorAll(".intro-fade"), { autoAlpha: 0, y: 16 });
  }

  /* ---------------- Lenis smooth scroll ---------------- */

  let lenis = null;
  if (!reduced) {
    lenis = new Lenis({ lerp: 0.09 });
    window.lenisInstance = lenis; // booking.js scrolls between its steps
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------------- mobile film-index menu ---------------- */

  const menuToggle = document.querySelector(".menu-toggle");
  const mainNav = document.getElementById("main-nav");
  if (menuToggle && mainNav) {
    let menuOpen = false;

    const setMenu = (open, returnFocus = false) => {
      menuOpen = open;
      document.body.classList.toggle("nav-menu-open", open);
      menuToggle.setAttribute("aria-expanded", String(open));
      menuToggle.textContent = open ? "Close" : "Menu";
      document.documentElement.style.overflow = open ? "hidden" : "";
      if (lenis) open ? lenis.stop() : lenis.start();

      if (open) {
        requestAnimationFrame(() => mainNav.querySelector("a")?.focus());
      } else if (returnFocus) {
        menuToggle.focus();
      }
    };

    menuToggle.addEventListener("click", () => setMenu(!menuOpen));
    mainNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setMenu(false));
    });

    window.addEventListener("keydown", (e) => {
      if (!menuOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setMenu(false, true);
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = [menuToggle, ...mainNav.querySelectorAll("a")];
      const i = focusables.indexOf(document.activeElement);
      e.preventDefault();
      const next = e.shiftKey
        ? (i <= 0 ? focusables.length - 1 : i - 1)
        : (i === -1 || i === focusables.length - 1 ? 0 : i + 1);
      focusables[next].focus();
    });

    window.addEventListener("resize", () => {
      if (menuOpen && window.innerWidth > 560) setMenu(false);
    });
  }

  /* same-page anchors glide; other-page links wipe (below) */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(el, { offset: -60, duration: 1.4 });
      else el.scrollIntoView({ behavior: "smooth" });
    });
  });

  /* ---------------- page transitions (wipe) ---------------- */

  const wipe = document.querySelector(".wipe");

  function wipeOutThen(href) {
    if (reduced || !wipe) {
      window.location.href = href;
      return;
    }
    gsap.fromTo(
      wipe,
      { yPercent: 101 },
      {
        yPercent: 0,
        duration: 0.42,
        ease: "power3.in",
        onComplete: () => (window.location.href = href),
      }
    );
  }

  document.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    if (!href || !href.endsWith(".html") || a.target === "_blank") return;
    a.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      wipeOutThen(href);
    });
  });

  /* back/forward cache: never come back to a covering veil */
  window.addEventListener("pageshow", (e) => {
    if (e.persisted && wipe) gsap.set(wipe, { yPercent: 101 });
    if (e.persisted) document.body.classList.add("ready");
  });

  /* ---------------- entry: preloader (home) or veil (subpages) ---------------- */

  function pageIntro() {
    if (!introRoot) return;
    if (reduced) return;
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.to(introRoot.querySelectorAll(".intro-fade"), { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08 }, 0.1)
      .to(introRoot.querySelectorAll(".ch"), { yPercent: 0, duration: 0.9, stagger: 0.035 }, 0.15);
    const circle = document.querySelector(".hero-circle .marker-path");
    if (circle) {
      tl.fromTo(circle, { strokeDashoffset: 2400 }, { strokeDashoffset: 0, duration: 1.4, ease: "power2.inOut" }, 0.9);
    }
  }

  if (isHome) {
    const preloader = document.querySelector(".preloader");
    const countEl = document.getElementById("load-count");
    const barEl = document.getElementById("load-bar");

    const preloadSrcs = [
      "assets/img/hero.jpg",
      "assets/img/yos-r2-13a.jpg",
      "assets/img/grad-27.jpg",
      "assets/img/home-23.jpg",
    ];

    let loaded = 0;
    let shown = 0;
    let finished = false;

    const finishLoad = () => {
      if (finished) return;
      finished = true;
      countEl.textContent = "100";
      barEl.style.transform = "scaleX(1)";
      setTimeout(() => {
        preloader.classList.add("done");
        document.body.classList.add("ready");
        startDevelop();
        pageIntro();
        ScrollTrigger.refresh();
        setTimeout(() => (preloader.style.display = "none"), 900);
      }, reduced ? 0 : 350);
    };

    const tickCounter = () => {
      if (finished) return;
      const real = (loaded / preloadSrcs.length) * 100;
      shown += (real - shown) * 0.12 + 0.35;
      if (shown > 99) shown = 99;
      countEl.textContent = Math.floor(shown);
      barEl.style.transform = "scaleX(" + shown / 100 + ")";
      if (loaded >= preloadSrcs.length && shown > 96) finishLoad();
      else requestAnimationFrame(tickCounter);
    };

    preloadSrcs.forEach((src) => {
      const im = new Image();
      im.onload = im.onerror = () => (loaded += 1);
      im.src = src;
    });

    if (reduced) {
      finishLoad();
    } else {
      requestAnimationFrame(tickCounter);
      setTimeout(finishLoad, 6000); // never trap the visitor on the loader
    }
  } else {
    /* subpages arrive covered by the wipe (server-rendered .wipe--in) */
    document.body.classList.add("ready");
    if (wipe && wipe.classList.contains("wipe--in")) {
      if (reduced) {
        wipe.classList.remove("wipe--in");
      } else {
        gsap.to(wipe, {
          yPercent: -101,
          duration: 0.55,
          ease: "power3.out",
          delay: 0.08,
          onComplete: () => {
            wipe.classList.remove("wipe--in");
            gsap.set(wipe, { yPercent: 101 });
          },
        });
      }
    }
    pageIntro();
  }

  /* ---------------- scroll choreography ---------------- */

  const mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: no-preference)", () => {

    // headings (the intro root's own heading is handled by pageIntro)
    gsap.utils.toArray(".split").forEach((el) => {
      if (introRoot && introRoot.contains(el)) return;
      gsap.fromTo(
        el.querySelectorAll(".ch"),
        { yPercent: 115 },
        {
          yPercent: 0,
          duration: 0.7,
          stagger: 0.03,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        }
      );
    });

    // prose + figure reveals
    gsap.utils.toArray(".reveal, .shot, .cell, .roll-card, .sheet-cell").forEach((el) => {
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 36 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 92%", once: true },
        }
      );
    });

    // photos drift inside their frames
    gsap.utils.toArray(".shot-frame img, .about-frame img, .card-frame img").forEach((img) => {
      gsap.fromTo(
        img,
        { yPercent: -5.5 },
        {
          yPercent: 5.5,
          ease: "none",
          scrollTrigger: {
            trigger: img.parentElement,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        }
      );
    });

    // grids lean with scroll velocity
    const clamp = gsap.utils.clamp(-3, 3);
    document.querySelectorAll(".skewable").forEach((grid) => {
      const setter = gsap.quickSetter(grid, "skewY", "deg");
      const proxy = { skew: 0 };
      ScrollTrigger.create({
        trigger: grid,
        start: "top bottom",
        end: "bottom top",
        onUpdate(self) {
          const v = clamp(self.getVelocity() / -400);
          if (Math.abs(v) > Math.abs(proxy.skew)) {
            proxy.skew = v;
            gsap.to(proxy, {
              skew: 0,
              duration: 0.9,
              ease: "power3",
              overwrite: true,
              onUpdate: () => setter(proxy.skew),
            });
          }
        },
      });
    });

    return () => {};
  });

  /* desktop only: pin the roll and scrub it sideways (yosemite page) */
  const rollViewport = document.querySelector(".roll-viewport");
  if (rollViewport) {
    const frameLabels = [...document.querySelectorAll(".roll-track .frame-no")].map((el) =>
      el.textContent.replace(/^fr\.\s*/, "").trim()
    );
    const frameNow = document.getElementById("frame-now");

    mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
      const track = document.querySelector(".roll-track");
      rollViewport.classList.add("is-pinned");

      const dist = () => track.scrollWidth - window.innerWidth;

      gsap.to(track, {
        x: () => -dist(),
        ease: "none",
        scrollTrigger: {
          trigger: ".roll",
          start: "top top",
          end: () => "+=" + dist(),
          scrub: 1,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate(self) {
            const i = Math.round(self.progress * (frameLabels.length - 1));
            if (frameNow) frameNow.textContent = frameLabels[i];
          },
        },
      });

      return () => {
        rollViewport.classList.remove("is-pinned");
        gsap.set(track, { x: 0 });
      };
    });
  }

  window.addEventListener("load", () => ScrollTrigger.refresh());

  /* ---------------- WebGL hero (home only) ---------------- */

  const heroMedia = document.querySelector(".hero-media");
  const glCanvas = document.getElementById("gl");
  const heroImg = document.getElementById("hero-img");

  let gl = null;
  let glReady = false;
  let uni = {};
  let mouse = { x: 0.5, y: 0.5 };
  let glVelo = 0;
  let develop = 0;
  let developOn = false;
  let startTime = performance.now();

  const VERT = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }`;

  const FRAG = `
    precision mediump float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform vec2 u_res;
    uniform vec2 u_img;
    uniform vec2 u_mouse;
    uniform float u_velo;
    uniform float u_time;
    uniform float u_dev;

    void main() {
      float rs = u_res.x / u_res.y;
      float ri = u_img.x / u_img.y;
      vec2 scale = rs < ri ? vec2(ri / rs, 1.0) : vec2(1.0, rs / ri);
      vec2 uv = (v_uv - 0.5) / scale + 0.5;
      uv.y = 1.0 - uv.y;

      vec2 m = vec2(u_mouse.x, u_mouse.y);
      float aspect = u_res.x / u_res.y;
      vec2 duv = vec2((v_uv.x - m.x) * aspect, v_uv.y - m.y);
      float dist = length(duv);
      float force = smoothstep(0.38, 0.0, dist) * u_velo;
      uv -= normalize(duv + 1e-5) * force * 0.06;
      uv.x += sin(uv.y * 12.0 + u_time * 1.6) * force * 0.012;

      vec3 col = texture2D(u_tex, uv).rgb;

      float g = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 print = mix(vec3(g) * 1.1 + 0.06, col, u_dev);
      print = mix(vec3(0.5), print, 0.85 + 0.15 * u_dev);

      float vig = 1.0 - 0.28 * smoothstep(0.45, 1.0, length(v_uv - 0.5) * 1.35);
      gl_FragColor = vec4(print * vig, 1.0);
    }`;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(sh);
    return sh;
  }

  function sizeGL() {
    if (!gl) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = heroMedia.clientWidth, h = heroMedia.clientHeight;
    glCanvas.width = w * dpr;
    glCanvas.height = h * dpr;
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    gl.uniform2f(uni.res, w, h);
  }

  function initGL() {
    try {
      gl = glCanvas.getContext("webgl", { antialias: false, alpha: false });
      if (!gl) return;
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw gl.getProgramInfoLog(prog);
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "a_pos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      ["u_res", "u_img", "u_mouse", "u_velo", "u_time", "u_dev"].forEach((n) => {
        uni[n.slice(2)] = gl.getUniformLocation(prog, n);
      });

      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, heroImg);

      gl.uniform2f(uni.img, heroImg.naturalWidth, heroImg.naturalHeight);
      sizeGL();
      window.addEventListener("resize", sizeGL);

      heroMedia.classList.add("gl-on");
      glReady = true;
      gsap.ticker.add(renderGL);
    } catch (err) {
      glReady = false; // the plain <img> stays visible, so nothing breaks
    }
  }

  function startDevelop() {
    developOn = true;
    if (reduced) develop = 1;
  }

  function renderGL() {
    if (!glReady) return;
    const rect = heroMedia.getBoundingClientRect();
    if (rect.bottom < 0) return;
    if (developOn && develop < 1) develop = Math.min(1, develop + 0.008);
    glVelo *= 0.94;
    gl.uniform2f(uni.mouse, mouse.x, mouse.y);
    gl.uniform1f(uni.velo, reduced ? 0 : glVelo);
    gl.uniform1f(uni.time, (performance.now() - startTime) / 1000);
    gl.uniform1f(uni.dev, develop);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  if (heroMedia && glCanvas && heroImg) {
    if (heroImg.complete && heroImg.naturalWidth > 0) initGL();
    else heroImg.addEventListener("load", initGL, { once: true });

    let lastMX = 0, lastMY = 0;
    heroMedia.addEventListener("pointermove", (e) => {
      const r = heroMedia.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) / r.width;
      mouse.y = (e.clientY - r.top) / r.height;
      const d = Math.hypot(e.clientX - lastMX, e.clientY - lastMY);
      lastMX = e.clientX; lastMY = e.clientY;
      glVelo = Math.min(1.4, glVelo + d * 0.012);
    });
  }

  /* ---------------- film grain ---------------- */

  const grainCanvas = document.querySelector(".grain");
  if (!reduced && grainCanvas) {
    const gctx = grainCanvas.getContext("2d");
    const noise = document.createElement("canvas");
    noise.width = noise.height = 160;
    const nctx = noise.getContext("2d");
    let gframe = 0;

    const sizeGrain = () => {
      grainCanvas.width = window.innerWidth;
      grainCanvas.height = window.innerHeight;
    };
    sizeGrain();
    window.addEventListener("resize", sizeGrain);

    gsap.ticker.add(() => {
      if (gframe++ % 4 !== 0) return;
      const d = nctx.createImageData(160, 160);
      const px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        px[i] = px[i + 1] = px[i + 2] = v;
        px[i + 3] = 255;
      }
      nctx.putImageData(d, 0, 0);
      gctx.fillStyle = gctx.createPattern(noise, "repeat");
      gctx.fillRect(0, 0, grainCanvas.width, grainCanvas.height);
    });
  }

  /* ---------------- custom cursor ---------------- */

  if (finePointer && !reduced) {
    document.body.classList.add("has-cursor");
    const dot = document.querySelector(".cursor-dot");
    const ring = document.querySelector(".cursor-ring");
    const label = document.querySelector(".cursor-label");

    if (dot && ring && label) {
      const dotX = gsap.quickSetter(dot, "x", "px");
      const dotY = gsap.quickSetter(dot, "y", "px");
      const ringX = gsap.quickTo(ring, "x", { duration: 0.35, ease: "power3" });
      const ringY = gsap.quickTo(ring, "y", { duration: 0.35, ease: "power3" });

      const LABELS = { view: "view", drag: "drag", drift: "ripple", hi: "hi!", go: "go" };

      window.addEventListener("pointermove", (e) => {
        dotX(e.clientX - 3);
        dotY(e.clientY - 3);
        ringX(e.clientX - 22);
        ringY(e.clientY - 22);
      });

      document.querySelectorAll("[data-cursor]").forEach((el) => {
        el.addEventListener("pointerenter", () => {
          ring.classList.add("is-active");
          label.textContent = LABELS[el.dataset.cursor] || "";
        });
        el.addEventListener("pointerleave", () => {
          ring.classList.remove("is-active");
          label.textContent = "";
        });
      });
    }
  }

  /* ---------------- lightbox ---------------- */

  const lb = document.getElementById("lightbox");
  if (lb) {
    const lbImg = document.getElementById("lb-img");
    const lbCap = document.getElementById("lb-caption");
    const lbCount = document.createElement("p");
    lbCount.className = "lightbox-count mono";
    lbCount.setAttribute("aria-live", "polite");
    lb.prepend(lbCount);
    const items = [...document.querySelectorAll("[data-lb]")];
    let activeItems = items;
    let lbIndex = 0;
    let lastFocus = null;
    let hideTimer = null;
    let swipeStartX = null;

    lbImg.addEventListener("load", () => lb.classList.remove("is-loading"));

    const openLB = (i, nextItems = activeItems) => {
      activeItems = nextItems;
      lbIndex = (i + activeItems.length) % activeItems.length;
      const item = activeItems[lbIndex];
      const img = item.querySelector("img");
      const cap = item.querySelector("figcaption");
      lb.classList.add("is-loading");
      lbImg.src = item.dataset.full || img.currentSrc || img.src;
      lbImg.alt = img.alt;
      lbCap.textContent = cap ? cap.textContent.trim().replace(/\s+/g, " ") : "";
      lbCount.textContent = String(lbIndex + 1).padStart(2, "0") + " / " + String(activeItems.length).padStart(2, "0");
      clearTimeout(hideTimer);
      /* only remember the trigger on a fresh open; arrow navigation
         re-enters here with focus already inside the dialog */
      if (lb.hidden) lastFocus = document.activeElement;
      lb.hidden = false;
      requestAnimationFrame(() => lb.classList.add("is-open"));
      if (lenis) lenis.stop();
      document.documentElement.style.overflow = "hidden"; // lock native scroll too (lenis is null under reduced motion)
      document.getElementById("lb-close").focus();
      requestAnimationFrame(() => { if (lbImg.complete) lb.classList.remove("is-loading"); });
    };

    const closeLB = () => {
      lb.classList.remove("is-open");
      if (lenis) lenis.start();
      document.documentElement.style.overflow = "";
      hideTimer = setTimeout(() => (lb.hidden = true), 350);
      if (lastFocus) lastFocus.focus();
    };

    items.forEach((item, i) => {
      const groupRoot = item.closest(".roll-track, .work-grid, .sheet");
      const itemGroup = groupRoot ? [...groupRoot.querySelectorAll("[data-lb]")] : items;
      const groupIndex = itemGroup.indexOf(item);
      const imageAlt = item.querySelector("img")?.alt || "photo";
      item.setAttribute("tabindex", "0");
      item.setAttribute("role", "button");
      item.setAttribute("aria-label", "Open photo " + (i + 1) + ": " + imageAlt);
      item.addEventListener("click", () => openLB(groupIndex, itemGroup));
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLB(groupIndex, itemGroup); }
      });
    });

    document.getElementById("lb-close").addEventListener("click", closeLB);
    document.getElementById("lb-prev").addEventListener("click", () => openLB(lbIndex - 1));
    document.getElementById("lb-next").addEventListener("click", () => openLB(lbIndex + 1));
    lb.addEventListener("click", (e) => { if (e.target === lb) closeLB(); });
    lb.addEventListener("pointerdown", (e) => { swipeStartX = e.clientX; });
    lb.addEventListener("pointerup", (e) => {
      if (swipeStartX === null) return;
      const distance = e.clientX - swipeStartX;
      swipeStartX = null;
      if (Math.abs(distance) < 55) return;
      openLB(distance > 0 ? lbIndex - 1 : lbIndex + 1);
    });
    lb.addEventListener("pointercancel", () => { swipeStartX = null; });
    window.addEventListener("keydown", (e) => {
      if (lb.hidden) return;
      if (e.key === "Escape") closeLB();
      if (e.key === "ArrowLeft") openLB(lbIndex - 1);
      if (e.key === "ArrowRight") openLB(lbIndex + 1);
      if (e.key === "Tab") {
        /* keep focus inside the dialog (aria-modal alone doesn't trap it) */
        const focusables = [
          document.getElementById("lb-close"),
          document.getElementById("lb-prev"),
          document.getElementById("lb-next"),
        ];
        const i = focusables.indexOf(document.activeElement);
        e.preventDefault();
        const next = e.shiftKey
          ? (i <= 0 ? focusables.length - 1 : i - 1)
          : (i === -1 || i === focusables.length - 1 ? 0 : i + 1);
        focusables[next].focus();
      }
    });
  }

  /* ---------------- price teaser (home) ---------------- */

  /* Three real starting prices, worked out from the same model the
     estimator uses, so the home page can never quote a stale number. */
  const teaser = document.getElementById("price-teaser");
  if (teaser && window.KL_PRICING) {
    const P = window.KL_PRICING;
    const cheapest = P.stocks.reduce((a, b) => (b.roll < a.roll ? b : a));

    ["grad", "couples", "wedding"].forEach((id) => {
      const s = P.sessions.find((x) => x.id === id);
      if (!s) return;
      const from =
        s.minHours * (s.hourly || P.hourly) + s.rolls * (cheapest.roll + P.lab.developScan);

      const card = document.createElement("a");
      card.className = "price-frame reveal";
      card.href = "pricing.html";
      card.setAttribute("data-cursor", "go");

      const eyebrow = document.createElement("span");
      eyebrow.className = "price-from mono";
      eyebrow.textContent = "from";

      const num = document.createElement("span");
      num.className = "price-num";
      num.textContent = "$" + Math.round(from);

      const name = document.createElement("span");
      name.className = "price-name";
      name.textContent = s.name;

      const meta = document.createElement("span");
      meta.className = "price-meta mono";
      const whole = Math.floor(s.minHours);
      meta.textContent =
        [whole ? whole + (whole === 1 ? " hr" : " hrs") : "", s.minHours % 1 ? "30 min" : ""]
          .filter(Boolean).join(" ") + " · " +
        s.rolls + (s.rolls === 1 ? " roll" : " rolls") + " · scans included";

      card.append(eyebrow, num, name, meta);
      teaser.appendChild(card);
    });
  }

  /* ---------------- booking form (contact page) ---------------- */

  const form = document.getElementById("book-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const subject = f.get("type") + " (" + f.get("name") + ")";
      const body =
        "Hi Kiana,\n\n" +
        "Name: " + f.get("name") + "\n" +
        "Email: " + f.get("email") + "\n" +
        "About: " + f.get("type") + "\n\n" +
        f.get("message") + "\n";
      window.location.href =
        "mailto:hello@kianalee.photo?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);
      const note = document.getElementById("form-note");
      if (note) note.textContent = "Your email app should open with everything filled in. If it doesn't, just email hello@kianalee.photo directly.";
    });
  }
})();
