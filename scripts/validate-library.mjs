import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'library.json'), 'utf8'));
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
new vm.Script(page.match(/<script>([\s\S]*?)<\/script>/)[1]);
const books = new Map(data.books.map(book => [book.id, book]));
assert.equal(books.size, data.books.length, 'Duplicate book ID');
assert.equal(new Set(data.bookOrder).size, books.size, 'Invalid reading order');
assert.ok(data.bookOrder.every(id => books.has(id)));
const loreIds = new Map(Object.entries(data.lore).map(([type, rows]) => [type, new Set(rows.map(row => row.id))]));
const assertFile = relative => {
  const absolute = path.resolve(root, relative);
  assert.ok(absolute.startsWith(root + path.sep), `Path outside repository: ${relative}`);
  assert.ok(fs.existsSync(absolute), `Missing file: ${relative}`);
};
let illustrations = 0, links = 0;
const checkLinks = html => {
  for (const match of html.matchAll(/href="#book=([^"]+)"/g)) {
    assert.ok(books.has(match[1]), `Unknown book target: ${match[1]}`);
  }
  for (const match of html.matchAll(/data-lore-id="([^"]+)"\s+data-lore-type="([^"]+)"/g)) {
    assert.ok(loreIds.get(match[2])?.has(match[1]), `Unknown lore target: ${match[1]}`); links++;
  }
};
for (const book of books.values()) {
  assert.ok(book.title && book.description && book.status && book.collection);
  assert.ok(book.chapters.length, `Empty book: ${book.title}`);
  assertFile(book.sourceFile); assertFile('img/' + book.cover);
  for (const file of book.additionalFiles || []) assertFile(file.url);
  for (const chapter of book.chapters) {
    assert.ok(chapter.title && chapter.content);
    checkLinks(chapter.content);
    for (const match of chapter.content.matchAll(/<img[^>]+src="([^"]+)"/g)) { assertFile(match[1]); illustrations++; }
  }
}
let articles = 0;
for (const rows of Object.values(data.lore)) for (const row of rows) {
  articles++; assert.ok(row.sources.length && row.sources.every(id => books.has('book_' + id)));
  assert.ok(row.full.includes('<details') && row.full.includes('Источники'));
  checkLinks(row.full); assertFile('img/' + row.img);
}
assert.equal(books.get('book_c67316e892f8').chapters.filter(c => c.title.startsWith('Глава')).length, 11);
assert.ok([...books.values()].every(book => book.status === 'Завершено'), 'Only completed works belong in the public library');
assert.ok(!books.has('book_6d4d5a0fc0e4'));
console.log(`OK: ${books.size} books/materials, ${articles} articles, ${illustrations} illustrations, ${links} valid lore links; JavaScript syntax and source files verified.`);
