/** Only completed, untruncated source answers can support an empty-result message.
 * @param {{ status: string, data?: any }} cc
 * @param {{ status: string, data?: any }} wayback
 */
export function emptyFootprintMessage(cc, wayback) {
	const complete =
		cc.status === 'done' &&
		wayback.status === 'done' &&
		cc.data?.done === true &&
		cc.data.indexes?.length > 0 &&
		cc.data.indexes.every((index) => !index.error && !index.truncated) &&
		wayback.data &&
		!wayback.data.truncated;
	return complete ? 'footprint.empty' : 'footprint.incompleteEmpty';
}
