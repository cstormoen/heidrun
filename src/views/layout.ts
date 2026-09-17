import { renderTemplate } from "./render";

/**
 * Wraps content in the base HTML layout.
 */
export function renderBaseLayout(content: string): string {
	return renderTemplate("layout/base", { body: content });
}
