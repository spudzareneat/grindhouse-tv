/* ==========================================================
   READABILITY CHECKS
========================================================== */

export function detectReadabilityIssues(text) {
    const issues = [];
    const allCaps = text.match(/\b[A-Z]{3,}\b/g);
    if (allCaps) issues.push(`ALL CAPS: "${allCaps.join('", "')}" — hard to read`);
    const repeated = text.match(/(.)\1{4,}/g);
    if (repeated) issues.push(`Repeated characters: "${repeated.join('", "')}" — hard to read`);
    const excessPunct = text.match(/[!?]{3,}/g);
    if (excessPunct) issues.push(`Excessive punctuation: "${excessPunct.join('", "')}"`);
    return issues;
}
