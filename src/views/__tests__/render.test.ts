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

	it("returns two demijohns and siphon hose icon for racking events", () => {
		const { getEventIcon } = require("../constants");
		const icon = getEventIcon("racking");
		expect(icon).toContain("color-apothecary-teal");
		expect(icon).toContain("#3E7B7D");
		expect(icon).toContain("M5.8 12V4.5C5.8 2.8 8.2 2.8 8.5 4.5");
	});

	it("returns two bottles icon for bottling events", () => {
		const { getEventIcon } = require("../constants");
		const icon = getEventIcon("bottling");
		expect(icon).toContain("color-status-bottled");
		expect(icon).toContain("M5.5 3h3");
		expect(icon).toContain("M15.5 3h3");
	});
});

