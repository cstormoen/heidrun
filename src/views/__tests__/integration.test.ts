import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { Subprocess } from "bun";

const TEST_PORT = process.env.TEST_PORT || "3001";
const BASE_URL = `http://localhost:${TEST_PORT}`;

describe("HTTP server smoke integration", () => {
	let proc: Subprocess;
	let testSessionId: number = 1;

	beforeAll(async () => {
		proc = Bun.spawn(["bun", "run", "src/server.ts"], {
			stdout: "pipe",
			stderr: "pipe",
			env: { ...process.env, PORT: TEST_PORT, DB_PATH: process.env.DB_PATH || "test-mjod.sqlite" },
		});

		// Wait until server is listening on TEST_PORT
		for (let i = 0; i < 30; i++) {
			try {
				const res = await fetch(`${BASE_URL}/`);
				if (res.ok) break;
			} catch {
				await Bun.sleep(100);
			}
		}

		// Create a test session for pH and comment tests
		// First check if session 1 exists
		const session1Res = await fetch(`${BASE_URL}/sessions/1`);
		if (session1Res.ok) {
			testSessionId = 1;
		} else {
			// Create a new session
			const createSessionForm = new FormData();
			createSessionForm.append("name", "Test Integrasjon Brygg");
			
			const sessionPostRes = await fetch(`${BASE_URL}/sessions`, {
				method: "POST",
				body: createSessionForm,
				headers: { "HX-Request": "true" },
			});
			if (sessionPostRes.ok) {
				// Get the session list and find our session
				const sessionsRes = await fetch(`${BASE_URL}/sessions`);
				const sessionsHtml = await sessionsRes.text();
				const match = sessionsHtml.match(/href="\/sessions\/(d+)">Test Integrasjon Brygg/);
				if (match) {
					testSessionId = parseInt(match[1]);
				} else {
					testSessionId = 1; // fallback
				}
			} else {
				testSessionId = 1; // fallback
			}
		}
	});

	afterAll(() => {
		if (proc) {
			proc.kill();
		}
	});

	it("serves the home dashboard (full page)", async () => {
		const res = await fetch(`${BASE_URL}/`);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("Heidrun");
		expect(html).toContain("Dine brygg");
	});

	it("serves the home dashboard (HTMX partial)", async () => {
		const res = await fetch(`${BASE_URL}/`, {
			headers: { "HX-Request": "true" },
		});
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).not.toContain("<!DOCTYPE html>");
		expect(html).toContain("Dine brygg");
	});

	it("serves pantry view", async () => {
		const res = await fetch(`${BASE_URL}/pantry`);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Stabbur");
	});

	it("serves recipes view with standardoppskrifter and navigation link", async () => {
		const res = await fetch(`${BASE_URL}/oppskrifter`);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Oppskrifter");
		expect(html).toContain("Standardoppskrifter");
		expect(html).toContain("Mine oppskrifter");
		expect(html).toContain("Ny oppskrift");
		expect(html).toContain('href="/oppskrifter"');
	});

	it("supports creating, editing, and deleting a custom recipe", async () => {
		// 1. Create recipe
		const createForm = new FormData();
		createForm.append("name", "Integrasjonstest Kryddermjød");
		createForm.append("target_sg", "1.108");
		createForm.append("description", "Ingefær og stjerneanis");

		const postRes = await fetch(`${BASE_URL}/oppskrifter`, {
			method: "POST",
			body: createForm,
			headers: { "HX-Request": "true" },
		});
		expect(postRes.status).toBe(200);
		let html = await postRes.text();
		expect(html).toContain("Integrasjonstest Kryddermjød");
		expect(html).toContain("1.108");
		expect(html).toContain("Ingefær og stjerneanis");

		// Extract recipe id from the edit button JSON
		const idMatch = html.match(
			/"id":(\d+)[^}]*"name":"Integrasjonstest Kryddermjød"/,
		);
		expect(idMatch).not.toBeNull();
		const recipeId = idMatch![1];

		// 2. Pre-select in /sessions/new
		const newSessionRes = await fetch(
			`${BASE_URL}/sessions/new?recipe_id=${recipeId}`,
		);
		expect(newSessionRes.status).toBe(200);
		const sessionFormHtml = await newSessionRes.text();
		expect(sessionFormHtml).toContain(
			`value="${recipeId}" data-desc="Ingefær og stjerneanis" selected`,
		);

		// 3. Edit recipe
		const editForm = new FormData();
		editForm.append("id", recipeId);
		editForm.append("name", "Oppdatert Kryddermjød");
		editForm.append("target_sg", "1.112");
		editForm.append("description", "Mer ingefær");

		const editRes = await fetch(`${BASE_URL}/oppskrifter/edit`, {
			method: "POST",
			body: editForm,
			headers: { "HX-Request": "true" },
		});
		expect(editRes.status).toBe(200);
		html = await editRes.text();
		expect(html).toContain("Oppdatert Kryddermjød");
		expect(html).toContain("1.112");

		// 4. Delete recipe
		const deleteRes = await fetch(
			`${BASE_URL}/oppskrifter/${recipeId}`,
			{
				method: "DELETE",
				headers: { "HX-Request": "true" },
			},
		);
		expect(deleteRes.status).toBe(200);
		html = await deleteRes.text();
		expect(html).not.toContain("Oppdatert Kryddermjød");
	});

	it("serves new batch form", async () => {
		const res = await fetch(`${BASE_URL}/sessions/new`);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Start nytt brygg");
		expect(html).toContain("Oppskrift / Grunnoppskrift");
	});

	it("serves static assets", async () => {
		const cssRes = await fetch(`${BASE_URL}/output.css`);
		expect(cssRes.status).toBe(200);

		const jsRes = await fetch(`${BASE_URL}/htmx.js`);
		expect(jsRes.status).toBe(200);
	});

	it("logs and displays a pH reading event", async () => {
		const formData = new FormData();
		formData.append("type", "ph_reading");
		formData.append("timestamp", "2026-09-18T10:00");
		formData.append("ph", "3.62");
		formData.append("note", "Test Must pH Integration");

		const postRes = await fetch(`${BASE_URL}/sessions/${testSessionId}/events`, {
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
		const match = html.match(/\/sessions\/\d+\/events\/(\d+)/);
		if (match) {
			const eventId = match[1];
			const delRes = await fetch(`${BASE_URL}/sessions/${testSessionId}/events/${eventId}`, {
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

		const emptyRes = await fetch(`${BASE_URL}/sessions/${testSessionId}/events`, {
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

		const postRes = await fetch(`${BASE_URL}/sessions/${testSessionId}/events`, {
			method: "POST",
			body: formData,
			headers: { "HX-Request": "true" },
		});
		expect(postRes.status).toBe(200);
		const html = await postRes.text();

		expect(html).toContain("Degassed mead and noted gentle wildflower aroma");

		// Find the event ID to edit
		const matches = [...html.matchAll(/\/sessions\/\d+\/events\/(\d+)/g)];
		expect(matches.length).toBeGreaterThan(0);
		const eventId = matches[0][1];

		// Edit the comment
		const editForm = new FormData();
		editForm.append("id", eventId);
		editForm.append("type", "comment");
		editForm.append("timestamp", "2026-09-18T13:00");
		editForm.append("note", "Updated: Degassed thoroughly, clarity improving");

		const editRes = await fetch(`${BASE_URL}/sessions/${testSessionId}/events/edit`, {
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
		const delRes = await fetch(`${BASE_URL}/sessions/${testSessionId}/events/${eventId}`, {
			method: "DELETE",
			headers: { "HX-Request": "true" },
		});
		expect(delRes.status).toBe(200);
	});

	it("supports creating and deleting a session", async () => {
		const sessionName = `Slettbart Brygg ${Date.now()}`;
		// 1. Create a session
		const form = new FormData();
		form.append("name", sessionName);
		form.append("recipe_id", "1");

		const createRes = await fetch(`${BASE_URL}/sessions`, {
			method: "POST",
			body: form,
			headers: { "HX-Request": "true" },
		});
		expect(createRes.status).toBe(200);
		const listWithCreated = await createRes.text();
		expect(listWithCreated).toContain(sessionName);

		// Extract session id from list card hx-get
		const match = listWithCreated.match(
			new RegExp(`hx-get="\\/sessions\\/(\\d+)"[^>]*>[\\s\\S]*?${sessionName}`),
		);
		expect(match).not.toBeNull();
		const createdSessionId = match![1];

		// 2. Fetch detail view for the session
		const detailRes = await fetch(`${BASE_URL}/sessions/${createdSessionId}`, {
			headers: { "HX-Request": "true" },
		});
		expect(detailRes.status).toBe(200);
		const detailHtml = await detailRes.text();

		// Verify delete button is present in the rendered modal
		expect(detailHtml).toContain(`hx-delete="/sessions/${createdSessionId}"`);
		expect(detailHtml).toContain("Slett");

		// 3. Delete the session
		const deleteRes = await fetch(`${BASE_URL}/sessions/${createdSessionId}`, {
			method: "DELETE",
			headers: { "HX-Request": "true" },
		});
		expect(deleteRes.status).toBe(200);
		expect(deleteRes.headers.get("HX-Push-Url")).toBe("/");
		const listHtml = await deleteRes.text();
		expect(listHtml).not.toContain(sessionName);
	});
});

