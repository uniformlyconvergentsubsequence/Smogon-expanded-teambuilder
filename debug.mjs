// Check gen4ubers availability at different rating tiers
const tiers = ['0', '1500', '1630', '1695', '1760', '1825'];
for (const t of tiers) {
  const url = `https://www.smogon.com/stats/2026-01/chaos/gen4ubers-${t}.json`;
  const r = await fetch(url);
  console.log(`gen4ubers-${t}: ${r.status}`);
}

// Also check what gen4 files exist
const r2 = await fetch('https://www.smogon.com/stats/2026-01/chaos/');
const html = await r2.text();
const gen4Files = [...html.matchAll(/href="(gen4[^"]+)"/g)].map(m => m[1]);
console.log('\nGen4 chaos files:', gen4Files);

// Check if 2026-01 even exists
const r3 = await fetch('https://www.smogon.com/stats/');
const statsHtml = await r3.text();
const months = [...statsHtml.matchAll(/href="(20[^"]+)"/g)].map(m => m[1]).slice(-5);
console.log('\nLatest months:', months);
