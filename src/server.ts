import { serve } from "bun";
import { DAL } from "./db/dal";
import { convertUnits, deriveSessionState } from "./domain/models";
import {
	renderBaseLayout,
	renderNewSessionForm,
	renderPantryView,
	renderSessionDetail,
	renderSessionList,
} from "./views";

function htmlResponse(
	content: string,
	isHtmx: boolean,
	options: { pushUrl?: string; status?: number } = {},
): Response {
	const status = options.status || 200;
	const headers: Record<string, string> = {
		"Content-Type": "text/html",
	};
	if (options.pushUrl) {
		headers["HX-Push-Url"] = options.pushUrl;
	}

	const body = isHtmx ? content : renderBaseLayout(content);
	return new Response(body, { status, headers });
}

function renderSessionDetailView(sessionId: number): string {
	const session = DAL.getSessionById(sessionId);
	if (!session) {
		return '<div class="alert alert-error">Session not found</div>';
	}
	const events = DAL.getEventsForSession(sessionId);
	const inventoryList = DAL.getInventoryItems();
	return renderSessionDetail(session, events, inventoryList);
}

function sanitizeUrl(rawUrl?: string | null): string | undefined {
	if (!rawUrl) return undefined;
	let url = rawUrl.trim();
	if (!url) return undefined;
	if (!/^https?:\/\//i.test(url)) {
		url = `https://${url}`;
	}
	try {
		new URL(url);
		return url;
	} catch {
		return undefined;
	}
}

function parseTimestamp(raw?: string | null): string | undefined {
	if (!raw) return undefined;
	const date = new Date(raw);
	return isNaN(date.getTime()) ? undefined : date.toISOString();
}

serve({
	port: 3000,
	async fetch(req) {
		const url = new URL(req.url);
		const isHtmx = req.headers.get("HX-Request") === "true";

		// Static assets
		if (url.pathname === "/htmx.js") {
			return new Response(Bun.file("node_modules/htmx.org/dist/htmx.min.js"));
		}
		if (url.pathname === "/output.css") {
			return new Response(Bun.file("public/output.css"));
		}
		if (url.pathname === "/heidrun.jpeg") {
			return new Response(Bun.file("public/heidrun.jpeg"));
		}

		// Sessions: List dashboard
		if (
			req.method === "GET" &&
			(url.pathname === "/" || url.pathname === "/index.html")
		) {
			const rawSessions = DAL.getSessions();
			const inventoryList = DAL.getInventoryItems();
			const sessions = rawSessions.map((s) => {
				const events = DAL.getEventsForSession(s.id);
				return deriveSessionState(s, events, inventoryList);
			});
			const content = renderSessionList(sessions);
			return htmlResponse(content, isHtmx);
		}

		// Pantry: View inventory
		if (req.method === "GET" && url.pathname === "/pantry") {
			const items = DAL.getInventoryItems();
			const content = renderPantryView(items);
			return htmlResponse(content, isHtmx);
		}

		// Pantry: Add inventory item
		if (req.method === "POST" && url.pathname === "/pantry") {
			const formData = await req.formData();
			const name = formData.get("name") as string;
			const category = formData.get("category") as any;
			const quantity = parseFloat(formData.get("quantity") as string);
			const unit = formData.get("unit") as string;
			const costStr = formData.get("cost") as string;
			const cost = costStr ? parseFloat(costStr) : undefined;
			const currency = (formData.get("currency") as string) || undefined;
			const itemUrl = sanitizeUrl(formData.get("url") as string);

			if (name && category && !isNaN(quantity) && unit) {
				DAL.addInventoryItem({
					name,
					category,
					quantity_on_hand: quantity,
					unit,
					cost_per_unit: cost,
					currency,
					url: itemUrl,
				});
			}

			const content = renderPantryView(DAL.getInventoryItems());
			return htmlResponse(content, true, { pushUrl: "/pantry" });
		}

		// Pantry: Edit inventory item
		if (req.method === "POST" && url.pathname === "/pantry/edit") {
			const formData = await req.formData();
			const idStr = formData.get("id") as string;
			const id = parseInt(idStr);

			const name = formData.get("name") as string;
			const category = formData.get("category") as any;
			const quantityStr = formData.get("quantity") as string;
			const quantity = quantityStr ? parseFloat(quantityStr) : undefined;
			const unit = formData.get("unit") as string;
			const costStr = formData.get("cost") as string;
			const cost = costStr ? parseFloat(costStr) : undefined;
			const currency = (formData.get("currency") as string) || undefined;
			const rawUrl = formData.get("url") as string;
			const itemUrl = rawUrl ? sanitizeUrl(rawUrl) : null;

			if (!isNaN(id)) {
				DAL.updateInventoryItem(id, {
					...(name && { name }),
					...(category && { category }),
					...(quantity !== undefined &&
						!isNaN(quantity) && { quantity_on_hand: quantity }),
					...(unit && { unit }),
					cost_per_unit: cost,
					currency,
					url: itemUrl === null ? "" : itemUrl,
				});
			}

			const content = renderPantryView(DAL.getInventoryItems());
			return htmlResponse(content, true, { pushUrl: "/pantry" });
		}

		// Pantry: Delete inventory item
		if (req.method === "DELETE" && url.pathname.match(/^\/pantry\/\d+$/)) {
			const idStr = url.pathname.split("/")[2];
			const id = parseInt(idStr);

			if (!isNaN(id)) {
				DAL.deleteInventoryItem(id);
			}

			const content = renderPantryView(DAL.getInventoryItems());
			return htmlResponse(content, true, { pushUrl: "/pantry" });
		}

		// Sessions: New session form
		if (req.method === "GET" && url.pathname === "/sessions/new") {
			const recipes = DAL.getRecipes();
			const content = renderNewSessionForm(recipes);
			return htmlResponse(content, isHtmx);
		}

		// Sessions: Create session
		if (req.method === "POST" && url.pathname === "/sessions") {
			const formData = await req.formData();
			const name = formData.get("name") as string;
			const recipeId = parseInt(formData.get("recipe_id") as string);

			if (name && !isNaN(recipeId)) {
				DAL.createSession(recipeId, name);
			}

			const rawSessions = DAL.getSessions();
			const sessions = rawSessions.map((s) =>
				deriveSessionState(s, DAL.getEventsForSession(s.id)),
			);
			const content = renderSessionList(sessions);
			return htmlResponse(content, true, { pushUrl: "/" });
		}

		// Sessions: Detail view
		if (req.method === "GET" && url.pathname.startsWith("/sessions/")) {
			const idStr = url.pathname.split("/")[2];
			const id = parseInt(idStr);
			if (!isNaN(id)) {
				const content = renderSessionDetailView(id);
				return htmlResponse(content, isHtmx);
			}
		}

		// Sessions: Edit batch name
		if (req.method === "POST" && url.pathname.match(/^\/sessions\/\d+\/name$/)) {
			const sessionId = parseInt(url.pathname.split("/")[2]);
			const formData = await req.formData();
			const name = formData.get("name") as string;

			if (!isNaN(sessionId) && name) {
				DAL.updateSessionName(sessionId, name);
			}

			const content = renderSessionDetailView(sessionId);
			return htmlResponse(content, true);
		}

		// Sessions: Add event
		if (
			req.method === "POST" &&
			url.pathname.match(/^\/sessions\/\d+\/events$/)
		) {
			const sessionId = parseInt(url.pathname.split("/")[2]);
			const formData = await req.formData();
			const type = formData.get("type") as string;
			const timestampRaw = formData.get("timestamp") as string;
			const note = (
				(formData.get("note") || formData.get("addition_note") || "") as string
			).trim();

			if (!isNaN(sessionId) && type) {
				let data: any = {};
				if (type === "sg_reading") {
					const sgStr = (formData.get("sg") || formData.get("data")) as string;
					const sg = parseFloat(sgStr);
					if (!isNaN(sg)) {
						data.sg = sg;
					}
					if (note && note !== sgStr) data.note = note;
				} else if (type === "ph_reading") {
					const phStr = (formData.get("ph") || formData.get("data")) as string;
					const ph = parseFloat(phStr);
					if (!isNaN(ph)) {
						data.ph = ph;
					}
					if (note && note !== phStr) data.note = note;
				} else if (type === "addition") {
					const invIdStr = formData.get("inventory_item_id") as string;
					const qtyStr = formData.get("quantity_used") as string;
					const unit = formData.get("unit") as string;
					const customName = formData.get("custom_ingredient") as string;

					if (invIdStr) {
						data = {
							inventory_item_id: parseInt(invIdStr),
							quantity_used: parseFloat(qtyStr) || 0,
							unit: unit,
						};
					} else {
						data = {
							ingredient: customName,
							quantity_used: parseFloat(qtyStr) || 0,
							unit: unit,
						};
					}
					if (note) data.note = note;
				} else if (type === "racking" || type === "bottling") {
					const legacyData = ((formData.get("data") || "") as string).trim();
					const finalNote = note || legacyData;
					if (finalNote) data.note = finalNote;
				}

				const timestampToUse = parseTimestamp(timestampRaw);
				DAL.addEvent(sessionId, type, data, timestampToUse);
			}

			const content = renderSessionDetailView(sessionId);
			return htmlResponse(content, true);
		}

		// Sessions: Link unlinked addition event to inventory
		if (
			req.method === "POST" &&
			url.pathname.match(/^\/sessions\/\d+\/events\/\d+\/link$/)
		) {
			const parts = url.pathname.split("/");
			const sessionId = parseInt(parts[2]);
			const eventId = parseInt(parts[4]);

			const formData = await req.formData();
			const invIdStr = formData.get("inventory_item_id") as string;
			const invId = parseInt(invIdStr);
			const qtyStr = formData.get("quantity") as string;
			const unit = formData.get("unit") as string;

			if (!isNaN(sessionId) && !isNaN(eventId) && !isNaN(invId)) {
				const event = DAL.getEventById(eventId);
				const invItem = DAL.getInventoryItemById(invId);
				if (event && event.type === "addition" && invItem) {
					const qty = parseFloat(qtyStr) || 0;

					const newData = { ...event.data };
					delete newData.ingredient;
					newData.inventory_item_id = invId;
					newData.quantity_used = qty;
					newData.unit = unit;
					DAL.updateEventData(eventId, newData);

					if (qty > 0) {
						const qtyToDeduct = convertUnits(qty, unit, invItem.unit);
						DAL.updateInventoryQuantity(invItem.id, -qtyToDeduct);
					}
				}
			}

			const content = renderSessionDetailView(sessionId);
			return htmlResponse(content, true);
		}

		// Sessions: Edit event
		if (
			req.method === "POST" &&
			url.pathname.match(/^\/sessions\/\d+\/events\/edit$/)
		) {
			const sessionId = parseInt(url.pathname.split("/")[2]);
			const formData = await req.formData();
			const eventId = parseInt(formData.get("id") as string);
			const type = formData.get("type") as string;
			const timestampRaw = formData.get("timestamp") as string;
			const note = (
				(formData.get("note") || formData.get("addition_note") || "") as string
			).trim();

			const timestampToUse = parseTimestamp(timestampRaw);

			if (!isNaN(sessionId) && !isNaN(eventId) && timestampToUse && type) {
				const event = DAL.getEventById(eventId);
				if (event) {
					let newData: any = {};
					if (type === "sg_reading") {
						const sgStr = (formData.get("sg") ||
							formData.get("data")) as string;
						const sg = parseFloat(sgStr);
						if (!isNaN(sg)) newData.sg = sg;
						if (note && note !== sgStr) newData.note = note;
					} else if (type === "ph_reading") {
						const phStr = (formData.get("ph") ||
							formData.get("data")) as string;
						const ph = parseFloat(phStr);
						if (!isNaN(ph)) newData.ph = ph;
						if (note && note !== phStr) newData.note = note;
					} else if (type === "racking" || type === "bottling") {
						const legacyData = ((formData.get("data") || "") as string).trim();
						const finalNote = note || legacyData;
						if (finalNote) newData.note = finalNote;
					} else if (type === "addition") {
						const invIdStr = formData.get("inventory_item_id") as string;
						const qtyStr = formData.get("quantity_used") as string;
						const unit = formData.get("unit") as string;
						const customName = formData.get("custom_ingredient") as string;

						if (invIdStr) {
							newData = {
								inventory_item_id: parseInt(invIdStr),
								quantity_used: parseFloat(qtyStr) || 0,
								unit: unit,
							};
						} else {
							newData = {
								ingredient: customName,
								quantity_used: parseFloat(qtyStr) || 0,
								unit: unit,
							};
						}
						if (note) newData.note = note;
					}
					DAL.updateEvent(eventId, newData, timestampToUse, type);
				}
			}

			const content = renderSessionDetailView(sessionId);
			return htmlResponse(content, true);
		}

		// Sessions: Delete event
		if (
			req.method === "DELETE" &&
			url.pathname.match(/^\/sessions\/\d+\/events\/\d+$/)
		) {
			const parts = url.pathname.split("/");
			const sessionId = parseInt(parts[2]);
			const eventId = parseInt(parts[4]);

			if (!isNaN(sessionId) && !isNaN(eventId)) {
				DAL.deleteEvent(eventId);
			}

			const content = renderSessionDetailView(sessionId);
			return htmlResponse(content, true);
		}

		return new Response("Not Found", { status: 404 });
	},
});

console.log("Server running on http://localhost:3000");
