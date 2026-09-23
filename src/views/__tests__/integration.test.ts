import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { Subprocess } from "bun";

describe("HTTP server smoke integration", () => {
	let proc: Subprocess;

	beforeAll(async () => {
		proc = Bun.spawn(["bun", "run", "src/server.ts"], {
			stdout: "pipe",
			stderr: "pipe",
			env: { ...process.env, PORT: "3001" }, // fallback if needed
		});

		// Wait until server is listening on port 3000
		for (let i = 0; i < 30; i++) {
			try {
				const res = await fetch("http://localhost:3000/");
				if (res.ok) break;
			} catch {
				await Bun.sleep(100);
			}
		}
	});

	afterAll(() => {
		if (proc) {
			proc.kill();
		}
	});

	it("serves the home dashboard (full page)", async () => {
		const res = await fetch("http://localhost:3000/");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("Heidrun");
		expect(html).toContain("Dine brygg");
	});

	it("serves the home dashboard (HTMX partial)", async () => {
		const res = await fetch("http://localhost:3000/", {
			headers: { "HX-Request": "true" },
		});
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).not.toContain("<!DOCTYPE html>");
		expect(html).toContain("Dine brygg");
	});

	it("serves pantry view", async () => {
		const res = await fetch("http://localhost:3000/pantry");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Stabbur");
	});

	it("serves new batch form", async () => {
		const res = await fetch("http://localhost:3000/sessions/new");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Start nytt brygg");
		expect(html).toContain("Oppskrift / Grunnoppskrift");
	});

	it("serves static assets", async () => {
		const cssRes = await fetch("http://localhost:3000/output.css");
		expect(cssRes.status).toBe(200);

		const jsRes = await fetch("http://localhost:3000/htmx.js");
		expect(jsRes.status).toBe(200);
	});

	it("logs and displays a pH reading event", async () => {
		const formData = new FormData();
		formData.append("type", "ph_reading");
		formData.append("timestamp", "2026-09-18T10:00");
		formData.append("ph", "3.62");
		formData.append("note", "Test Must pH Integration");

		const postRes = await fetch("http://localhost:3000/sessions/1/events", {
			method: "POST",
			body: formData,
			headers: { "HX-Request": "true" },
		});
		expect(postRes.status).toBe(200);
		expect(postRes.headers.get("HX-Reswap")).toBe(
			"innerHTML show:#event-history-title:top focus-scroll:false",
		);
		const html = await postRes.text();

		expect(html).toContain('id="event-history-title"');
		expect(html).toContain("pH-måling");
		expect(html).toContain("pH 3.62");
		expect(html).toContain("Test Must pH Integration");
		expect(html).toContain("Nåværende pH");

		// Clean up by extracting event ID and deleting it
		const match = html.match(/\/sessions\/1\/events\/(\d+)/);
		if (match) {
			const eventId = match[1];
			const delRes = await fetch(`http://localhost:3000/sessions/1/events/${eventId}`, {
				method: "DELETE",
				headers: { "HX-Request": "true" },
			});
			expect(delRes.status).toBe(200);
		}
	});

	it("logs, displays, edits, and validates a comment event", async () => {
		// Attempting empty note comment should not log
		const emptyForm = new FormData();
		emptyForm.append("type", "comment");
		emptyForm.append("timestamp", "2026-09-18T12:00");
		emptyForm.append("note", "");

		const emptyRes = await fetch("http://localhost:3000/sessions/1/events", {
			method: "POST",
			body: emptyForm,
			headers: { "HX-Request": "true" },
		});
		expect(emptyRes.status).toBe(200);

		// Valid comment
		const formData = new FormData();
		formData.append("type", "comment");
		formData.append("timestamp", "2026-09-18T12:30");
		formData.append("note", "Degassed mead and noted gentle wildflower aroma");

		const postRes = await fetch("http://localhost:3000/sessions/1/events", {
			method: "POST",
			body: formData,
			headers: { "HX-Request": "true" },
		});
		expect(postRes.status).toBe(200);
		const html = await postRes.text();

		expect(html).toContain("Degassed mead and noted gentle wildflower aroma");

		// Find the event ID to edit
		const matches = [...html.matchAll(/\/sessions\/1\/events\/(\d+)/g)];
		expect(matches.length).toBeGreaterThan(0);
		const eventId = matches[0][1];

		// Edit the comment
		const editForm = new FormData();
		editForm.append("id", eventId);
		editForm.append("type", "comment");
		editForm.append("timestamp", "2026-09-18T13:00");
		editForm.append("note", "Updated: Degassed thoroughly, clarity improving");

		const editRes = await fetch("http://localhost:3000/sessions/1/events/edit", {
			method: "POST",
			body: editForm,
			headers: { "HX-Request": "true" },
		});
		expect(editRes.status).toBe(200);
		expect(editRes.headers.get("HX-Reswap")).toBe(
			"innerHTML show:#event-history-title:top focus-scroll:false",
		);
		const editHtml = await editRes.text();
		expect(editHtml).toContain("Updated: Degassed thoroughly, clarity improving");

		// Clean up
		const delRes = await fetch(`http://localhost:3000/sessions/1/events/${eventId}`, {
			method: "DELETE",
			headers: { "HX-Request": "true" },
		});
		expect(delRes.status).toBe(200);
	});
});
