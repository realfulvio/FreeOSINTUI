// A frozen site list defines the scan. Editing the next input never changes its target.
export function remainingSites(sites, results, retry = false) {
	const bySite = new Map(results.map((result) => [result.site, result]));
	return sites.filter((site) => {
		const result = bySite.get(site.id);
		return retry ? result && ['error', 'unknown'].includes(result.status) : !result;
	});
}
export function replaceResult(results, result) {
	return [...results.filter((old) => old.site !== result.site), result];
}
