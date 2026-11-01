// Modified 2026 by realfulvio; original attribution in NOTICE.
import { t } from '$lib/i18n/i18n.svelte.js';
import { formatLocalDate, formatValue, mapLinks } from './format.js';
export { readImageMetadata, webpToJpegSegments, EXIFR_OPTIONS } from './image-reader.js';

/** exifr segment keys with a readable name; XMP namespaces fall back to "XMP (<prefix>)". */
const NAMED_SEGMENTS = new Set(['ifd0', 'exif', 'gps', 'interop', 'iptc', 'icc', 'jfif', 'ihdr']);

/**
 * Readable name of an exifr segment, in the current language.
 * @param {string} key
 */
export function segmentLabel(key) {
	return NAMED_SEGMENTS.has(key)
		? t(`metadata.segment.${key}`)
		: t('metadata.segment.xmp', { prefix: key });
}

/**
 * Reads the first non-empty value among `keys` in the given segments.
 * @param {Record<string, Record<string, unknown>>} segments
 * @param {[string, string][]} keys [segment, tag] pairs
 */
function pick(segments, keys) {
	for (const [segment, tag] of keys) {
		const value = segments[segment]?.[tag];
		if (value !== undefined && value !== null && value !== '') return value;
	}
	return undefined;
}

/**
 * Extracts decimal GPS coordinates, or null when missing or invalid.
 * exifr adds `latitude`/`longitude` to the gps segment when GPSLatitude/Ref are present.
 * @param {Record<string, Record<string, unknown>>} segments
 */
export function extractGps(segments) {
	const gps = segments.gps;
	if (!gps) return null;
	const latitude = Number(gps.latitude);
	const longitude = Number(gps.longitude);
	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
	if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
	// Many phones write 0,0 when they have no fix.
	if (latitude === 0 && longitude === 0) return null;

	let altitude = null;
	if (typeof gps.GPSAltitude === 'number' && Number.isFinite(gps.GPSAltitude)) {
		const below = gps.GPSAltitudeRef === 1 || /below/i.test(String(gps.GPSAltitudeRef ?? ''));
		altitude = below ? -gps.GPSAltitude : gps.GPSAltitude;
	}
	return { latitude, longitude, altitude };
}

/**
 * @param {unknown} value
 */
function display(value) {
	if (value === undefined) return '';
	if (value instanceof Date) return formatLocalDate(value);
	return formatValue(value);
}

/**
 * The most useful fields for an investigation, as KeyValueTable rows.
 * @param {Record<string, Record<string, unknown>>} segments
 * @returns {{ label: string, value: string, href?: string }[]}
 */
export function imageHighlights(segments) {
	const make = display(pick(segments, [['ifd0', 'Make']]));
	const model = display(pick(segments, [['ifd0', 'Model']]));
	const camera = model.toLowerCase().startsWith(make.toLowerCase())
		? model
		: [make, model].filter(Boolean).join(' ');

	const width = pick(segments, [
		['exif', 'ExifImageWidth'],
		['ifd0', 'ImageWidth'],
		['ihdr', 'ImageWidth']
	]);
	const height = pick(segments, [
		['exif', 'ExifImageHeight'],
		['ifd0', 'ImageHeight'],
		['ihdr', 'ImageHeight']
	]);

	const offset = display(
		pick(segments, [
			['exif', 'OffsetTimeOriginal'],
			['exif', 'OffsetTime']
		])
	);
	const original = display(
		pick(segments, [
			['exif', 'DateTimeOriginal'],
			['exif', 'CreateDate'],
			['exif', 'DateTimeDigitized'],
			['xmp', 'CreateDate'],
			['photoshop', 'DateCreated']
		])
	);

	const rows = [
		{ label: t('metadata.image.camera'), value: camera },
		{
			label: t('metadata.image.lens'),
			value: display(
				pick(segments, [
					['exif', 'LensModel'],
					['exif', 'LensMake'],
					['aux', 'Lens']
				])
			)
		},
		{
			label: t('metadata.image.serial'),
			value: display(
				pick(segments, [
					['exif', 'BodySerialNumber'],
					['aux', 'SerialNumber']
				])
			)
		},
		{
			label: t('metadata.image.software'),
			value: display(
				pick(segments, [
					['ifd0', 'Software'],
					['xmp', 'CreatorTool']
				])
			)
		},
		{
			label: t('metadata.image.originalDate'),
			value: original && offset ? `${original} ${offset}` : original
		},
		{
			label: t('metadata.image.modifiedDate'),
			value: display(
				pick(segments, [
					['ifd0', 'ModifyDate'],
					['xmp', 'ModifyDate']
				])
			)
		},
		{
			label: t('metadata.image.dimensions'),
			value: width && height ? `${width} × ${height} px` : ''
		},
		{
			label: t('metadata.image.author'),
			value: display(
				pick(segments, [
					['ifd0', 'Artist'],
					['dc', 'creator'],
					['iptc', 'Byline'],
					['ifd0', 'XPAuthor']
				])
			)
		},
		{
			label: t('metadata.image.copyright'),
			value: display(
				pick(segments, [
					['ifd0', 'Copyright'],
					['dc', 'rights'],
					['iptc', 'CopyrightNotice']
				])
			)
		},
		{
			label: t('metadata.image.description'),
			value: display(
				pick(segments, [
					['ifd0', 'ImageDescription'],
					['dc', 'description'],
					['iptc', 'Caption'],
					['exif', 'UserComment']
				])
			)
		},
		{
			label: t('metadata.image.owner'),
			value: display(pick(segments, [['exif', 'CameraOwnerName']]))
		}
	];

	const gps = extractGps(segments);
	if (gps) {
		const links = mapLinks(gps.latitude, gps.longitude);
		const coords = `${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}`;
		rows.push(
			{ label: t('metadata.image.gpsCoordinates'), value: coords },
			{
				label: t('metadata.image.gpsAltitude'),
				value: gps.altitude === null ? '' : `${Number(gps.altitude.toFixed(1))} m`
			},
			{ label: 'OpenStreetMap', value: t('metadata.image.openMap'), href: links.osm },
			{ label: 'Google Maps', value: t('metadata.image.openMap'), href: links.google }
		);
	}
	return rows.filter((row) => row.value);
}

/**
 * Every tag grouped by segment, for the full table.
 * @param {Record<string, Record<string, unknown>>} segments
 * @returns {{ id: string, label: string, rows: { label: string, value: string }[] }[]}
 */
export function imageTagGroups(segments) {
	return Object.entries(segments)
		.filter(([, tags]) => tags && typeof tags === 'object')
		.map(([id, tags]) => ({
			id,
			label: segmentLabel(id),
			rows: Object.entries(tags)
				.map(([label, value]) => ({ label, value: display(value) }))
				.filter((row) => row.value)
		}))
		.filter((group) => group.rows.length);
}
