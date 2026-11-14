/* #AndrievskayaTeam. Контент: data/content.js, фото: data/media.js */
(() => {
  'use strict';

  const C = window.CONTENT || {};
  const M = window.MEDIA || {};

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (n) => Math.round(n).toLocaleString('ru-RU');
  /* 1 событие, 2 события, 5 событий */
  const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many; };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const src = (key) => M[key] || '';
  const img = (url, alt, extra = '', lazy = true) => (url ? `<img src="${esc(url)}" alt="${esc(alt)}" ${lazy ? 'loading="lazy" ' : ''}decoding="async" referrerpolicy="no-referrer" ${extra}>` : '');

  /* Портреты пока лежат на старом сайте (Tilda). Его основной сервер бывает недоступен, поэтому
     сначала берём зеркало, а при ошибке пробуем основной адрес. */
  const TILDA = 'static.tildacdn.com', TILDA_MIRROR = 'static.tildacdn.info';
  const mirror = (url) => String(url || '').replace(TILDA, TILDA_MIRROR);

  /* Фото не загрузилось — рамка остаётся спокойной заглушкой */
  document.addEventListener('error', (e) => {
    const t = e.target;
    if (t.tagName !== 'IMG') return;
    if (!t.dataset.retried && t.src.includes(TILDA_MIRROR)) { t.dataset.retried = '1'; t.src = t.src.replace(TILDA_MIRROR, TILDA); return; }
    t.closest('[data-frame]')?.classList.add('noimg');
  }, true);
  document.addEventListener('load', (e) => { if (e.target.tagName === 'IMG') e.target.closest('[data-frame]')?.classList.remove('noimg'); }, true);
  $$('img[data-media]').forEach((el) => {
    const u = src(el.dataset.media);
    if (u) { el.referrerPolicy = 'no-referrer'; el.src = u; } else el.closest('[data-frame]')?.classList.add('noimg');
  });

  /* ── сезон: статусы считаются от сегодняшней даты ────── */
  const day = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const season = (C.season || []).map((e) => {
    const s = day(e.start), en = day(e.end || e.start);
    return { ...e, s, st: en < today ? 'done' : s > today ? 'next' : 'live' };
  }).sort((a, b) => b.s - a.s); /* свежее и будущее — сверху */
  const live = season.filter((e) => e.st === 'live');
  const next = season.filter((e) => e.st === 'next').reverse();
  const done = season.filter((e) => e.st === 'done');

  /* ── стена мониторов ─────────────────────────────────── */
  (() => {
    const cams = (C.cams || []).filter((c) => src(c.img));
    const pgm = $('#pgm'), box = $('#cams');
    if (!pgm || !cams.length) { $('#mv')?.remove(); return; }
    const pic = document.createElement('img');
    pic.referrerPolicy = 'no-referrer'; pic.decoding = 'async';
    pgm.prepend(pic);
    box.innerHTML = cams.map((c, i) => `<button class="cam feed" type="button" data-frame data-i="${i}" aria-pressed="false" aria-label="Камера ${i + 1}: ${esc(c.title)}">${img(src(c.img), '', `style="object-position:${esc(c.pos || '50% 50%')}"`, false)}<span class="cam__n">CAM ${i + 1}</span></button>`).join('');
    const btns = $$('.cam', box);
    let cur = -1, auto = !reduce, seen = true;
    const cut = (i) => {
      if (i === cur) return;
      cur = i;
      const c = cams[i];
      pic.src = src(c.img); pic.alt = `${c.title}. ${c.sub}`; pic.style.objectPosition = c.pos || '50% 50%';
      $('.lower', pgm)?.remove();
      pgm.insertAdjacentHTML('beforeend', `<div class="lower"><b>${esc(c.title)}</b><span>${esc(c.sub)}</span></div>`);
      btns.forEach((b, j) => b.setAttribute('aria-pressed', j === i));
    };
    /* выбрал камеру сам — автопереключение больше не мешает */
    box.addEventListener('click', (e) => { const b = e.target.closest('.cam'); if (b) { auto = false; cut(+b.dataset.i); } });
    new IntersectionObserver(([en]) => { seen = en.isIntersecting; }).observe(pgm);
    cut(0);
    setInterval(() => { if (auto && seen && !document.hidden) cut((cur + 1) % cams.length); }, 4200);
    const clock = $('#mvClock');
    const tick = () => { const n = new Date(); clock.textContent = `${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`; };
    if (clock) { tick(); setInterval(tick, 1000); }
  })();

  /* «сейчас / дальше» под первым экраном */
  (() => {
    const box = $('#now'); if (!box) return;
    const cell = (label, e, cls = '') => (e ? `<a href="#season"${cls ? ` class="${cls}"` : ''}><b>${label}</b><span>${esc(e.title)}, ${esc(e.when)}</span></a>` : '');
    box.innerHTML = (live[0] ? cell('Сейчас в работе', live[0], 'is-live') : cell('Недавно отработали', done[0])) + cell('Дальше по сценарию', next[0]);
    if (!box.innerHTML) box.remove();
  })();

  /* ── сценарный план ──────────────────────────────────── */
  (() => {
    const list = $('#rows'), chips = $('#filters'), more = $('#more'), peek = $('#peek');
    if (!list) return;
    const LIMIT = 10;
    const tag = { next: '<span class="tag tag--next">дальше</span>', live: '<span class="tag tag--live">сейчас</span>', done: '' };
    list.innerHTML = season.map((e) => `<li class="row row--${e.st}" data-tags="${esc((e.tags || []).join(' '))}"${e.img && src(e.img) ? ` data-img="${esc(src(e.img))}"` : ''}>
      <span class="row__when">${esc(e.when)}</span>
      <span class="row__title">${esc(e.title)}${tag[e.st]}${e.place ? `<span class="row__place">${esc(e.place)}</span>` : ''}</span>
      <span class="row__scale">${esc(e.scale)}</span>
      <span class="row__role">${esc(e.role)}</span>
    </li>`).join('');
    const rows = $$('.row', list);
    const filters = C.filters || [];
    const tagsOf = (f) => [f.id, ...(f.also || [])];
    const hit = (f, tags) => f.id === 'all' || tagsOf(f).some((t) => tags.includes(t));
    chips.innerHTML = filters.map((f, i) => `<button class="chip" type="button" data-f="${esc(f.id)}" aria-pressed="${i === 0}">${esc(f.label)}<small>${season.filter((e) => hit(f, e.tags || [])).length}</small></button>`).join('');
    let filter = filters[0], open = false;
    const apply = () => {
      let shown = 0, total = 0;
      rows.forEach((r) => {
        const ok = hit(filter, r.dataset.tags.split(' '));
        if (ok) total++;
        const vis = ok && (open || filter.id !== 'all' || shown < LIMIT);
        r.hidden = !vis; if (vis) shown++;
      });
      more.hidden = filter.id !== 'all' || total <= LIMIT;
      const rest = total - LIMIT;
      more.textContent = open ? 'Свернуть' : `Показать ещё ${rest} ${plural(rest, 'событие', 'события', 'событий')}`;
      more.setAttribute('aria-expanded', open);
    };
    chips.addEventListener('click', (e) => {
      const b = e.target.closest('.chip'); if (!b) return;
      filter = filters.find((f) => f.id === b.dataset.f) || filters[0];
      $$('.chip', chips).forEach((c) => c.setAttribute('aria-pressed', c === b)); apply();
    });
    more.addEventListener('click', () => { open = !open; apply(); if (!open) $('#season').scrollIntoView(); });
    apply();

    /* кадр события появляется рядом с курсором */
    if (peek && fine) {
      const pic = document.createElement('img'); pic.alt = ''; pic.referrerPolicy = 'no-referrer'; peek.append(pic);
      list.addEventListener('pointermove', (e) => {
        const r = e.target.closest('.row[data-img]');
        if (!r) { peek.classList.remove('on'); return; }
        if (pic.dataset.for !== r.dataset.img) { pic.dataset.for = r.dataset.img; pic.src = r.dataset.img; }
        const x = Math.min(e.clientX + 28, innerWidth - 290), y = Math.max(e.clientY - 190, 70);
        peek.style.transform = `translate(${x}px, ${y}px) rotate(-2deg)`;
        peek.classList.add('on');
      });
      list.addEventListener('pointerleave', () => peek.classList.remove('on'));
      addEventListener('scroll', () => peek.classList.remove('on'), { passive: true });
    }
  })();

  /* ── кейсы ───────────────────────────────────────────── */
  (() => {
    const stack = $('#caseStack'); if (!stack) return;
    stack.innerHTML = (C.cases || []).map((c, i) => `<article class="case case--${esc(c.theme)}" style="--i:${i}">
      <div class="case__body">
        <h3 class="case__title">${esc(c.title)}</h3>
        <p class="case__claim">${esc(c.claim)}</p>
        <p class="case__meta">${esc(c.meta)}</p>
        <p class="case__lead">${esc(c.lead)}</p>
        <ul class="case__did">${c.did.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <blockquote class="case__quote">${esc(c.quote)}<cite>${esc(c.by)}</cite></blockquote>
      </div>
      <div class="case__media">${c.imgs.map((m) => `<figure class="shot${m.tall ? ' shot--tall' : ''}${src(m.k) ? '' : ' noimg'}" data-frame>${img(src(m.k), m.alt || m.cap)}${m.cap ? `<figcaption>${esc(m.cap)}</figcaption>` : ''}</figure>`).join('')}</div>
    </article>`).join('');
    /* карточка выше экрана не «липнет», иначе её низ не дочитать */
    const cards = $$('.case', stack);
    const fit = () => cards.forEach((el) => {
      el.style.position = '';
      const cs = getComputedStyle(el);
      if (cs.position === 'sticky' && el.offsetHeight > innerHeight - (parseFloat(cs.top) || 0) - 6) el.style.position = 'relative';
    });
    addEventListener('resize', fit); fit();
    if ('ResizeObserver' in window) { const ro = new ResizeObserver(fit); cards.forEach((el) => ro.observe(el)); }
  })();

  /* ── режиссёр, услуги, команда, закулисье ────────────── */
  const intercom = $('#intercom');
  if (intercom) intercom.innerHTML = (C.intercom || []).map((t) => `<li>${esc(t)}</li>`).join('');

  const svc = $('#svc');
  if (svc) svc.innerHTML = (C.services || []).map((s) => `<div><dt>${esc(s.t)}</dt><dd>${esc(s.d)}</dd></div>`).join('');

  const badges = $('#badges');
  if (badges) {
    const tilt = [-1.4, 1, -0.8, 1.6, -1.2, 0.8, -1.6, 1.2, -0.6, 1.4, -1, 0.9, -1.3];
    badges.innerHTML = (C.team || []).map((p, i) => {
      const ini = p.n.split(' ').map((w) => w[0]).join('').slice(0, 2);
      return `<li class="badge${i ? '' : ' badge--lead'}" style="--r:${tilt[i % tilt.length]}deg">
        <div class="badge__ph" data-frame><span aria-hidden="true">${esc(ini)}</span>${img(mirror(p.p), p.n)}</div>
        <h3 class="badge__name">${esc(p.n)}</h3><p class="badge__role">${esc(p.r)}</p><p class="badge__d">${esc(p.d)}</p>
        <p class="badge__strip" aria-hidden="true">ALL ACCESS</p></li>`;
    }).join('');
  }

  const fails = $('#fails');
  if (fails) fails.innerHTML = (C.fails || []).map((f) => `<li class="note"><h3>${esc(f.t)}</h3><p>${esc(f.d)}</p></li>`).join('');
  const reviews = $('#reviews');
  if (reviews) reviews.innerHTML = (C.reviews || []).map((r) => `<li class="msg"><p>${esc(r.q)}</p><cite>${esc(r.by)}</cite></li>`).join('');

  /* ── конструктор заявки ──────────────────────────────── */
  (() => {
    const B = C.brief, K = C.contacts || {}; if (!B || !$('#builder')) return;
    /* площадка — строка или { label, say }: label на кнопке, say в сообщении */
    const venues = B.venues.map((v) => (typeof v === 'string' ? { label: v, say: v.toLowerCase() } : v));
    const st = { f: B.formats[0].id, v: venues[1].label, t: 46, when: '' };
    const people = (t) => {
      const n = 150 * Math.pow(100000 / 150, t / 100);
      const step = n < 1000 ? 50 : n < 5000 ? 500 : n < 20000 ? 1000 : 5000;
      return Math.max(150, Math.round(n / step) * step);
    };
    const size = (n) => (n < 500 ? 'камерный формат' : n < 3500 ? 'зал или дворец спорта' : n < 12000 ? 'арена' : n < 40000 ? 'стадион или парк' : 'масштаб города');
    const fBox = $('#bFormat'), vBox = $('#bVenue'), range = $('#bScale'), when = $('#bWhen');
    fBox.innerHTML = B.formats.map((f) => `<button class="chip" type="button" data-id="${esc(f.id)}" aria-pressed="${f.id === st.f}">${esc(f.label)}</button>`).join('');
    vBox.innerHTML = venues.map((v) => `<button class="chip" type="button" data-id="${esc(v.label)}" aria-pressed="${v.label === st.v}">${esc(v.label)}</button>`).join('');
    const plain = (s) => s.replace(/[  ]/g, ' '); /* в ссылку — обычные пробелы */
    const draw = () => {
      const n = people(st.t), f = B.formats.find((x) => x.id === st.f), v = venues.find((x) => x.label === st.v) || venues[0];
      $('#bNum').textContent = fmt(n); $('#bLbl').textContent = size(n);
      const ref = B.refs.filter((r) => r.f === st.f).sort((a, b) => Math.abs(Math.log(n / a.n)) - Math.abs(Math.log(n / b.n)))[0];
      $('#tRef').textContent = ref ? ref.t : '';
      $('#tDesc').textContent = ref ? `Похожее мы уже делали. ${ref.d}` : '';
      const w = st.when.trim().replace(/[.!]+$/, '');
      const shown = `Здравствуйте, Татьяна! Готовим ${f.say} примерно на ${fmt(n)} человек, ${v.say}.${w ? ` Сроки: ${w}.` : ''} Ищем режиссёров. Когда вам удобно созвониться?`;
      $('#tMsg').textContent = shown;
      $('#tTg').href = `https://t.me/${encodeURIComponent(K.telegram || '')}?text=${encodeURIComponent(plain(shown))}`;
      $('#tMail').href = `mailto:${K.email || ''}?subject=${encodeURIComponent(plain(`Режиссура: ${f.label.toLowerCase()}, ${fmt(n)} человек`))}&body=${encodeURIComponent(plain(shown))}`;
    };
    const pick = (box, key) => box.addEventListener('click', (e) => {
      const b = e.target.closest('.chip'); if (!b) return;
      st[key] = b.dataset.id; $$('.chip', box).forEach((c) => c.setAttribute('aria-pressed', c === b)); draw();
    });
    pick(fBox, 'f'); pick(vBox, 'v');
    range.addEventListener('input', () => { st.t = +range.value; draw(); });
    when.addEventListener('input', () => { st.when = when.value; draw(); });
    if (K.phone) { const p = $('#tPhone'); p.textContent = K.phone; p.href = K.phoneHref; }
    draw();
  })();

  const yr = $('#year'); if (yr) yr.textContent = new Date().getFullYear();

  /* ── пульт: тайм-код и номер сценария идут за прокруткой ─ */
  const tc = $('#tc'), cue = $('#cue'), bar = $('#bar'), secs = $$('[data-cue]');
  let raf = 0;
  const hud = () => {
    raf = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    if (bar) bar.style.transform = `scaleX(${p})`;
    const fr = Math.round(p * 12 * 60 * 25); /* «шоу» на 12 минут, 25 кадров в секунду */
    if (tc) tc.textContent = `00:${pad(Math.floor(fr / 1500))}:${pad(Math.floor(fr / 25) % 60)}:${pad(fr % 25)}`;
    let idx = 0;
    secs.forEach((s, i) => { if (s.getBoundingClientRect().top <= innerHeight * 0.45) idx = i; });
    if (cue && secs[idx]) cue.textContent = `${pad(idx + 1)} / ${pad(secs.length)} · ${secs[idx].dataset.cue}`;
  };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(hud); }, { passive: true });
  addEventListener('resize', hud);
  hud();
})();
