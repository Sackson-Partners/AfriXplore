import { apiFetch } from './api-client';

export interface SearchResult {
  id: string;
  type: 'mine' | 'target' | 'document' | 'convergence';
  title: string;
  subtitle: string;
  metadata?: string;
  url: string;
  score?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

/**
 * Global search across mines, targets, documents, and convergence scores
 */
export async function globalSearch(query: string, limit: number = 20): Promise<SearchResponse> {
  if (!query || query.trim().length < 2) {
    return { results: [], total: 0, query };
  }

  const trimmedQuery = query.trim().toLowerCase();

  // Search mines by name, region, country, or coordinates
  const minesPromise = apiFetch<any>('/mines?page=1&page_size=50').catch(() => ({ data: [] }));

  // Search convergence scores
  const convergencePromise = apiFetch<any>('/convergence/scores?page=1&page_size=50').catch(() => ({ data: [] }));

  const [minesResponse, convergenceResponse] = await Promise.all([minesPromise, convergencePromise]);

  const results: SearchResult[] = [];

  // Search mines
  if (minesResponse?.data) {
    minesResponse.data
      .filter((mine: any) => {
        const searchable = `${mine.name} ${mine.country} ${mine.region || ''} ${mine.commodity}`.toLowerCase();
        return searchable.includes(trimmedQuery);
      })
      .slice(0, 10)
      .forEach((mine: any) => {
        results.push({
          id: mine.id,
          type: 'mine',
          title: mine.name,
          subtitle: `${mine.country}${mine.region ? `, ${mine.region}` : ''}`,
          metadata: `${mine.commodity} • DPI: ${mine.dpi_score?.toFixed(0) ?? 'N/A'}`,
          url: `/mines/${mine.id}`,
        });
      });
  }

  // Search convergence scores
  if (convergenceResponse?.data) {
    convergenceResponse.data
      .filter((score: any) => {
        const searchable = `${score.mine_name}`.toLowerCase();
        return searchable.includes(trimmedQuery) && !results.some(r => r.id === score.mine_id);
      })
      .slice(0, 5)
      .forEach((score: any) => {
        results.push({
          id: score.mine_id,
          type: 'convergence',
          title: score.mine_name,
          subtitle: 'Convergence Target',
          metadata: `Score: ${score.estimated_convergence_score.toFixed(0)}/100${score.certified_target ? ' • Certified' : ''}`,
          url: `/mines/${score.mine_id}`,
          score: score.estimated_convergence_score,
        });
      });
  }

  // Limit total results
  const limitedResults = results.slice(0, limit);

  return {
    results: limitedResults,
    total: results.length,
    query: trimmedQuery,
  };
}
