/**
 * Unit test (node): Dice So Nice registration without Foundry.
 * Mocks the Foundry core dice terms and replays the Dice So Nice 6.2.9 preset lookups
 * (CONFIG.Dice.terms[denomination].name, core dc/df shapes) against module/dice-so-nice.js.
 * Run: node tests/unit-dice-so-nice.js
 */
class DiceTerm { constructor(d={}){ this.faces=d.faces; this.number=d.number??1; } }
class Die extends DiceTerm { static DENOMINATION="d"; }
class Coin extends DiceTerm { static DENOMINATION="c"; }
class FateDie extends DiceTerm { static DENOMINATION="f"; }
globalThis.foundry = { dice: { terms: { Die } } };
globalThis.CONFIG = { Dice: { terms: { c: Coin, d: Die, f: FateDie } } };
const { registerFFGDiceTerms, registerDiceSoNice, getDsnType } = await import("../module/dice-so-nice.js");
const { rollFFGPool } = await import("../module/dice.js");
let pass=0, fail=0; const ok=(n,c,x="")=>{ c?pass++:fail++; console.log(`${c?"[PASS]":"[FAIL]"} ${n} ${x}`); };

registerFFGDiceTerms();
// DsN standard system contents relevant here: core dc (Coin, d2) and df (FateDie, d6)
const standard = new Map([["dc",{shape:"d2",term:"Coin"}],["df",{shape:"d6",term:"FateDie"}],["d6",{shape:"d6"}],["d8",{shape:"d8"}],["d12",{shape:"d12"}]]);
const ours = new Map();
const dice3d = {
  addSystem(){}, addColorset(){},
  addDicePreset(dice, shape){            // mirrors DiceFactory.addDicePreset 6.2.9
    let model = standard.get(dice.type);
    if (!model || !model.internalAdd) model = standard.get(shape ?? dice.type);
    const den = dice.type.substring(1);
    const term = isNaN(den) ? CONFIG.Dice.terms[den].name : "Die";   // line that crashed
    if (!standard.has(dice.type)) standard.set(dice.type, {shape:model.shape, term});
    ours.set(dice.type, {shape:model.shape, term, labels:dice.labels});
  }
};
try { registerDiceSoNice(dice3d); ok("registerDiceSoNice does not throw", true); } catch(e){ ok("registerDiceSoNice does not throw", false, e.message); }
const expectShape = {ability:"d8",difficulty:"d8",proficiency:"d12",challenge:"d12",force:"d12",boost:"d6",setback:"d6"};
for (const [t,shape] of Object.entries(expectShape)) {
  const type = getDsnType(t), p = ours.get(type), std = standard.get(type);
  ok(`${t} -> ${type} registered as ${shape}`, p?.shape===shape, JSON.stringify(p?.shape));
  ok(`${t}: getPresetBySystem would resolve our preset (std shape matches)`, std?.shape===shape, `std=${std?.shape}`);
  ok(`${t}: label count == faces`, p?.labels.length === Number(shape.slice(1)));
}
ok("core Coin/Fate untouched", CONFIG.Dice.terms.c===Coin && CONFIG.Dice.terms.f===FateDie && CONFIG.Dice.terms.d===Die);
const AbilityDie = CONFIG.Dice.terms.a; const inst = new AbilityDie({number:2});
ok("AbilityDie is a Die with 8 faces", inst instanceof Die && inst.faces===8 && AbilityDie.name==="AbilityDie");
// face index range from the engine stays within DsN 1..faces
let maxOk=true; for(let i=0;i<5000;i++){ for(const r of rollFFGPool({ability:1,proficiency:1,boost:1,difficulty:1,challenge:1,setback:1,force:1}).rolls){ const f=Number(expectShape[r.type].slice(1)); if(r.index+1<1||r.index+1>f) maxOk=false; } }
ok("roll indices map into 1..faces for all 7 dice", maxOk);
if (fail) process.exitCode = 1;
console.log(`TOTAL ${pass+fail} | PASSED ${pass} | FAILED ${fail}`);
