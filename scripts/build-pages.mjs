import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repository = process.env.GITHUB_REPOSITORY;
const revision = process.env.GITHUB_SHA;
if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !/^[a-f\d]{40}$/.test(revision || '')) {
  throw new Error('Set GITHUB_REPOSITORY and GITHUB_SHA to the repository and full commit SHA.');
}
// Pin assets to the same commit as the page, so later pushes cannot mix versions.
const assets = `https://raw.githubusercontent.com/${repository}/${revision}/`;
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replaceAll("url('img/", `url('${assets}img/`)
  .replaceAll('src="img/', `src="${assets}img/`)
  .replaceAll("this.src='img/", `this.src='${assets}img/`);

function rewrite(value) {
  if (typeof value === 'string') {
    return value.replace(/(^|["'(=])((?:img|sources)\/)/g, (_, prefix, directory) => prefix + assets + directory);
  }
  if (Array.isArray(value)) return value.map(rewrite);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewrite(item)]));
  }
  return value;
}
const library = rewrite(JSON.parse(fs.readFileSync(path.join(root, 'library.json'), 'utf8')));
const output = path.join(root, '_site');
fs.mkdirSync(output, { recursive: true });
// Upload only these files; do not copy img/ or sources/ into _site.
fs.writeFileSync(path.join(output, 'index.html'), page);
fs.writeFileSync(path.join(output, 'library.json'), JSON.stringify(library));
fs.writeFileSync(path.join(output, '.nojekyll'), '');
console.log(`Pages package: ${fs.statSync(path.join(output, 'index.html')).size + fs.statSync(path.join(output, 'library.json')).size} bytes`);
