const PERSONAS = {
  shipper3am: { name: 'The 3AM Shipper', line: 'Your best ideas show up after midnight. So do your bugs.' },
  orchestrator: { name: 'The Orchestrator', line: 'Why do one thing when ten agents can do it?' },
  backseat: { name: 'The Backseat Driver', line: 'You hit Esc like it owes you money.' },
  goblin: { name: 'The Terminal Goblin', line: "If it can't be piped, it doesn't exist." },
  refactorer: { name: 'The Relentless Refactorer', line: 'No line of code is ever finished.' },
  archaeologist: { name: 'The Code Archaeologist', line: 'You dig through the codebase before you touch it.' },
  nightOwl: { name: 'The Night Owl', line: 'Daylight is for meetings. Night is for shipping.' },
  earlyShipper: { name: 'The Early Shipper', line: 'Merged before the coffee got cold.' },
  architect: { name: 'The Vibe Architect', line: 'You describe it. It ships.' },
};

const TOOL_PERSONAS = {
  Bash: PERSONAS.goblin,
  Edit: PERSONAS.refactorer,
  MultiEdit: PERSONAS.refactorer,
  Write: PERSONAS.refactorer,
  Read: PERSONAS.archaeologist,
  Grep: PERSONAS.archaeologist,
  Glob: PERSONAS.archaeologist,
};

/**
 * Picks the archetype shown on the card, from the most to the least distinctive trait.
 * @param {{ peakHour: number | null, sessions: number, subagentRuns: number, prompts: number,
 *   interrupts: number, topTools: { name: string }[] }} stats
 * @returns {{ name: string, line: string }}
 */
export function pickPersona({ peakHour, sessions, subagentRuns, prompts, interrupts, topTools }) {
  if (peakHour !== null && peakHour < 5) return PERSONAS.shipper3am;
  if (subagentRuns >= 5 && subagentRuns >= sessions * 0.5) return PERSONAS.orchestrator;
  if (interrupts >= 5 && interrupts >= prompts * 0.1) return PERSONAS.backseat;
  const byTool = topTools[0] && TOOL_PERSONAS[topTools[0].name];
  if (byTool) return byTool;
  if (peakHour !== null && peakHour >= 20) return PERSONAS.nightOwl;
  if (peakHour !== null && peakHour < 9) return PERSONAS.earlyShipper;
  return PERSONAS.architect;
}
