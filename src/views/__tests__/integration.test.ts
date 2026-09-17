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
});
