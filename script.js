/* ==========================================================
   ENAVIO AI — script.js
   Modules:
   - navbar scroll state
   - mobile menu
   - scroll reveal (IntersectionObserver)
   - hero particle network (mouse-reactive)
   - final CTA ambient canvas
   - timeline scroll progress
   - magnetic buttons
   - cursor spotlight
   - contact form validation
   ========================================================== */

(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  var isTouchDevice = window.matchMedia("(hover: none)").matches;

  /* ---------- Navbar scroll state ---------- */

  function initNavbarScroll() {
    var navbar = document.getElementById("navbar");
    if (!navbar) return;

    function update() {
      navbar.classList.toggle("scrolled", window.scrollY > 24);
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  /* ---------- Mobile menu ---------- */

  function initMobileMenu() {
    var toggle = document.getElementById("menu-toggle");
    var nav = document.getElementById("nav-links");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Scroll reveal ---------- */

  function initScrollReveal() {
    var targets = document.querySelectorAll(".reveal");
    if (!targets.length) return;

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("in-view"); });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );

    targets.forEach(function (el) { observer.observe(el); });
  }

  /* ---------- Generic particle network renderer ---------- */

  function createNetwork(canvas, options) {
    if (!canvas || prefersReducedMotion) return null;

    var ctx = canvas.getContext("2d");
    var particles = [];
    var width, height;
    var isMobile = window.innerWidth < 768;
    var count = isMobile ? options.mobileCount : options.count;
    var connectDist = isMobile ? options.mobileConnect : options.connect;
    var animationId = null;
    var mouse = { x: null, y: null, active: false };

    function resize() {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    }

    function seed() {
      particles = [];
      for (var i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (options.mouseReact && mouse.active) {
          var dx = mouse.x - p.x;
          var dy = mouse.y - p.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < 140) {
            p.x -= dx * 0.0015;
            p.y -= dy * 0.0015;
          }
        }

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(242, 241, 237, 0.45)";
        ctx.fill();
      }

      for (var a = 0; a < particles.length; a++) {
        for (var b = a + 1; b < particles.length; b++) {
          var ddx = particles[a].x - particles[b].x;
          var ddy = particles[a].y - particles[b].y;
          var dist = Math.sqrt(ddx * ddx + ddy * ddy);

          if (dist < connectDist) {
            var opacity = (1 - dist / connectDist) * 0.3;
            ctx.beginPath();
            ctx.moveTo(particles[a].x, particles[a].y);
            ctx.lineTo(particles[b].x, particles[b].y);
            ctx.strokeStyle = "rgba(79, 209, 232, " + opacity + ")";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(draw);
    }

    function start() {
      if (!animationId) draw();
    }

    function stop() {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    resize();
    seed();
    start();

    window.addEventListener(
      "resize",
      function () {
        resize();
        seed();
      },
      { passive: true }
    );

    if (options.mouseReact && !isTouchDevice) {
      canvas.parentElement.addEventListener("mousemove", function (e) {
        var rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        mouse.active = true;
      });
      canvas.parentElement.addEventListener("mouseleave", function () {
        mouse.active = false;
      });
    }

    return { start: start, stop: stop, canvas: canvas };
  }

  function initNetworks() {
    if (prefersReducedMotion) return;

    var ctaCanvas = document.getElementById("cta-canvas");
    var ctaNet = createNetwork(ctaCanvas, {
      count: 30,
      mobileCount: 14,
      connect: 120,
      mobileConnect: 90,
      mouseReact: false
    });

    // pause off-screen networks to save CPU
    if ("IntersectionObserver" in window && ctaNet) {
      var section = ctaNet.canvas.closest("section");
      if (section) {
        var obs = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              ctaNet.start();
            } else {
              ctaNet.stop();
            }
          });
        });
        obs.observe(section);
      }
    }
  }

  /* ---------- 3D node-network orb (hero) ---------- */
  /* Real 3D points rotated in space and perspective-projected
     to 2D each frame — an abstract network structure, not a
     flat particle field. Distance/connections computed in 3D. */

  function createNodeOrb(canvas) {
    if (!canvas) return;

    var ctx = canvas.getContext("2d");
    var width, height, cx, cy;
    var isMobile = window.innerWidth < 768;
    var nodeCount = isMobile ? 26 : 44;
    var radius = 1;
    var connectDist = 0.85;
    var fov = 2.6;

    var nodes = [];
    var rotY = 0;
    var rotX = 0.25;
    var targetRotY = 0;
    var targetRotX = 0.25;
    var animationId = null;
    var active = true;

    // Fibonacci sphere distribution — evenly spaced points on a sphere
    function seed() {
      nodes = [];
      var offset = 2 / nodeCount;
      var increment = Math.PI * (3 - Math.sqrt(5));

      for (var i = 0; i < nodeCount; i++) {
        var y = i * offset - 1 + offset / 2;
        var r = Math.sqrt(Math.max(0, 1 - y * y));
        var phi = i * increment;

        nodes.push({
          x: Math.cos(phi) * r * radius,
          y: y * radius,
          z: Math.sin(phi) * r * radius
        });
      }
    }

    function resize() {
      width = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      height = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      cx = width / 2;
      cy = height / 2;
    }

    function project(p) {
      // rotate around Y axis
      var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      var x1 = p.x * cosY - p.z * sinY;
      var z1 = p.x * sinY + p.z * cosY;

      // rotate around X axis
      var cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      var y1 = p.y * cosX - z1 * sinX;
      var z2 = p.y * sinX + z1 * cosX;

      var scale = fov / (fov + z2);
      var scaleUnit = Math.min(width, height) * 0.34;

      return {
        x: cx + x1 * scaleUnit * scale,
        y: cy + y1 * scaleUnit * scale,
        z: z2,
        scale: scale
      };
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      var projected = nodes.map(project);

      // connecting lines — computed from original 3D distance
      for (var a = 0; a < nodes.length; a++) {
        for (var b = a + 1; b < nodes.length; b++) {
          var dx = nodes[a].x - nodes[b].x;
          var dy = nodes[a].y - nodes[b].y;
          var dz = nodes[a].z - nodes[b].z;
          var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < connectDist) {
            var pa = projected[a], pb = projected[b];
            var depthAvg = (pa.scale + pb.scale) / 2;
            var opacity = (1 - dist / connectDist) * 0.5 * depthAvg;

            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb.x, pb.y);
            ctx.strokeStyle = "rgba(79, 209, 232, " + opacity.toFixed(3) + ")";
            ctx.lineWidth = Math.max(0.6, depthAvg) * window.devicePixelRatio;
            ctx.stroke();
          }
        }
      }

      // nodes — sorted back-to-front so near ones draw on top
      projected
        .slice()
        .sort(function (p1, p2) { return p1.z - p2.z; })
        .forEach(function (p) {
          var r = Math.max(1.4, 3.2 * p.scale) * window.devicePixelRatio;
          var opacity = 0.35 + p.scale * 0.5;

          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(242, 241, 237, " + Math.min(opacity, 1).toFixed(3) + ")";
          ctx.fill();
        });

      // slow autorotation, gently eased toward mouse-influenced target
      targetRotY += 0.0016;
      rotY += (targetRotY - rotY) * 0.05;
      rotX += (targetRotX - rotX) * 0.05;

      if (active) animationId = requestAnimationFrame(draw);
    }

    function start() {
      active = true;
      if (!animationId) draw();
    }

    function stop() {
      active = false;
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    resize();
    seed();
    start();

    window.addEventListener(
      "resize",
      function () {
        isMobile = window.innerWidth < 768;
        resize();
      },
      { passive: true }
    );

    // subtle mouse-driven tilt — the orb leans toward the cursor
    if (!isTouchDevice) {
      canvas.parentElement.addEventListener("mousemove", function (e) {
        var rect = canvas.getBoundingClientRect();
        var nx = (e.clientX - rect.left) / rect.width - 0.5;
        var ny = (e.clientY - rect.top) / rect.height - 0.5;
        targetRotX = 0.25 + ny * 0.5;
        targetRotY += nx * 0.002;
      });
    }

    if ("IntersectionObserver" in window) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) start();
          else stop();
        });
      });
      obs.observe(canvas.closest(".hero"));
    }
  }

  // Exposed so brain-scene.js can fall back to this procedural orb
  // if WebGL is unavailable or the 3D model fails to load.
  window.EnavioFallbackOrb = createNodeOrb;

  function initNodeOrb() {
    var canvas = document.getElementById("node-orb");
    if (!canvas) return;

    // Reduced motion: draw one cheap static frame and stop —
    // the animated brain scene never loads in this case either.
    if (prefersReducedMotion) {
      var ctx = canvas.getContext("2d");
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      ctx.strokeStyle = "rgba(79, 209, 232, 0.3)";
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width * 0.3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Otherwise: leave the canvas for brain-scene.js to render into.
  }

  /* ---------- Timeline scroll progress ---------- */

  function initTimeline() {
    var timeline = document.getElementById("timeline");
    var progress = document.getElementById("timeline-progress");
    if (!timeline || !progress) return;

    function update() {
      var rect = timeline.getBoundingClientRect();
      var viewportH = window.innerHeight;

      var total = rect.height + viewportH * 0.6;
      var scrolled = viewportH * 0.8 - rect.top;
      var pct = Math.min(Math.max(scrolled / total, 0), 1);

      progress.style.width = (pct * 100).toFixed(1) + "%";
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
  }

  /* ---------- Magnetic buttons ---------- */

  function initMagneticButtons() {
    if (prefersReducedMotion || isTouchDevice) return;

    var buttons = document.querySelectorAll(".magnetic");

    buttons.forEach(function (btn) {
      btn.addEventListener("mousemove", function (e) {
        var rect = btn.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = "translate(" + x * 0.18 + "px, " + y * 0.35 + "px)";
      });

      btn.addEventListener("mouseleave", function () {
        btn.style.transform = "translate(0, 0)";
      });
    });
  }

  /* ---------- Cursor spotlight ---------- */

  function initCursorSpotlight() {
    if (prefersReducedMotion || isTouchDevice) return;

    var spotlight = document.getElementById("cursor-spotlight");
    if (!spotlight) return;

    var visible = false;

    document.addEventListener("mousemove", function (e) {
      spotlight.style.left = e.clientX + "px";
      spotlight.style.top = e.clientY + "px";
      if (!visible) {
        spotlight.style.opacity = "1";
        visible = true;
      }
    });

    document.addEventListener("mouseleave", function () {
      spotlight.style.opacity = "0";
      visible = false;
    });
  }

  /* ---------- Contact form validation ---------- */

  function initContactForm() {
    var form = document.getElementById("contact-form");
    if (!form) return;

    var successMsg = document.getElementById("form-success");

    var fields = [
      { id: "name", errorId: "name-error", message: "Please enter your name." },
      {
        id: "email",
        errorId: "email-error",
        message: "Please enter a valid email address.",
        validate: function (value) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        }
      },
      { id: "message", errorId: "message-error", message: "Tell us a bit about the problem." }
    ];

    function validateField(field) {
      var input = document.getElementById(field.id);
      var errorEl = document.getElementById(field.errorId);
      var value = input.value.trim();
      var isValid = value.length > 0;

      if (isValid && field.validate) isValid = field.validate(value);

      var row = input.closest(".form-row");
      if (isValid) {
        row.classList.remove("invalid");
        errorEl.textContent = "";
      } else {
        row.classList.add("invalid");
        errorEl.textContent = field.message;
      }
      return isValid;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var allValid = fields.every(validateField);

      if (!allValid) {
        successMsg.hidden = true;
        return;
      }

      // NOTE: no backend connected yet. Replace this block with a
      // fetch() call to your API or email service when ready.
      form.reset();
      successMsg.hidden = false;
    });
  }

  /* ---------- Init ---------- */

  document.addEventListener("DOMContentLoaded", function () {
    initNavbarScroll();
    initMobileMenu();
    initScrollReveal();
    initNetworks();
    initNodeOrb();
    initTimeline();
    initMagneticButtons();
    initCursorSpotlight();
    initContactForm();
  });
})();