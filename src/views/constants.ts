import { Status } from "../domain/models";

export function getBadgeClasses(status?: Status | string): string {
	switch (status) {
		case Status.Planned:
		case "Planned":
			return "bg-status-planned text-white border-status-planned";
		case Status.PrimaryFermentation:
		case "Primary Fermentation":
			return "bg-status-primary text-black border-status-primary";
		case Status.Aging:
		case "Aging":
		case "Aging (Modning)":
			return "bg-status-aging text-white border-status-aging";
		case Status.Bottled:
		case "Bottled":
			return "bg-status-bottled text-white border-status-bottled";
		default:
			return "badge-neutral";
	}
}

export function getEventIcon(type: string): string {
	switch (type) {
		case "sg_reading":
			return '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6" style="color: var(--color-honey)"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>';
		case "ph_reading":
			return '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6" style="color: var(--color-apothecary-teal)"><path stroke-linecap="round" stroke-linejoin="round" d="M15 3.75l5.25 5.25M16.5 2.25a2.121 2.121 0 013 3L6.75 18H3v-3.75L15.75 2.25zM10.5 10.5l3 3" /></svg>';
		case "addition":
			return '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6" style="color: var(--color-addition-blue, #3b82f6)"><path stroke-linecap="round" stroke-linejoin="round" d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-8c-.5 4-2 6.5-4 8s-3 3.5-3 5.5a7 7 0 0 0 7 7z" /></svg>';
		case "racking":
			return '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6" style="color: var(--color-apothecary-teal, #3E7B7D)"><path stroke-linecap="round" stroke-linejoin="round" d="M1.5 14.5h8.5v6.5h12.5M4 5.5h3.5M4.5 5.5V7c-1.2 1-2 2-2 3.8 0 1.8 1.1 2.7 2.7 2.7h1c1.6 0 2.7-.9 2.7-2.7 0-1.8-.8-2.8-2-3.8V5.5M16 12h3.5M16.5 12v1.5c-1.2 1-2 2-2 3.8 0 1.8 1.1 2.7 2.7 2.7h1c1.6 0 2.7-.9 2.7-2.7 0-1.8-.8-2.8-2-3.8V12M5.8 12V4.5C5.8 2.8 8.2 2.8 8.5 4.5C9.2 8 13.5 11 17.5 12.5V18.5" /></svg>';
		case "bottling":
			return '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6" style="color: var(--color-status-bottled)"><path stroke-linecap="round" stroke-linejoin="round" d="M5.5 3h3M6 3v4c0 1.5-2 2.5-2 4v9q0 1 1 1h4q1 0 1-1v-9c0-1.5-2-2.5-2-4V3zM15.5 3h3M16 3v4c0 1.5-2 2.5-2 4v9q0 1 1 1h4q1 0 1-1v-9c0-1.5-2-2.5-2-4V3z" /></svg>';
		case "comment":
			return '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6" style="color: var(--color-pollen)"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>';
		default:
			return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-6 h-6 text-neutral"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" /></svg>';
	}
}

export const EVENT_ANNOTATION_CONFIG: Record<
	string,
	{ label: string; color: string }
> = {
	ph_reading: { label: "pH-måling", color: "#3E7B7D" }, // Apothecary Teal
	addition: { label: "Tilsetning", color: "#F4C430" }, // Ferment Gold
	racking: { label: "Omstikking", color: "#3E7B7D" }, // Apothecary Teal
	bottling: { label: "Flasket", color: "#4E795B" }, // Botanical Sage
};

export const DEFAULT_ANNOTATION_COLOR = "#8A8377"; // Planned / Neutral

export const PANTRY_CATEGORIES = [
	"Honning og sukker",
	"Gjær og kulturer",
	"Gjærnæring og tilsetninger",
	"Frukt, bær og krydder",
] as const;
