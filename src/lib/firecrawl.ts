import "server-only";
import { Firecrawl } from "@mendable/firecrawl-js";
import { getServerEnv } from "@/lib/env";

let client: Firecrawl | null = null;

function getClient(): Firecrawl {
  if (!client) {
    client = new Firecrawl({ apiKey: getServerEnv().FIRECRAWL_API_KEY });
  }
  return client;
}

export interface FetchedPage {
  text: string;
  title: string | null;
  sourceUrl: string;
}

/**
 * Fetch a public page via Firecrawl and return its clean markdown text.
 * We only ever scrape public pages (see the product's monitoring rules).
 */
export async function fetchPage(url: string): Promise<FetchedPage> {
  const doc = await getClient().scrape(url, {
    formats: ["markdown"],
    onlyMainContent: true,
  });

  const text = doc.markdown?.trim() ?? "";
  if (!text) {
    throw new Error(`Firecrawl returned no content for ${url}`);
  }

  const title =
    (doc.metadata?.title as string | undefined) ??
    (doc.metadata?.ogTitle as string | undefined) ??
    null;

  return { text, title, sourceUrl: url };
}
