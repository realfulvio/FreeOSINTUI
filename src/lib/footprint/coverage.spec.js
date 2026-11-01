import { describe, expect, it } from 'vitest';
import { emptyFootprintMessage } from './coverage.js';
const cc = { status: 'done', data: { done: true, indexes: [{ error: null, truncated: false }] } };
const wb = { status: 'done', data: { truncated: false } };
describe('empty archive coverage', () => {
	it('permits an empty message only after complete answers', () => {
		expect(emptyFootprintMessage(cc, wb)).toBe('footprint.empty');
	});
	it.each([
		[{ status: 'error' }, { status: 'error' }],
		[cc, { status: 'error' }],
		[{ status: 'loading' }, wb],
		[{ status: 'done', data: { done: true, indexes: [] } }, wb],
		[{ status: 'done', data: { done: true, indexes: [{ error: 'HTTP 504' }] } }, wb],
		[cc, { status: 'done', data: { truncated: true } }],
		[{ status: 'done', data: { done: true, indexes: [{ truncated: true }] } }, wb]
	])('keeps failures, pending checks and truncation inconclusive', (a, b) => {
		expect(emptyFootprintMessage(a, b)).toBe('footprint.incompleteEmpty');
	});
});
