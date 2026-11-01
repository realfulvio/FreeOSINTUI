// Unit tests exercise report builders without a SvelteKit navigation.
import { loadNamespace } from './catalog.js';
const modules = import.meta.glob('./messages/*.js');
await Promise.all(
	Object.keys(modules).map((path) => loadNamespace(path.split('/').pop().replace('.js', '')))
);
