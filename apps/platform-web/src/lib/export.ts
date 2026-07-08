import { ConvergenceScoreListItem } from './api-client';

/**
 * Export convergence scores to CSV
 */
export function exportToCSV(scores: ConvergenceScoreListItem[], filename: string = 'convergence-targets.csv') {
  const headers = ['Rank', 'Mine ID', 'Mine Name', 'Convergence Score', 'Geology Score', 'Certified Target'];

  const rows = scores
    .sort((a, b) => b.estimated_convergence_score - a.estimated_convergence_score)
    .map((score, idx) => [
      (idx + 1).toString(),
      score.mine_id,
      `"${score.mine_name}"`, // Wrap in quotes to handle commas
      score.estimated_convergence_score.toFixed(1),
      score.geology_score.toFixed(1),
      score.certified_target ? 'Yes' : 'No',
    ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export convergence scores to formatted text (for PDF generation)
 */
export function exportToText(scores: ConvergenceScoreListItem[]): string {
  const sortedScores = scores.sort((a, b) => b.estimated_convergence_score - a.estimated_convergence_score);

  const header = `
CONVERGENCE TARGET REPORT
Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
Total Targets: ${scores.length}
Certified Targets (≥70): ${scores.filter((s) => s.certified_target).length}
High Potential (≥60): ${scores.filter((s) => s.estimated_convergence_score >= 60).length}
Average Score: ${(scores.reduce((sum, s) => sum + s.estimated_convergence_score, 0) / scores.length).toFixed(1)}

─────────────────────────────────────────────────────────────────────────────
`;

  const rows = sortedScores.map((score, idx) => {
    const rank = (idx + 1).toString().padStart(3, ' ');
    const scorePadded = score.estimated_convergence_score.toFixed(0).padStart(3, ' ');
    const certified = score.certified_target ? '[✓ CERTIFIED]' : '';

    return `${rank}. ${score.mine_name} ${certified}
     Score: ${scorePadded}/100 | Geology: ${score.geology_score.toFixed(0)}/10
     Mine ID: ${score.mine_id}
`;
  }).join('\n');

  return header + rows;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}

/**
 * Download text as file
 */
export function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
