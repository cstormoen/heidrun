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
		expect(html).toContain("Your Batches");
	});

	it("serves the home dashboard (HTMX partial)", async () => {
		const res = await fetch("http://localhost:3000/", {
			headers: { "HX-Request": "true" },
		});
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).not.toContain("<!DOCTYPE html>");
		expect(html).toContain("Your Batches");
	});

	it("serves pantry view", async () => {
		const res = await fetch("http://localhost:3000/pantry");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Pantry Inventory");
	});

	it("serves new batch form", async () => {
		const res = await fetch("http://localhost:3000/sessions/new");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Start New Batch");
		expect(html).toContain("Recipe / Foundation");
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
		const html = await postRes.text();

		expect(html).toContain("pH Reading");
		expect(html).toContain("pH 3.62");
		expect(html).toContain("Test Must pH Integration");
		expect(html).toContain("Current pH");

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
});
