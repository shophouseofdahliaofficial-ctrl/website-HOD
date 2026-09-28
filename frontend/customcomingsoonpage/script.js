/* ==========================================================================
   HOUSEOFDAHLIA.IN — SMOOTH SCROLL & CRISP EXPANSION ANIMATION
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('animated-text');
  const actionWrapper = document.querySelector('.action-wrapper');
  const blackOverlay = document.getElementById('black-expand-overlay');
  const stayTunedText = document.getElementById('stay-tuned-text');
  
  const brandText = "Houseofdahlia.in";
  const restText = "COMING SOON";

  // 1. DYNAMIC POP-IN CHARACTER RENDER (ATTACHED SENTENCE FLOW)
  function renderText() {
    container.innerHTML = '';
    let staggerCount = 0;

    // Brand Domain ("Houseofdahlia.in")
    const brandSpan = document.createElement('div');
    brandSpan.className = 'brand-domain';
    for (let char of brandText) {
      const span = document.createElement('span');
      span.className = 't-digit';
      span.setAttribute('data-stagger', staggerCount);
      span.style.animationDelay = `calc(var(--digit-stagger) * ${staggerCount})`;
      span.textContent = char;
      brandSpan.appendChild(span);
      staggerCount++;
    }
    container.appendChild(brandSpan);

    // Rest Text ("COMING SOON")
    const restSpan = document.createElement('div');
    restSpan.className = 'rest-text';
    for (let char of restText) {
      const span = document.createElement('span');
      span.className = 't-digit';
      span.setAttribute('data-stagger', staggerCount);
      span.style.animationDelay = `calc(var(--digit-stagger) * ${staggerCount})`;
      span.textContent = char;
      restSpan.appendChild(span);
      staggerCount++;
    }
    container.appendChild(restSpan);
  }

  renderText();

  // Replay on click (if at top of page)
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('.btn-connect') || window.scrollY > 50) return;
    container.classList.remove('is-animating');
    if (actionWrapper) actionWrapper.style.animation = 'none';
    void container.offsetWidth;
    container.classList.add('is-animating');
    if (actionWrapper) actionWrapper.style.animation = '';
  });

  // 2. LENIS SMOOTH SCROLL INITIALIZATION
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // Sync Lenis with GSAP ScrollTrigger
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  // 3. GSAP SCROLLTRIGGER SCROLL ANIMATION
  gsap.registerPlugin(ScrollTrigger);

  const scrollTimeline = gsap.timeline({
    scrollTrigger: {
      trigger: ".scroll-track",
      start: "top top",
      end: "bottom bottom",
      scrub: 0.5 // Snappy smooth scrub sync
    }
  });

  // Phase A: "COMING SOON" & Connect Button fade out in place
  scrollTimeline
    .to(".rest-text", {
      opacity: 0,
      duration: 0.25,
      ease: "power1.out"
    }, 0)
    .to(".action-wrapper", {
      opacity: 0,
      y: 20,
      pointerEvents: "none",
      duration: 0.25,
      ease: "power1.out"
    }, 0)

  // Phase B: Text zooms in like before while Razor-Sharp Pure Black Mask expands over it
    .to(".text-sentence-wrapper", {
      scale: 2.5,
      duration: 0.75,
      ease: "power2.inOut"
    }, 0.1)
    .to("#bg-video-wrapper", {
      scale: 1.15,
      opacity: 0.2,
      duration: 0.85,
      ease: "power2.inOut"
    }, 0.1)
    .to(blackOverlay, {
      clipPath: "circle(150% at 50% 50%)",
      duration: 0.85,
      ease: "power2.inOut"
    }, 0.1)
    .to(stayTunedText, {
      opacity: 1,
      scale: 1,
      duration: 0.45,
      ease: "power1.inOut"
    }, 0.55);

});
