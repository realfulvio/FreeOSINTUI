import { describe, expect, it } from 'vitest';
import { buildUsernameReport } from './report.js';
import { toMarkdown } from '$lib/export/markdown.js';

const result = (name, category, status, url = null, unreliable = false) => ({
	site: name.toLowerCase(),
	name,
	category,
	status,
	url,
	unreliable
});

describe('buildUsernameReport', () => {
	it('lists found accounts and only counts the other statuses', () => {
		const report = buildUsernameReport({
			username: 'torvalds',
			total: 10,
			scanning: true,
			results: [
				result('GitHub', 'coding', 'found', 'https://github.com/torvalds'),
				result('Reddit', 'social', 'found', 'https://reddit.com/u/torvalds', true),
				result('GitLab', 'coding', 'not_found', 'https://gitlab.com/torvalds'),
				result('Slow', 'misc', 'error')
			]
		});
		expect(report.input).toBe('torvalds');
		expect(report.sections[0].note).toMatch(/still running/);
		const markdown = toMarkdown(report);
		expect(markdown).toContain('| Sites checked | 4 / 10 |');
		expect(markdown).toContain('| Not found | 1 |');
		expect(markdown).toContain('| Coding | GitHub | [https://github.com/torvalds]');
		expect(markdown).toContain('| Social | Reddit \\* |');
		expect(markdown).not.toContain('GitLab');
	});

	it('says when no account was found', () => {
		const report = buildUsernameReport({ username: 'x', total: 1, scanning: false, results: [] });
		expect(report.sections[0].note).toMatch(/stopped before/);
		expect(toMarkdown(report)).toContain('No accounts found.');
	});
});
