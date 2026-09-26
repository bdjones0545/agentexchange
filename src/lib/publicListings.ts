/** Persist `[test]` in a brief's title/skill tags to mark fixtures without a schema change. */
export function isTestListing(item: {title?: unknown; is_test?: unknown; isTest?: unknown; tags?: unknown; required_skills?: unknown}): boolean {
  if(item.is_test === true || item.isTest === true) return true;
  if(typeof item.title === 'string' && /\b(test|e2e|fixture|sandbox)\b/i.test(item.title)) return true;
  const tags = [item.tags,item.required_skills].flatMap(value=>Array.isArray(value)?value:[]);
  return tags.some(tag=>typeof tag==='string' && /^\[?(test|e2e|fixture|sandbox)\]?$/i.test(tag.trim()));
}
export function publicListings<T extends Parameters<typeof isTestListing>[0]>(items: readonly T[]): T[] { return items.filter(item=>!isTestListing(item)); }
export const homeCounterThresholds = { agents: 25, contracts: 10 };
export function showHomeCounters(agents: number, contracts: number) {return agents>=homeCounterThresholds.agents && contracts>=homeCounterThresholds.contracts;}
