export function validateSimilarityMapInvariants(map) {
  const errors = [];
  const entries = Array.isArray(map.entries) ? map.entries : [];
  const shaSet = new Set(entries.map((entry) => entry.sha256));
  const visualGroups = new Set(entries.map((entry) => entry.visualGroupId).filter(Boolean));
  const logicalPathCount = entries.reduce((sum, entry) => sum + (Number.isInteger(entry.sourcePathCount) ? entry.sourcePathCount : 0), 0);
  const unjudgedCount = entries.filter((entry) => !entry.visualGroupId || entry.humanReviewStatus !== 'reviewed').length;
  if (shaSet.size !== entries.length) errors.push('duplicate SHA entry');
  if (map.binaryGroupCount !== entries.length) errors.push(`binaryGroupCount mismatch: declared ${map.binaryGroupCount}, actual ${entries.length}`);
  if (map.logicalPathCount !== logicalPathCount) errors.push(`logicalPathCount mismatch: declared ${map.logicalPathCount}, actual ${logicalPathCount}`);
  if (map.visualGroupCount !== visualGroups.size) errors.push(`visualGroupCount mismatch: declared ${map.visualGroupCount}, actual ${visualGroups.size}`);
  if (map.unjudgedCount !== unjudgedCount) errors.push(`unjudgedCount mismatch: declared ${map.unjudgedCount}, actual ${unjudgedCount}`);
  const groups = new Map();
  for (const entry of entries) {
    if (!entry.visualGroupId) continue;
    const group = groups.get(entry.visualGroupId) ?? [];
    group.push(entry); groups.set(entry.visualGroupId, group);
  }
  for (const [visualGroupId, group] of groups) {
    if (new Set(group.map((entry) => entry.mediaType)).size !== 1) errors.push(`visual group mixes media types: ${visualGroupId}`);
    if (group.some((entry) => entry.visualDecision === 'reviewed_singleton') && group.length !== 1) errors.push(`reviewed_singleton group has ${group.length} members: ${visualGroupId}`);
    if (group.some((entry) => entry.visualDecision === 'human_confirmed_equivalent_group') && group.length < 2) errors.push(`equivalent group has fewer than 2 members: ${visualGroupId}`);
  }
  return errors;
}

export function compareSimilarityEvidenceRow(row, entry) {
  const errors = [];
  compare('visualGroupId', row.visualGroupId, entry.visualGroupId);
  compare('semanticGroupId', row.semanticGroupId ?? null, entry.semanticGroupId ?? null);
  compare('comparisonScope', row.comparisonScope, entry.comparisonScope);
  compare('humanReviewStatus', normalizeHumanStatus(row.humanReviewStatus), entry.humanReviewStatus);
  compare('visualDecision', normalizeVisualDecision(row.visualDecision ?? row.evidence?.visualDecision), entry.visualDecision);
  const rowMethods = normalizeMethods(row.comparisonMethod);
  const entryMethods = normalizeMethods(entry.comparisonMethod);
  if (JSON.stringify(rowMethods) !== JSON.stringify(entryMethods)) errors.push('comparisonMethod mismatch');
  return errors;

  function compare(field, observed, expected) {
    if (observed !== expected) errors.push(`${field} mismatch`);
  }
}

function normalizeVisualDecision(value) {
  if (value === 'reviewed_singleton') return 'reviewed_singleton';
  if (['grouped_visual_equivalent', 'member_of_reviewed_near_duplicate_group'].includes(value)) return 'human_confirmed_equivalent_group';
  return value;
}

function normalizeMethods(value) {
  return [...new Set((Array.isArray(value) ? value : [value]).filter((item) => item != null).map(String))].sort();
}

function normalizeHumanStatus(value) {
  return value === 'reviewed_full_loop_storyboard' ? 'reviewed' : value;
}
