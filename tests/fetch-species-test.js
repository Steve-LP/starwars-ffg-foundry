(async () => {
  let items = [];
  for (const pack of game.packs.values()) {
    if (pack.documentName === "Item") {
      const index = await pack.getIndex({ fields: ["type"] });
      const matchingIds = index.filter(i => i.type === "species").map(i => i._id);
      if (matchingIds.length > 0) {
        console.log(`Pack ${pack.metadata.id} has ${matchingIds.length} species.`);
        const docs = await pack.getDocuments({ _id: { $in: matchingIds } });
        console.log(`getDocuments returned type:`, Array.isArray(docs) ? 'Array' : typeof docs, docs);
        
        // Sometimes getDocuments doesn't accept { _id: { $in: matchingIds } } ?
        // wait, pack.getDocuments() in V11+ just takes an object { query }? No, pack.getDocuments() doesn't take queries like that! 
        // In Foundry VTT, pack.getDocuments() doesn't support MongoDB queries like { _id: { $in: ... } } !
      }
    }
  }
})();
