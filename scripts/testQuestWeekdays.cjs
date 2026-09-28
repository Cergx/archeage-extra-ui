const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

// Предметы и их изображения не нужны для проверки сопоставления квестов.
const source = fs.readFileSync(path.join(__dirname, '../src/data/quests.ts'), 'utf8')
    .replace("import { ITEMS } from './items.js';", 'const ITEMS = {};');
const compiled = transformSync(source, { loader: 'ts', format: 'cjs' }).code;
const context = { module: { exports: {} } };
vm.runInNewContext(compiled, context);
const { QUESTS, findQuestMetaForMarathonQuest: find } = context.module.exports;
const originalQuests = JSON.stringify(QUESTS);
const cases = [
    [{ title: 'Орды Нуимара' }, [0, 3]],
    [{ title: 'Орды Земель покоя' }, [6]],
    [{ title: 'Орды Нуимара и Земель покоя' }, [0, 3, 6]],
    [{ id: 8498, title: 'Орды Нуимара и Земель покоя' }, [0, 3, 6]],
    [{ id: 8372, title: 'Орды Нуимара и Земель покоя' }, [0, 3, 6]],
    [{ title: 'ОРДЫ Земель   покоя, Нуимара и Нуимара' }, [0, 3, 6]],
    [{ title: 'Орды Сальфимара и Орды Сангемара' }, [1, 2, 4, 5]],
    [{ title: 'Орды Нуимара, Сальфимара, Сангемара и Земель покоя' }, [0, 1, 2, 3, 4, 5, 6]],
    [{ id: 8498 }, [0, 3]],
    [{ id: 8498, title: 'Орды Нуимара и Сальфимаралишнее' }, [0, 3]],
];
for (const [input, expected] of cases) {
    assert.deepEqual(Array.from(find(input).availableWeekdays), expected, JSON.stringify(input));
}
assert.equal(find({ title: 'Срочная доставка' }).id, 8635);
assert.equal(find({ title: '' }), null);
assert.equal(find({ id: 999999, title: 'Милосердная жрица' }).id, 8000132);
assert.equal(find({ id: 999999, title: '' }), null);
for (const [title, id] of [
    ['Резные сундучки со всякой всячинойII', 10507],
    ['Резные сундучки со всякой всячиной II', 10507],
    ['Резные сундучки со всякой всячинойii  ', 10507],
    ['Резные сундучки со всякой всячинойII**', 10507],
    ['Резные сундучки со всякой всячинойI', 10506],
    ['Резные сундучки со всякой всячиной I', 10506],
    ['Фермерские сундучки со всякой всячинойII', 10511],
]) {
    assert.equal(find({ title }).id, id, title);
}
assert.equal(JSON.stringify(QUESTS), originalQuests, 'Метаданные одиночных квестов не должны изменяться');
console.log('Quest weekdays: all checks passed');
