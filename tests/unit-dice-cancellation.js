/**
 * Unit test (node): narrative dice cancellation in rollFFGPool().
 * Forces specific faces by stubbing Math.random, so every case is deterministic.
 * Run: node tests/unit-dice-cancellation.js
 */
import { rollFFGPool, DICE_FACES } from "../module/dice.js";

let pass = 0, fail = 0;
function assertEqual(name, actual, expected) {
  if (actual === expected) { pass++; console.log(`[PASS] ${name}`); }
  else { fail++; console.log(`[FAIL] ${name}: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

/**
 * Roll a pool with fixed face indices, consumed in pool order.
 * @param {Object} pool          e.g. { proficiency: 1, difficulty: 1 }
 * @param {number[]} faceIndices 0-based face index per die
 */
function rollFixed(pool, faceIndices) {
  const dieTypes = Object.entries(pool).flatMap(([type, count]) => Array(count).fill(type));
  const queue = faceIndices.map((idx, i) => (idx + 0.5) / DICE_FACES[dieTypes[i]].length);
  const original = Math.random;
  Math.random = () => queue.shift();
  try { return rollFFGPool(pool).results; }
  finally { Math.random = original; }
}

const TRIUMPH = 11, DESPAIR = 11;

let r = rollFixed({ proficiency: 1 }, [TRIUMPH]);
assertEqual("Triumph alone: 1 success", r.success, 1);
assertEqual("Triumph alone: 1 triumph", r.triumph, 1);

r = rollFixed({ challenge: 1 }, [DESPAIR]);
assertEqual("Despair alone: 1 failure", r.failure, 1);
assertEqual("Despair alone: 1 despair", r.despair, 1);

r = rollFixed({ proficiency: 1, challenge: 1 }, [TRIUMPH, DESPAIR]);
assertEqual("Triumph vs Despair: successes cancel", r.success, 0);
assertEqual("Triumph vs Despair: failures cancel", r.failure, 0);
assertEqual("Triumph vs Despair: triumph stays", r.triumph, 1);
assertEqual("Triumph vs Despair: despair stays", r.despair, 1);
assertEqual("Triumph vs Despair: not a success", r.isSuccess, false);

r = rollFixed({ proficiency: 1, difficulty: 1 }, [TRIUMPH, 1]);
assertEqual("Triumph vs 1 failure: net 0 successes", r.success, 0);
assertEqual("Triumph vs 1 failure: triumph still counts", r.triumph, 1);

r = rollFixed({ ability: 1, difficulty: 1 }, [3, 1]);
assertEqual("Double success vs failure: net 1 success", r.success, 1);
assertEqual("Double success vs failure: is success", r.isSuccess, true);

r = rollFixed({ ability: 1, setback: 1 }, [7, 4]);
assertEqual("Double advantage vs threat: net 1 advantage", r.advantage, 1);

console.log("==================================================");
console.log(`TOTAL: ${pass + fail} | PASSED: ${pass} | FAILED: ${fail}`);
console.log("==================================================");
if (fail) process.exitCode = 1;
