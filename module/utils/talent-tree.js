export class TalentTreeUtils {

  /**
   * Prepares the 2D talent grid with reachability and purchase status.
   * Extracted from SWFFGSpecializationSheet._prepareContext
   */
  static buildGrid(specName, rows, talentsIndex, actor) {
    if (typeof rows === "string") {
      try { rows = JSON.parse(rows); } catch (e) { rows = []; }
    }
    if (!rows || !Array.isArray(rows)) return [];

    const encounteredKeys = {};
    const specNameLower = specName.toLowerCase();

    // Pass 1: Resolve all talents and their purchased state
    const talentGrid = rows.map((row, rIdx) => {
      return row.talents.map((talentKey, colIdx) => {
        const refTalent = talentsIndex.find(t => t.system?.key === talentKey);
        
        encounteredKeys[talentKey] = (encounteredKeys[talentKey] || 0) + 1;

        let isPurchased = actor ? actor.items.some(t => 
          t.type === "talent" && 
          t.system?.key === talentKey && 
          t.system?.specialization === specNameLower && 
          t.system?.row === rIdx && 
          t.system?.col === colIdx
        ) : false;

        if (!isPurchased && actor) {
          const totalOwned = actor.items.filter(t => t.type === "talent" && t.system?.key === talentKey).length;
          const mappedToOthers = actor.items.filter(t => 
            t.type === "talent" && 
            t.system?.key === talentKey && 
            t.system?.specialization === specNameLower && 
            (t.system?.row !== rIdx || t.system?.col !== colIdx)
          ).length;
          isPurchased = (totalOwned - mappedToOthers) >= 1;
        }

        return {
          key: talentKey,
          name: refTalent ? refTalent.name : talentKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
          description: refTalent ? refTalent.system.description : "No description available.",
          activation: refTalent ? refTalent.system.activation : "Passive",
          ranked: refTalent ? refTalent.system.ranked : false,
          purchased: isPurchased,
          directions: row.directions[colIdx] || { up: false, down: false, left: false, right: false },
          row: rIdx,
          col: colIdx
        };
      });
    });

    // Pass 2: BFS reachability
    for (let r = 0; r < talentGrid.length; r++) {
      for (let c = 0; c < talentGrid[r].length; c++) {
        talentGrid[r][c].reachable = (r === 0);
      }
    }

    const queue = [];
    const visited = new Set();
    const keyOf = (r, c) => `${r},${c}`;

    if (talentGrid.length > 0) {
      for (let c = 0; c < talentGrid[0].length; c++) {
        queue.push({ r: 0, c: c });
      }
    }

    while (queue.length > 0) {
      const { r, c } = queue.shift();
      const key = keyOf(r, c);
      if (visited.has(key)) continue;
      visited.add(key);

      const cell = talentGrid[r][c];
      cell.reachable = true;

      if (cell.purchased) {
        const neighbors = [
          { dr: -1, dc: 0, dirSelf: "up", dirOther: "down" },
          { dr: 1, dc: 0, dirSelf: "down", dirOther: "up" },
          { dr: 0, dc: -1, dirSelf: "left", dirOther: "right" },
          { dr: 0, dc: 1, dirSelf: "right", dirOther: "left" }
        ];

        for (const { dr, dc, dirSelf, dirOther } of neighbors) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < talentGrid.length && nc >= 0 && nc < talentGrid[nr].length) {
            const neighbor = talentGrid[nr][nc];
            if (cell.directions[dirSelf] && neighbor.directions[dirOther]) {
              const neighborKey = keyOf(nr, nc);
              if (!visited.has(neighborKey)) {
                queue.push({ r: nr, c: nc });
              }
            }
          }
        }
      }
    }

    return rows.map((row, rIdx) => {
      return {
        index: row.index,
        cost: row.cost,
        talents: talentGrid[rIdx]
      };
    });
  }

  /**
   * Validates if a talent can be safely refunded without breaking path reachability.
   */
  static validateRefund(specName, rows, targetRow, targetCol, actor) {
    if (!actor) return true;
    if (typeof rows === "string") {
      try { rows = JSON.parse(rows); } catch (e) { rows = []; }
    }
    if (!rows || !Array.isArray(rows)) return true;

    const specNameLower = specName.toLowerCase();

    // 1. Build simulated grid
    const talentGrid = rows.map((row, rIdx) => {
      return row.talents.map((talentKey, colIdx) => {
        let isPurchased = actor.items.some(t => 
          t.type === "talent" && 
          t.system?.key === talentKey && 
          t.system?.specialization === specNameLower && 
          t.system?.row === rIdx && 
          t.system?.col === colIdx
        );
        
        if (!isPurchased) {
          const totalOwned = actor.items.filter(t => t.type === "talent" && t.system?.key === talentKey).length;
          const mappedToOthers = actor.items.filter(t => 
            t.type === "talent" && 
            t.system?.key === talentKey && 
            t.system?.specialization === specNameLower && 
            (t.system?.row !== rIdx || t.system?.col !== colIdx)
          ).length;
          isPurchased = (totalOwned - mappedToOthers) >= 1;
        }

        if (rIdx === targetRow && colIdx === targetCol) {
          isPurchased = false;
        }

        return {
          purchased: isPurchased,
          directions: row.directions[colIdx] || { up: false, down: false, left: false, right: false }
        };
      });
    });

    // 2. BFS on simulated grid
    for (let r = 0; r < talentGrid.length; r++) {
      for (let c = 0; c < talentGrid[r].length; c++) {
        talentGrid[r][c].reachable = (r === 0);
      }
    }

    const queue = [];
    const visited = new Set();
    const keyOf = (r, c) => `${r},${c}`;

    if (talentGrid.length > 0) {
      for (let c = 0; c < talentGrid[0].length; c++) {
        queue.push({ r: 0, c: c });
      }
    }

    while (queue.length > 0) {
      const { r, c } = queue.shift();
      const key = keyOf(r, c);
      if (visited.has(key)) continue;
      visited.add(key);

      const cell = talentGrid[r][c];
      cell.reachable = true;

      if (cell.purchased) {
        const neighbors = [
          { dr: -1, dc: 0, dirSelf: "up", dirOther: "down" },
          { dr: 1, dc: 0, dirSelf: "down", dirOther: "up" },
          { dr: 0, dc: -1, dirSelf: "left", dirOther: "right" },
          { dr: 0, dc: 1, dirSelf: "right", dirOther: "left" }
        ];

        for (const { dr, dc, dirSelf, dirOther } of neighbors) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < talentGrid.length && nc >= 0 && nc < talentGrid[nr].length) {
            const neighbor = talentGrid[nr][nc];
            if (cell.directions[dirSelf] && neighbor.directions[dirOther]) {
              const neighborKey = keyOf(nr, nc);
              if (!visited.has(neighborKey)) {
                queue.push({ r: nr, c: nc });
              }
            }
          }
        }
      }
    }

    // 3. Verify
    for (let r = 0; r < talentGrid.length; r++) {
      for (let c = 0; c < talentGrid[r].length; c++) {
        if (r === targetRow && c === targetCol) continue;
        
        const wasPurchased = actor.items.some(t => 
          t.type === "talent" && 
          t.system?.key === rows[r].talents[c] && 
          t.system?.specialization === specNameLower && 
          t.system?.row === r && 
          t.system?.col === c
        );

        if (wasPurchased && !talentGrid[r][c].reachable) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Performs a topological sort of purchased talents to determine a safe refund order.
   * Iteratively finds talents that can be safely refunded (leaves in the dependency graph)
   * and builds an ordered list to refund them.
   */
  static getRefundOrder(specName, rows, actor) {
    if (!actor) return [];
    if (typeof rows === "string") {
      try { rows = JSON.parse(rows); } catch (e) { rows = []; }
    }
    if (!rows || !Array.isArray(rows)) return [];

    const specNameLower = specName.toLowerCase();
    const purchasedTalents = [];

    // Find all talents in this spec that are actually purchased by checking the actor's items
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].talents.length; c++) {
        const talentKey = rows[r].talents[c];
        let talentItem = actor.items.find(t => 
          t.type === "talent" && 
          t.system?.key === talentKey && 
          t.system?.specialization === specNameLower && 
          t.system?.row === r && 
          t.system?.col === c
        );
        
        if (!talentItem) {
          talentItem = actor.items.find(t => t.type === "talent" && t.system?.key === talentKey);
        }

        if (talentItem) {
          purchasedTalents.push({
            id: talentItem.id,
            row: r,
            col: c,
            cost: rows[r].cost,
            name: talentItem.name
          });
        }
      }
    }

    // Clone rows to simulate removing purchased items
    let simulatedRows = JSON.parse(JSON.stringify(rows));
    let order = [];
    let remaining = [...purchasedTalents];

    // Iteratively find a talent that can be safely refunded
    while (remaining.length > 0) {
      let foundSafelyRefundable = false;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        if (this.validateRefund(specName, simulatedRows, candidate.row, candidate.col, { items: remaining.map(rem => ({
          type: "talent",
          system: { key: simulatedRows[rem.row].talents[rem.col], specialization: specNameLower, row: rem.row, col: rem.col }
        })) })) {
          // It's safe to refund this candidate!
          order.push(candidate);
          remaining.splice(i, 1);
          foundSafelyRefundable = true;
          break; // restart loop with updated remaining list
        }
      }

      // Fallback: If there's a loop or a bug preventing normal topological sort, just take the deepest remaining talent.
      if (!foundSafelyRefundable) {
        remaining.sort((a, b) => b.row - a.row); // deepest first
        order.push(remaining[0]);
        remaining.splice(0, 1);
      }
    }

    return order;
  }
}
