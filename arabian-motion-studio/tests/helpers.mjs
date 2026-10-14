import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadProject } from '../src/project.mjs';
import { validate } from '../src/validate.mjs';

export function tmpProject(spec, assets = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-test-'));
  fs.mkdirSync(path.join(dir, 'media'));
  Object.values(assets).forEach((a, i) => fs.writeFileSync(path.join(dir, a.file), Buffer.alloc(200, i + 1)));
  fs.writeFileSync(path.join(dir, 'assets.json'), JSON.stringify(assets));
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(spec));
  return dir;
}
export function check(spec, assets = {}) {
  const dir = tmpProject(spec, assets);
  const P = loadProject(dir, { spec });
  return { P, ...validate(P), dir };
}
export const IDEA = 'إعلان ريل لكتب الذكريات المطبوعة لعرائس هذا الموسم: نحوّل صور الزفاف وضحكات الليلة إلى كتاب بغلاف ساتان أحمر، تصميم خاص، توصيل لباب البيت، وخصم 15% لفترة محدودة، اطلبي من رابط البايو';
