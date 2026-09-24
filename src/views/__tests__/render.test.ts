import { describe, expect, it } from "bun:test";
import { renderTemplate, renderView, resolveTemplatePath } from "../render";

describe("render module", () => {
	it("resolves template path correctly", () => {
		const p1 = resolveTemplatePath("layout/base");
		expect(p1).toEndWith("templates/layout/base.ejs");

		const p2 = resolveTemplatePath("layout/base.ejs");
		expect(p2).toEndWith("templates/layout/base.ejs");
	});

	it("renders an EJS template with shared helpers injected", () => {
		const html = renderTemplate("sessions/list", { sessions: [] });
		expect(html).toContain("Dine brygg");
		expect(html).toContain("Ingen brygg ennå");
		expect(html).not.toContain("<!DOCTYPE html>");
	});

	it("renders a view with isHtmx = false wrapped in base layout", () => {
		const html = renderView("sessions/list", { sessions: [] }, false);
		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("<title>Heidrun</title>");
		expect(html).toContain("Dine brygg");
	});

	it("renders a view with isHtmx = true without base layout wrapper", () => {
		const html = renderView("sessions/list", { sessions: [] }, true);
		expect(html).not.toContain("<!DOCTYPE html>");
		expect(html).toContain("Dine brygg");
	});

	it("returns blue drop icon for addition events", () => {
		const { getEventIcon } = require("../constants");
		const icon = getEventIcon("addition");
		expect(icon).toContain("color-addition-blue");
		expect(icon).toContain("M12 22a7 7 0 0 0 7-7");
	});
});

