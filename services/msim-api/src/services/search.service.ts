import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import type { HistoricalMine } from '@ain/types';

interface SearchableMine {
  id: string;
  name: string;
  commodity: string;
  country: string;
  region?: string;
}

let searchClient: SearchClient<SearchableMine> | null = null;

function getSearchClient(): SearchClient<SearchableMine> {
  if (searchClient) return searchClient;

  const endpoint = process.env.AZURE_AI_SEARCH_ENDPOINT;
  const key = process.env.AZURE_AI_SEARCH_KEY;
  const index = process.env.AZURE_AI_SEARCH_INDEX_NAME ?? 'mines-index';

  if (!endpoint || !key) {
    throw new Error('Azure AI Search credentials not configured');
  }

  searchClient = new SearchClient<SearchableMine>(endpoint, index, new AzureKeyCredential(key));
  return searchClient;
}

export interface SearchResult {
  items: Pick<HistoricalMine, 'id' | 'name' | 'commodity' | 'country'>[];
  total: number;
  query: string;
}

export async function searchMines(query: string, top = 20): Promise<SearchResult> {
  const client = getSearchClient();

  const results = await client.search(query, {
    top,
    select: ['id', 'name', 'commodity', 'country', 'region'],
    queryType: 'semantic',
    semanticSearchOptions: { configurationName: 'default' },
  });

  const items: Pick<HistoricalMine, 'id' | 'name' | 'commodity' | 'country'>[] = [];
  for await (const result of results.results) {
    items.push({
      id: result.document.id,
      name: result.document.name,
      commodity: [result.document.commodity],
      country: result.document.country,
    });
  }

  return { items, total: results.count ?? items.length, query };
}
