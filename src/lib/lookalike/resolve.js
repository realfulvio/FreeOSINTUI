// Modified 2026 by realfulvio; original attribution in NOTICE.
import { resolveDns } from '$lib/dns/doh.js';
import { runPool } from '$lib/username/pool.js';

/** Maximum number of lookalikes resolved in one run (each costs 4 DNS queries). */
export const RESOLVE_LIMIT = 300;

/** @typedef {{ a: string[], aaaa: string[], mx: string[], ns: string[], hasDns: boolean }} DnsRecords */

/**
 * Extracts the mail hosts of MX answers, dropping the "null MX" (`0 .`) that says a domain
 * accepts no mail.
 * @param {{ data: string }[]} answers
 */
export function mailHosts(answers) {
	return answers
		.map((answer) => answer.data.trim().split(/\s+/)[1]?.replace(/\.$/, '') ?? '')
		.filter(Boolean);
}

/**
 * Resolves DNS evidence only; absence of records does not prove a name is unregistered.
 * @param {string} domain ASCII (Punycode) name
 * @param {{ signal?: AbortSignal, fetch?: typeof fetch }} [options]
 * @returns {Promise<DnsRecords>}
 */
export async function resolveLookalike(domain, options = {}) {
	const values = (/** @type {{ data: string }[]} */ answers) =>
		answers.map((answer) => answer.data);
	const [a, ns, aaaa, mxAnswers] = await Promise.all([
		resolveDns(domain, 'A', options).then(values),
		resolveDns(domain, 'NS', options).then(values),
		resolveDns(domain, 'AAAA', options).then(values),
		resolveDns(domain, 'MX', options)
	]);
	const mx = mailHosts(mxAnswers);
	return {
		a,
		aaaa,
		mx,
		ns,
		hasDns: Boolean(a.length || ns.length || aaaa.length || mxAnswers.length)
	};
}

/**
 * Resolves many lookalikes with a bounded pool, reporting each result as it arrives.
 * @param {string[]} domains
 * @param {{ signal?: AbortSignal, fetch?: typeof fetch, concurrency?: number, onResult: (domain: string, records: DnsRecords) => void, onError: (domain: string, error: unknown) => void }} options
 */
export function resolveAll(domains, { signal, fetch, concurrency = 8, onResult, onError }) {
	return runPool(domains, (domain) => resolveLookalike(domain, { signal, fetch }), {
		concurrency,
		signal,
		onResult: (records, domain) => onResult(domain, records),
		onError: (error, domain) => onError(domain, error)
	});
}
