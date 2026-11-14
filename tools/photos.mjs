#!/usr/bin/env node
/**
 * Фото для сайта берутся из постов Telegram-канала и со старого сайта.
 *
 *   node tools/photos.mjs            — обновить ссылки на фото (data/media.js)
 *   node tools/photos.mjs --download — сохранить все фото в assets/media/, чтобы сайт не зависел от чужих серверов
 *
 * Node 18+, без зависимостей. Нужен доступ к t.me с машины, где запускается скрипт.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHANNEL = 'andrievskaya_sport';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOWNLOAD = process.argv.includes('--download');

/** Отобранные кадры: ключ → [номер поста, номер фото в посте]. */
const MEDIA = {
  t_mic: [8539, 0], t_headset: [8539, 1], t_ice: [8539, 2], t_dark: [8539, 3], t_desk: [8539, 4],
  velo_t: [9463, 0], velo_t3: [9463, 4],
  velo_lift: [7508, 0], velo_stage: [7508, 1], velo_stage2: [7508, 2], velo_crowd: [7508, 5],
  velo_kids: [7508, 6], velo_hostess: [9111, 0],
  ovi_girls: [9278, 0], ovi_corridor: [9278, 8], ovi_awards: [9278, 9], ovi_t: [9264, 1], ovi_team: [9264, 8],
  rock: [8769, 0], bsl: [9735, 0], bsl_star: [9641, 0],
  bal_stage: [9027, 4], bal_fx: [9027, 5], bal_crowd: [9027, 9],
  topski: [9629, 0], greb: [9387, 0],
};

const UA = { 'user-agent': 'Mozilla/5.0 (compatible; site-photos/1.0)' };
const get = async (url) => {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
};
const photosOf = (html) => {
  const out = [];
  const re = /class="[^"]*tgme_widget_message_photo_wrap[^"]*"[^>]*style="[^"]*background-image:url\('([^']+)'\)/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
};
const save = async (url, file) => {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  await writeFile(join(ROOT, file), Buffer.from(await r.arrayBuffer()));
  return file.replace(/\\/g, '/');
};

async function media() {
  const cache = new Map();
  const out = {};
  for (const [key, [id, n]] of Object.entries(MEDIA)) {
    if (!cache.has(id)) cache.set(id, photosOf(await get(`https://t.me/${CHANNEL}/${id}?embed=1&mode=tme`).catch(() => '')));
    const url = cache.get(id)[n];
    if (!url) { console.warn(`  нет кадра: ${key} (пост ${id})`); continue; }
    out[key] = url;
  }
  if (DOWNLOAD) {
    await mkdir(join(ROOT, 'assets/media'), { recursive: true });
    for (const [key, url] of Object.entries(out)) out[key] = await save(url, `assets/media/${key}.jpg`).catch(() => url);
  }
  await writeFile(join(ROOT, 'data/media.js'), `/* Сгенерировано tools/photos.mjs — не редактировать вручную */\nwindow.MEDIA = ${JSON.stringify(out, null, 1)};\n`, 'utf8');
  return Object.keys(out).length;
}

/** --download: портреты команды со старого сайта переносим в проект и правим ссылки в data/content.js */
async function team() {
  const file = join(ROOT, 'data/content.js');
  let text = await readFile(file, 'utf8');
  const urls = [...new Set(text.match(/https:\/\/static\.tildacdn\.com\/[^'"\s]+/g) || [])];
  if (!urls.length) return 0;
  await mkdir(join(ROOT, 'assets/media/team'), { recursive: true });
  let i = 0;
  for (const url of urls) {
    const ext = (url.match(/\.(png|jpe?g|webp)$/i) || ['.jpg'])[0].toLowerCase();
    const name = `assets/media/team/${String(++i).padStart(2, '0')}${ext}`;
    /* основной сервер Tilda бывает недоступен — тогда берём зеркало */
    const local = await save(url, name).catch(() => save(url.replace('static.tildacdn.com', 'static.tildacdn.info'), name)).catch(() => null);
    if (local) text = text.split(url).join(local);
  }
  await writeFile(file, text, 'utf8');
  return i;
}

const m = await media();
const t = DOWNLOAD ? await team() : 0;
console.log(`Готово: кадров — ${m}${DOWNLOAD ? `, портретов команды — ${t} (фото сохранены в assets/media/)` : ''}`);
