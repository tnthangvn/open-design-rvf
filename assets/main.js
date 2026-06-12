/* RỒNG VIỆT — shared interactions (dùng chung mọi page guest) */
(function () {
  'use strict';

  /* ---- 1. Scroll-reveal: animation mỗi block, stagger theo nhóm ---- */
  function initReveal() {
    var blocks = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    if (!('IntersectionObserver' in window) || !blocks.length) {
      blocks.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    // stagger: ô thứ i trong cùng cha → delay tăng dần
    var groups = {};
    blocks.forEach(function (el) {
      var key = el.parentNode;
      groups.k = groups.k || [];
      var arr = el.__g = (el.parentNode.__rvArr = el.parentNode.__rvArr || []);
      arr.push(el);
      el.style.setProperty('--d', Math.min(arr.length - 1, 6) * 80 + 'ms');
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });
    blocks.forEach(function (el) { io.observe(el); });
  }

  /* ---- 2. Count-up cho số liệu (.num[data-count]) ---- */
  function initCount() {
    var nums = document.querySelectorAll('.num[data-count]');
    if (!nums.length || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var el = e.target, end = parseFloat(el.getAttribute('data-count')) || 0,
            suf = el.getAttribute('data-suffix') || '', t0 = null, dur = 1100;
        function step(ts) {
          if (!t0) t0 = ts;
          var p = Math.min((ts - t0) / dur, 1), eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(end * eased) + suf;
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });
    nums.forEach(function (n) { io.observe(n); });
  }

  /* ---- 3. Mobile nav ---- */
  function initNav() {
    var burger = document.querySelector('.h-burger'), nav = document.querySelector('nav.main');
    if (!burger || !nav) return;
    burger.addEventListener('click', function () { nav.classList.toggle('open'); });
    nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') nav.classList.remove('open'); });
  }

  /* ---- 4. Form liên hệ: validate + giả lập gửi ---- */
  function initForm() {
    var form = document.querySelector('form[data-contact]');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      form.querySelectorAll('[required]').forEach(function (inp) {
        var field = inp.closest('.field'), bad = !inp.value.trim();
        if (inp.type === 'email' && inp.value) bad = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value);
        field.classList.toggle('invalid', bad);
        if (bad) ok = false;
      });
      if (!ok) return;
      var done = form.querySelector('.form-ok');
      if (done) done.classList.add('show');
      form.reset();
    });
    form.querySelectorAll('input,textarea').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var f = inp.closest('.field'); if (f) f.classList.remove('invalid');
      });
    });
  }

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function () { initReveal(); initCount(); initNav(); initForm(); });
})();
