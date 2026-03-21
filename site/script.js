/* PX Site — Script v4
   Nav scroll, Lens PASS/FAIL, FAQ accordion, scroll reveal
   ─────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  /* ── Nav scroll effect (Gemini) ── */
  var nav = document.getElementById('navbar');
  if (nav) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 20) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    });
  }

  /* ── Mobile nav toggle ── */
  var ham = document.querySelector('.nav__ham');
  var links = document.querySelector('.nav__links');
  if (ham && links) {
    ham.addEventListener('click', function () {
      links.classList.toggle('open');
      ham.setAttribute('aria-expanded', links.classList.contains('open'));
    });
    // Close menu when a link is clicked
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        links.classList.remove('open');
      });
    });
  }

  /* ── Lens PASS/FAIL toggle ── */
  var lensTabs = document.querySelectorAll('.lens__tab');
  lensTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      // Remove all tab active states
      lensTabs.forEach(function (t) {
        t.classList.remove('on--pass', 'on--fail');
      });
      // Hide all screens
      document.querySelectorAll('.lens-screen').forEach(function (s) {
        s.classList.remove('active');
      });
      // Activate clicked
      var target = tab.getAttribute('data-target');
      if (target === 'lens-pass') {
        tab.classList.add('on--pass');
      } else {
        tab.classList.add('on--fail');
      }
      var screen = document.getElementById(target);
      if (screen) screen.classList.add('active');
    });
  });

  /* ── FAQ accordion ── */
  document.querySelectorAll('.faq__q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.parentElement;
      var wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq__item').forEach(function (i) {
        i.classList.remove('open');
      });
      if (!wasOpen) item.classList.add('open');
    });
  });

  /* ── Scroll reveal (Gemini IntersectionObserver) ── */
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.reveal').forEach(function (el) {
      observer.observe(el);
    });
  } else {
    // Fallback: show everything immediately
    document.querySelectorAll('.reveal').forEach(function (el) {
      el.classList.add('visible');
    });
  }

})();
