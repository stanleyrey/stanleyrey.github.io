(function () {
  "use strict";

  const ROOT = document.querySelector('script[src*="script.js"]').getAttribute("src").replace(/script\.js$/, "");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];

  /* ---------- Helpers ---------- */
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === "text") node.textContent = v;
      else if (k === "style") Object.entries(v).forEach(([prop, val]) => (prop.startsWith("--") ? node.style.setProperty(prop, val) : (node.style[prop] = val)));
      else node.setAttribute(k, v);
    });
    (children || []).forEach((c) => node.appendChild(c));
    return node;
  }
  const fetchJSON = (url) => fetch(url, { headers: { Accept: "application/json" } })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`${url} → ${res.status}`))));
  const onceInView = (target, cb, threshold = 0.3) => {
    if (!target) return;
    if (!("IntersectionObserver" in window)) return cb();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { io.disconnect(); cb(); } });
    }, { threshold });
    io.observe(target);
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- Embedded (iframe / ?embed=1) ---------- */
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const embedded = window.self !== window.top || params.has("embed");
  const compact = params.get("embed") === "compact";
  if (embedded) {
    root.classList.add("embedded");
    if (compact) {
      root.classList.add("compact");
      // Compact card for fixed-height frames: hero + highlights + a link to the full site.
      const side = location.hash === "#life" ? "life" : "work";
      const hero = document.querySelector(`.hero[data-side="${side}"]`);
      const cta = el("a", { class: "btn btn-primary", href: `https://stanleyrey.github.io/${side === "life" ? "#life" : ""}`, target: "_top", text: side === "life" ? "Open the photo wall" : "Open the full site" });
      hero?.querySelector(".hero-actions")?.replaceChildren(cta);
      if (side === "work") {
        const strip = el("ul", { class: "compact-strip" }, [...document.querySelectorAll(".featured")].map((f) =>
          el("li", {}, [
            el("a", { href: `https://stanleyrey.github.io/#${f.id}`, target: "_top", text: f.querySelector("h4").textContent }),
            el("span", { text: f.querySelector(".featured-kicker").textContent }),
          ])));
        hero?.appendChild(strip);
      }
    }
    // Open outbound links in the top window instead of inside the frame
    $$('a[href^="http"], a[href^="mailto:"]').forEach((a) => { if (!a.target) a.target = "_top"; });
  }

  /* ---------- Theme ---------- */
  // localStorage can throw inside sandboxed / third-party iframes
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };
  const stored = store.get("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = stored || (prefersDark ? "dark" : "light");
  const toggle = $("#theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      root.classList.add("theme-transition");
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      store.set("theme", next);
      setTimeout(() => root.classList.remove("theme-transition"), 500);
    });
  }

  /* ---------- Work / Life side ---------- */
  const LIFE_ANCHORS = new Set(["#life", "#photos", "#now", "#places"]);
  const WORK_ANCHORS = new Set(["#work", "#about", "#experience", "#publications", "#klearview", "#bdo", "#ai-agent"]);
  const sideBtns = $$("[data-side-target]");
  const main = $("main");
  let flipping = false;
  const applySide = (side) => {
    root.dataset.side = side;
    sideBtns.forEach((b) => { if (b.classList.contains("side-btn")) b.setAttribute("aria-pressed", String(b.dataset.sideTarget === side)); });
  };
  const setSide = (side, { animate = true, hash = null } = {}) => {
    if (root.dataset.side === side) { if (hash) location.hash = hash; return; }
    const finish = () => {
      applySide(side);
      if (hash) location.hash = hash; else history.replaceState(null, "", side === "life" ? "#life" : location.pathname);
      if (!hash) window.scrollTo({ top: 0, behavior: "instant" });
    };
    if (!animate || reduceMotion || !main) return finish();
    if (flipping) return; flipping = true;
    main.classList.add("flip-out");
    main.addEventListener("animationend", () => {
      main.classList.remove("flip-out"); finish(); main.classList.add("flip-in");
      main.addEventListener("animationend", () => { main.classList.remove("flip-in"); flipping = false; }, { once: true });
    }, { once: true });
  };
  const sideForHash = (h) => (LIFE_ANCHORS.has(h) ? "life" : WORK_ANCHORS.has(h) ? "work" : null);
  applySide(sideForHash(location.hash) || "work");
  sideBtns.forEach((b) => b.addEventListener("click", () => setSide(b.dataset.sideTarget)));
  window.addEventListener("hashchange", () => { const side = sideForHash(location.hash); if (side && side !== root.dataset.side) setSide(side, { animate: true, hash: location.hash }); });

  if (embedded && params.has("measure")) {
    // Shows the frame height this page needs at the current width: open the embed URL with
    // &measure=1 in a browser window resized to the Google Sites column width and read the number.
    const badge = el("div", { class: "measure-badge" });
    document.body.appendChild(badge);
    const report = () => {
      const need = document.documentElement.scrollHeight, have = window.innerHeight, ok = have >= need;
      badge.textContent = `frame ${window.innerWidth} × ${have} px · content needs ${need} px · ${ok ? "fits ✓" : `add ${need - have} px`}`;
      badge.classList.toggle("ok", ok);
    };
    new ResizeObserver(report).observe(document.body);
    window.addEventListener("resize", report);
    setTimeout(report, 1500);
  }
  if (embedded) {
    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#"]'); if (!a) return;
      const target = document.querySelector(a.getAttribute("href")); if (!target) return;
      e.preventDefault(); target.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth", block: "start" });
    });
  }

  /* ---------- Footer ---------- */
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
  const inspectDate = $("#inspect-date");
  if (inspectDate) {
    const d = new Date(document.lastModified);
    inspectDate.dateTime = d.toISOString().slice(0, 10);
    inspectDate.textContent = d.toISOString().slice(0, 10);
  }

  /* ---------- Scroll progress ("scan line") ---------- */
  const progress = $("#scan-progress");
  if (progress) {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.setProperty("--p", max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ---------- Reveal on scroll ---------- */
  const revealTargets = $$(".section-head, .about-grid, .featured, .project, .education, .now-grid > *, .pub-list li, .edu-list li, .timeline, .role-head");
  if (!reduceMotion && "IntersectionObserver" in window) {
    revealTargets.forEach((t) => t.classList.add("reveal"));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } });
    }, { threshold: 0.01, rootMargin: "0px 0px -4% 0px" });
    revealTargets.forEach((t) => io.observe(t));
  }

  /* ---------- Hero counters ---------- */
  const counters = $$(".count");
  if (counters.length) {
    const run = () => counters.forEach((c) => {
      const target = Number(c.dataset.count);
      if (reduceMotion) { c.textContent = target; return; }
      const start = performance.now(), dur = 1100;
      const tick = (now) => {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        c.textContent = Math.round(target * eased);
        if (t < 1) requestAnimationFrame(tick);
      };
      c.textContent = "0";
      requestAnimationFrame(tick);
    });
    onceInView($(".hero-stats"), run, 0.4);
  }

  /* ---------- Hero canvas: reticle grid + drifting defects ---------- */
  const canvas = $("#hero-canvas");
  if (canvas && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    const ctx = canvas.getContext("2d");
    const hero = canvas.parentElement;
    const title = $(".hero-title");
    let w = 0, h = 0, dpr = 1, mouse = { x: -9999, y: -9999 };
    const CELL = 28, GAP = 6;
    const defects = Array.from({ length: 9 }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.12, vy: (Math.random() - 0.5) * 0.08, r: 2 + Math.random() * 1.5, alpha: 1 }));
    const css = (name) => getComputedStyle(root).getPropertyValue(name).trim();
    let colors = {};
    const refreshColors = () => { colors = { line: css("--line"), accent: css("--accent"), bad: css("--fig-bad") }; };
    const resize = () => {
      const rect = hero.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      refreshColors();
    };
    resize();
    window.addEventListener("resize", resize);
    new MutationObserver(refreshColors).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    hero.addEventListener("pointermove", (e) => { const r = hero.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; });
    hero.addEventListener("pointerleave", () => { mouse = { x: -9999, y: -9999 }; });

    let last = 0, visible = true;
    new IntersectionObserver((en) => { visible = en[0].isIntersecting; }).observe(hero);

    const frame = (now) => {
      requestAnimationFrame(frame);
      if (!visible || now - last < 33) return;
      const dt = Math.min(0.1, (now - last) / 1000) || 0.033; last = now;
      ctx.clearRect(0, 0, w, h);

      // die grid, lit near the pointer
      const cols = Math.ceil(w / (CELL + GAP)), rows = Math.ceil(h / (CELL + GAP));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const x = i * (CELL + GAP), y = j * (CELL + GAP);
        const d = Math.hypot(x + CELL / 2 - mouse.x, y + CELL / 2 - mouse.y);
        const lit = Math.max(0, 1 - d / 160);
        ctx.fillStyle = colors.line; ctx.globalAlpha = 0.28 + lit * 0.5;
        ctx.fillRect(x, y, CELL, CELL);
        if (lit > 0.02) { ctx.fillStyle = colors.accent; ctx.globalAlpha = lit * 0.35; ctx.fillRect(x, y, CELL, CELL); }
      }

      // defects: drift, hide under the title ("absorber"), re-emerge elsewhere
      const tb = title ? title.getBoundingClientRect() : null, hb = hero.getBoundingClientRect();
      ctx.globalAlpha = 1;
      defects.forEach((p) => {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 0 || p.x > 1) p.vx *= -1; if (p.y < 0 || p.y > 1) p.vy *= -1;
        const px = p.x * w, py = p.y * h;
        const under = tb && px > tb.left - hb.left && px < tb.right - hb.left && py > tb.top - hb.top && py < tb.bottom - hb.top;
        p.alpha += ((under ? 0 : 1) - p.alpha) * 0.12;
        if (p.alpha < 0.02) return;
        ctx.globalAlpha = p.alpha * 0.9;
        ctx.beginPath(); ctx.arc(px, py, p.r, 0, Math.PI * 2); ctx.fillStyle = colors.bad; ctx.fill();
        ctx.globalAlpha = p.alpha * 0.25;
        ctx.beginPath(); ctx.arc(px, py, p.r * 3, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
    };
    requestAnimationFrame(frame);
  }

  /* ---------- Timeline ↔ featured highlight ---------- */
  const spans = $$(".tl-span");
  if (spans.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const span = spans.find((sp) => sp.dataset.for === e.target.id);
        if (span) span.classList.toggle("is-active", e.isIntersecting);
      });
    }, { threshold: 0.25 });
    spans.forEach((sp) => { const t = document.getElementById(sp.dataset.for); if (t) io.observe(t); });
  }

  /* ---------- KlearView: hover a source, light its outputs ---------- */
  const kvFigure = $("#klearview .featured-hero");
  if (kvFigure) {
    const sources = $$(".kv-src", kvFigure), ribbons = $$(".kv-ribbon", kvFigure), cards = $$(".kv-card", kvFigure);
    const clear = () => { kvFigure.classList.remove("kv-focus"); [...sources, ...ribbons, ...cards].forEach((n) => n.classList.remove("is-on")); };
    sources.forEach((src, i) => {
      const targets = src.dataset.target.split(" ");
      const on = () => {
        clear(); kvFigure.classList.add("kv-focus");
        src.classList.add("is-on"); ribbons[i]?.classList.add("is-on");
        targets.forEach((t) => $(`#kv-${t}`, kvFigure)?.classList.add("is-on"));
      };
      src.addEventListener("pointerenter", on);
      src.addEventListener("focus", on);
      src.addEventListener("pointerleave", clear);
      src.addEventListener("blur", clear);
      src.setAttribute("tabindex", "0");
    });
  }

  /* ---------- BDO: run the optimization ---------- */
  const bdo = $("#bdo-figure"), bdoBtn = $("#bdo-run");
  if (bdo && bdoBtn) {
    let running = false;
    const run = async () => {
      if (running) return; running = true;
      bdo.dataset.state = "before";
      bdoBtn.disabled = true; bdoBtn.textContent = "Optimizing…";
      await sleep(reduceMotion ? 0 : 50);
      bdo.dataset.state = "running";
      await sleep(reduceMotion ? 0 : 1400);
      bdo.dataset.state = "after";
      bdoBtn.disabled = false; bdoBtn.textContent = "Run again";
      running = false;
    };
    bdoBtn.addEventListener("click", run);
    onceInView(bdo, () => { if (bdo.dataset.state === "before") run(); }, 0.5);
  }

  /* ---------- AI agent: stream the answer ---------- */
  const ai = $("#ai-figure");
  if (ai) {
    const steps = $$(".ai-step", ai), bars = $$(".ai-bar", ai), clock = $(".ai-clock", ai), bubble = $(".ai-bubble", ai);
    let playing = false;
    const play = async () => {
      if (playing) return; playing = true;
      ai.classList.remove("ai-done"); ai.classList.add("ai-playing");
      [...steps, ...bars].forEach((n) => n.classList.remove("is-shown"));
      const t0 = performance.now();
      const timer = setInterval(() => { if (clock) clock.textContent = ((performance.now() - t0) / 1000).toFixed(1); }, 100);
      const gap = reduceMotion ? 0 : 220;
      await sleep(gap * 2);
      for (const s of $$(".ai-sql .ai-step", ai)) { s.classList.add("is-shown"); await sleep(gap); }
      for (const b of bars) { b.classList.add("is-shown"); await sleep(gap * 0.6); }
      $(".ai-chart .ai-step", ai)?.classList.add("is-shown");
      await sleep(gap);
      for (const s of $$(".ai-step", ai).filter((n) => !n.closest(".ai-sql") && !n.closest(".ai-chart"))) { s.classList.add("is-shown"); await sleep(gap * 0.7); }
      clearInterval(timer);
      ai.classList.remove("ai-playing"); ai.classList.add("ai-done");
      playing = false;
    };
    if (bubble) {
      bubble.addEventListener("click", play);
      bubble.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); play(); } });
    }
    onceInView(ai, play, 0.5);
  }

  /* ---------- Photo wall ---------- */
  const wall = $("#wall"), lightbox = $("#lightbox");
  if (wall && lightbox) {
    const lbImg = $("#lightbox-img"), lbTitle = $("#lightbox-title"), lbDate = $("#lightbox-date"), lbCaption = $("#lightbox-caption"), lbNote = $("#lightbox-note");
    const hash = (str) => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };
    const fmtDate = (d) => { if (!d) return ""; const [y, m, day] = d.split("-"); const dt = new Date(Number(y), (Number(m) || 1) - 1, Number(day) || 1); return dt.toLocaleDateString(undefined, day ? { year: "numeric", month: "short", day: "numeric" } : m ? { year: "numeric", month: "short" } : { year: "numeric" }); };

    // Width on the wall: a deterministic pick from a few sizes per orientation, so runs of
    // similar photos still interleave. Height follows the real aspect ratio (computed in fitRows).
    const kindOf = (ar) => (ar > 2.1 ? "pano" : ar > 1.25 ? "land" : ar > 0.85 ? "sq" : "port");
    const WIDTHS = { pano: [6, 8, 12, 6], land: [4, 6, 8, 4, 6], sq: [3, 4, 6, 4], port: [3, 4, 4, 3] };
    const pickCols = (p, i) => {
      const ar = p.w / p.h, kind = kindOf(ar), opts = WIDTHS[kind];
      if (i === 0) return Math.max(...opts.filter((c) => c <= 8));          // lead with a big one
      return opts[Math.floor(hash(p.src + "w") * opts.length)];
    };
    const noteBand = (len) => (len === 0 ? 0 : len <= 40 ? 0 : len <= 140 ? 64 : 84); // px reserved under the photo

    // Rows are derived from the live column width so the frame keeps the photo's exact ratio.
    const fitRows = () => {
      const cs = getComputedStyle(wall);
      const nCols = cs.gridTemplateColumns.split(" ").length;
      const unit = parseFloat(cs.gridAutoRows), gapY = parseFloat(cs.rowGap) || 0, gapX = parseFloat(cs.columnGap) || 0;
      const inner = wall.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const colW = (inner - gapX * (nCols - 1)) / nCols;
      $$(".pin", wall).forEach((fig) => {
        const cols = Math.min(nCols, Number(fig.dataset.cols));
        const width = cols * colW + (cols - 1) * gapX - 2 * 10.4;          // minus .pin horizontal padding
        const photoH = width / Number(fig.dataset.ar);
        const total = photoH + 10.4 + 12 + 7 + 22 + Number(fig.dataset.noteBand); // paddings + gap + caption
        fig.style.setProperty("--cols", cols);
        fig.style.setProperty("--rows", Math.max(2, Math.ceil((total + gapY) / (unit + gapY))));
      });
    };
    let fitTimer = 0;
    window.addEventListener("resize", () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitRows, 120); });

    const openLightbox = (p) => {
      lbImg.src = ROOT + (p.large || p.src); lbImg.alt = p.title;
      lbTitle.textContent = p.title; lbDate.textContent = fmtDate(p.date);
      lbCaption.textContent = p.note; lbNote.classList.toggle("is-empty", !p.note);
      lightbox.showModal();
    };
    $("#lightbox-close").addEventListener("click", () => lightbox.close());
    lightbox.addEventListener("click", (e) => { if (e.target === lightbox) lightbox.close(); });

    const renderPin = (p, i) => {
      const ar = p.w / p.h, kind = kindOf(ar), cols = pickCols(p, i);
      const r = hash(p.src);
      const tilt = ((r - 0.5) * 3.2).toFixed(2);                     // -1.6° .. 1.6°
      const noteTilt = (((hash(p.src + "n") - 0.5) * 6)).toFixed(2); // -3° .. 3°
      const pinX = 30 + Math.round(hash(p.src + "p") * 40);          // pin somewhere along the top edge
      const noteLen = p.note.length;
      const noteClass = noteLen === 0 ? "" : noteLen <= 40 ? " note-short" : noteLen <= 140 ? " note-mid" : " note-long";
      const fig = el("figure", {
        class: `pin pin-${kind}${noteClass}`,
        "data-cols": cols, "data-ar": ar.toFixed(4), "data-note-band": noteBand(noteLen),
        style: { "--cols": cols, "--rows": 4, "--ar": ar.toFixed(4), "--tilt": `${tilt}deg`, "--note-tilt": `${noteTilt}deg`, "--pin-x": `${pinX}%`, "--delay": `${Math.min(i, 12) * 60}ms` },
      }, [
        el("button", { type: "button", class: "pin-photo", "aria-label": `Open ${p.title}` }, [
          el("img", { src: ROOT + (p.thumb || p.src), alt: p.title, loading: i < 6 ? "eager" : "lazy", decoding: "async", width: p.w, height: p.h }),
        ]),
        el("figcaption", { class: "pin-meta" }, [
          el("span", { class: "pin-title", text: p.title }),
          ...(p.date ? [el("time", { class: "pin-date", datetime: p.date, text: fmtDate(p.date) })] : []),
        ]),
        ...(p.note ? [el("p", { class: "pin-note", text: p.note })] : []),
      ]);
      fig.querySelector(".pin-photo").addEventListener("click", () => openLightbox(p));
      return fig;
    };

    fetchJSON(`${ROOT}wall/manifest.json`)
      .then((photos) => {
        if (!photos.length) return wall.replaceChildren(el("p", { class: "muted", text: "The wall is empty. Drop photos into wall/ and push." }));
        wall.replaceChildren(...photos.map(renderPin));
        fitRows();
        wall.classList.add("is-ready");
      })
      .catch(() => wall.replaceChildren(el("p", { class: "muted", text: "Could not load the wall right now." })));
  }

  /* ---------- Easter egg: inspection mode ---------- */
  const brand = $("#brand"), inspectBtn = $("#inspect-btn");
  let clicks = 0, clickTimer = 0, inspecting = false;
  const inspect = async () => {
    if (inspecting) return; inspecting = true;
    document.body.classList.add("inspecting");
    const inView = (n) => { const r = n.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; };
    const nodes = $$("main h1, main h2, main h3, main h4, main p, main li");
    const pool = nodes.filter(inView).length >= 4 ? nodes.filter(inView) : nodes;
    const words = pool.flatMap((n) => [...n.childNodes].filter((c) => c.nodeType === 3 && c.textContent.trim().length > 12));
    const picks = words.sort(() => Math.random() - 0.5).slice(0, 6);
    const marks = picks.map((textNode) => {
      const text = textNode.textContent, tokens = text.split(/(\s+)/).filter((t) => t.trim().length > 3);
      if (!tokens.length) return null;
      const word = tokens[Math.floor(Math.random() * tokens.length)], idx = text.indexOf(word);
      const after = textNode.splitText(idx); after.splitText(word.length);
      const mark = el("mark", { class: "defect-mark", text: word });
      mark.dataset.id = `D-${String(Math.floor(Math.random() * 900) + 100)}`;
      after.replaceWith(mark); return mark;
    }).filter(Boolean);
    await sleep(reduceMotion ? 300 : 2600);
    marks.forEach((m) => m.replaceWith(document.createTextNode(m.textContent)));
    document.body.classList.remove("inspecting");
    const count = $(".footer-inspect");
    if (count) { count.classList.add("flash"); setTimeout(() => count.classList.remove("flash"), 800); }
    inspecting = false;
  };
  if (brand) {
    brand.addEventListener("click", (e) => {
      clicks += 1; clearTimeout(clickTimer); clickTimer = setTimeout(() => { clicks = 0; }, 900);
      if (clicks >= 5) { e.preventDefault(); clicks = 0; inspect(); }
    });
  }
  if (inspectBtn) inspectBtn.addEventListener("click", inspect);
})();
