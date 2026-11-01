import { describe, expect, it } from 'vitest';
import { createReport, fields, list, section, stateSection, table, text } from './report.js';
import { escapeText, toMarkdown } from './markdown.js';
import { reportFilename, toJson } from './files.js';

const now = new Date('2026-10-03T19:52:30Z');

describe('stateSection', () => {
	const toBlocks = (/** @type {string[]} */ names) => [list(names)];

	it('maps loading, error, empty and done states', () => {
		expect(stateSection('A', { status: 'loading' }, toBlocks).status).toBe('loading');
		expect(stateSection('A', null, toBlocks).status).toBe('loading');
		expect(stateSection('A', { status: 'error', error: 'boom' }, toBlocks)).toMatchObject({
			status: 'error',
			error: 'boom'
		});
		expect(stateSection('A', { status: 'done', data: null }, toBlocks).status).toBe('empty');
		expect(stateSection('A', { status: 'done', data: ['x'] }, toBlocks)).toMatchObject({
			status: 'done',
			blocks: [{ type: 'list', items: ['x'] }]
		});
	});

	it('treats data without any non-empty block as empty and shows emptyText', () => {
		const result = stateSection('A', { status: 'done', data: [] }, toBlocks, {
			source: 'src',
			emptyText: 'Nothing found.'
		});
		expect(result).toEqual({
			title: 'A',
			source: 'src',
			status: 'empty',
			blocks: [{ type: 'text', text: 'Nothing found.' }]
		});
	});
});

describe('section', () => {
	it('drops falsy and empty blocks', () => {
		const result = section('S', [
			null,
			false,
			fields([{ label: 'a', value: '' }]),
			table(['x'], []),
			text('kept')
		]);
		expect(result.blocks).toEqual([{ type: 'text', text: 'kept' }]);
		expect(section('S', [list([])]).status).toBe('empty');
	});
});

describe('toMarkdown', () => {
	const report = createReport({
		tool: 'ip',
		input: '8.8.8.8',
		now,
		sections: [
			section(
				'Geolocation',
				[
					fields([
						{ label: 'Country', value: 'United States' },
						{ label: 'ISP', value: null },
						{ label: 'ASN', value: 'AS15169', href: 'https://bgp.he.net/AS15169' }
					])
				],
				{ source: 'ipwho.is' }
			),
			stateSection('Reverse DNS', { status: 'loading' }, () => []),
			stateSection(
				'RDAP',
				{ status: 'error', error: 'rdap.org answered with HTTP 500.' },
				() => []
			),
			section('Ports', [
				table(
					['Port', 'Service'],
					[
						[443, 'https'],
						[53, null]
					],
					'Open ports'
				),
				list([{ text: 'CVE-2024-1', href: 'https://nvd.nist.gov/vuln/detail/CVE-2024-1' }])
			]),
			section('Empty', [])
		]
	});
	const markdown = toMarkdown(report);

	it('writes a header with tool, input and date', () => {
		expect(markdown).toMatch(/^# IP recon report\n/);
		expect(markdown).toContain('- **Input:** `8.8.8.8`');
		expect(markdown).toContain('- **Generated:** 2026-10-03T19:52:30.000Z');
	});

	it('renders fields as a two-column table without blank rows', () => {
		expect(markdown).toContain(
			'## Geolocation\n\n_Source: ipwho.is_\n\n| Field | Value |\n| --- | --- |\n| Country | United States |\n| ASN | [AS15169](https://bgp.he.net/AS15169) |'
		);
		expect(markdown).not.toContain('ISP');
	});

	it('marks loading, error and empty sections', () => {
		expect(markdown).toContain('## Reverse DNS\n\n_Still loading when the report was exported._');
		expect(markdown).toContain('## RDAP\n\n**Error:** rdap.org answered with HTTP 500.');
		expect(markdown).toContain('## Empty\n\n_No data._');
	});

	it('renders titled tables and linked lists', () => {
		expect(markdown).toContain(
			'### Open ports\n\n| Port | Service |\n| --- | --- |\n| 443 | https |\n| 53 |  |'
		);
		expect(markdown).toContain('- [CVE-2024-1](https://nvd.nist.gov/vuln/detail/CVE-2024-1)');
	});

	it('escapes Markdown in values and keeps backticks inside the input code span', () => {
		expect(escapeText('a|b *c* <script>\nnext')).toBe('a\\|b \\*c\\* \\<script\\> next');
		const tricky = toMarkdown(createReport({ tool: 'ip', input: 'a`b', now, sections: [] }));
		expect(tricky).toContain('- **Input:** ``a`b``');
	});

	it('does not link non-web URLs', () => {
		const unsafe = toMarkdown(
			createReport({
				tool: 'ip',
				input: 'x',
				now,
				sections: [section('S', [list([{ text: 'click', href: 'javascript:alert(1)' }])])]
			})
		);
		expect(unsafe).toContain('- click');
		expect(unsafe).not.toContain('javascript:');
	});
});

describe('files', () => {
	const report = createReport({ tool: 'url', input: 'https://ex.com/a b?c=1', now, sections: [] });

	it('builds a safe file name with tool, input and minute', () => {
		expect(reportFilename(report, 'md')).toBe(
			'tracepunk-url-https-ex.com-a-b-c-1-20261003-1952.md'
		);
		const blank = createReport({ tool: 'hash', input: '', now, sections: [] });
		expect(reportFilename(blank, 'json')).toBe('tracepunk-hash-20261003-1952.json');
	});

	it('serializes the report as JSON', () => {
		expect(JSON.parse(toJson(report))).toEqual({
			tool: 'url',
			title: 'URL inspection',
			input: 'https://ex.com/a b?c=1',
			generatedAt: '2026-10-03T19:52:30.000Z',
			sections: []
		});
	});
});
