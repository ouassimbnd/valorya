// Tests de la logique pure (points, types de commerce, CSV). Lancer : npm run test:logic
const ts = require("typescript"); const fs = require("fs"); const vm = require("vm"); const path = require("path"); const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
function load(file) {
  const exports = {}; const js = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const req = name => (name.startsWith("./") ? load(path.resolve(path.dirname(file), name + ".ts")) : require(name));
  vm.runInNewContext(js, { exports, require: req, Date, Math, Number, Array, Set, JSON, String, RegExp, parseInt, Intl }, { filename: file }); return exports;
}
const L = load(root + "/lib/loyalty.ts"); const T = load(root + "/lib/business-types.ts");
// Points : identique à la base (visites × 10 + avis × 5 − dépensés).
assert.equal(L.computePoints(8, 2, 30), 60); assert.equal(L.computePoints(0, 0, 50), 0);
// Prochaine récompense.
const rw = [{ id: "a", name: "A", points_cost: 30 }, { id: "b", name: "B", points_cost: 80 }];
assert.deepEqual(JSON.parse(JSON.stringify(L.nextReward(rw, 10))), { reward: rw[0], remaining: 20, ready: false });
assert.equal(L.nextReward(rw, 40).reward.id, "b"); assert.equal(L.nextReward(rw, 40).ready, true);
assert.equal(L.nextReward(rw, 200).remaining, 0); assert.equal(L.nextReward([], 5).reward, null);
assert.equal(L.percent(50, 80), 63); assert.equal(L.percent(5, 0), 0); assert.equal(L.percent(200, 80), 100);
assert.equal(L.slugify("Maison Auguste — Café & Thé"), "maison-auguste-cafe-the"); assert.equal(L.initials("camille dupont"), "CD");
assert.equal(L.safeColor("javascript:1", "#24755e"), "#24755e"); assert.match(L.shade("#24755e", -0.4), /^#[0-9a-f]{6}$/);
assert.equal(L.csvCell("=CMD()"), "'=CMD()"); assert.equal(L.csvCell('a;"b"'), '"a;""b"""'); assert.equal(L.plural(2, "visite", "visites"), "2 visites");
// Types de commerce : chaque métier a un vocabulaire et au moins 2 récompenses valides.
assert.ok(T.BUSINESS_TYPES.length >= 8);
for (const t of T.BUSINESS_TYPES) { assert.ok(t.rewards.length >= 2, t.key); for (const r of t.rewards) assert.ok(r.points >= 10 && r.points % 5 === 0 && r.name.length >= 2 && r.name.length <= 100, t.key + ":" + r.name); assert.ok(t.logos.length >= 3 && t.visit.one && t.team.title); }
// Reconnaissance des anciennes catégories saisies librement.
const k = c => T.resolveType(c).key;
assert.equal(k("Coiffeur"), "coiffeur"); assert.equal(k("Salon de coiffure mixte"), "coiffeur"); assert.equal(k("Restaurant italien"), "restaurant"); assert.equal(k("Parfumerie de niche"), "parfumerie");
assert.equal(k("Institut de beauté"), "institut"); assert.equal(k("Boulangerie"), "boulangerie"); assert.equal(k("Café"), "cafe"); assert.equal(k(null), "autre"); assert.equal(k("Garage"), "autre");
assert.equal(k(T.getType("boutique").label), "boutique");
console.log("PASS: points, récompenses, slug, CSV, 8 types de commerce, reconnaissance des catégories");
