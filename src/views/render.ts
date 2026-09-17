import fs from "node:fs";
import path from "node:path";
import ejs from "ejs";
import { PANTRY_CATEGORIES, getBadgeClasses, getEventIcon } from "./constants";
import {
	formatAbv,
	formatAge,
	formatCost,
	formatDateForDisplay,
	formatInventoryQuantity,
	formatQuantity,
	formatSg,
	formatTimelineDate,
	formatTimelineDay,
	formatUnitPrice,
} from "./formatters";

export const TEMPLATES_DIR = path.resolve(import.meta.dir, "../../templates");

const DEFAULT_HELPERS = {
	formatDateForDisplay,
	formatTimelineDate,
	formatTimelineDay,
	formatAge,
	formatSg,
	formatAbv,
	formatQuantity,
	formatInventoryQuantity,
	formatUnitPrice,
	formatCost,
	PANTRY_CATEGORIES,
	getBadgeClasses,
	getEventIcon,
};

/**
 * Resolves full template file path from relative template path.
 * Adds .ejs extension if not provided.
 */
export function resolveTemplatePath(relPath: string): string {
	const normalized = relPath.endsWith(".ejs") ? relPath : `${relPath}.ejs`;
	return path.resolve(TEMPLATES_DIR, normalized);
}

/**
 * Renders an EJS template with shared helpers and passed data.
 */
export function renderTemplate(
	templateRelPath: string,
	data: Record<string, any> = {},
): string {
	const fullPath = resolveTemplatePath(templateRelPath);
	const templateStr = fs.readFileSync(fullPath, "utf-8");

	const locals = {
		...DEFAULT_HELPERS,
		...data,
	};

	return ejs.render(templateStr, locals, {
		root: TEMPLATES_DIR,
		filename: fullPath,
	});
}

/**
 * Renders a view.
 * If isHtmx is true, renders only the inner template.
 * If isHtmx is false, wraps the rendered inner template in layout/base.ejs.
 */
export function renderView(
	templateRelPath: string,
	data: Record<string, any> = {},
	isHtmx: boolean = false,
): string {
	const body = renderTemplate(templateRelPath, data);
	if (isHtmx) {
		return body;
	}

	return renderTemplate("layout/base", {
		...data,
		body,
	});
}
