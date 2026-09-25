export function formatDateForDisplay(
	dateStr?: string | Date | null,
): string {
	if (!dateStr) return "";
	const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
	if (isNaN(d.getTime())) return "";
	const dd = String(d.getDate()).padStart(2, "0");
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const yyyy = d.getFullYear();
	return `${dd}.${mm}.${yyyy}`;
}

export function formatDateTimeForDisplay(
	dateStr?: string | Date | null,
): string {
	if (!dateStr) return "";
	const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
	if (isNaN(d.getTime())) return "";
	const dd = String(d.getDate()).padStart(2, "0");
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const yyyy = d.getFullYear();
	const hh = String(d.getHours()).padStart(2, "0");
	const min = String(d.getMinutes()).padStart(2, "0");
	return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

export function formatForDateTimeLocal(
	dateStr?: string | Date | null,
): string {
	if (!dateStr) return "";
	const clean =
		typeof dateStr === "string" ? dateStr.trim().replace(" ", "T") : dateStr;
	const d = typeof clean === "string" ? new Date(clean) : clean;
	if (isNaN(d.getTime())) return "";
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	const hh = String(d.getHours()).padStart(2, "0");
	const min = String(d.getMinutes()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function formatTimelineDate(dateStr?: string | Date | null): string {
	if (!dateStr) return "";
	const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
	if (isNaN(d.getTime())) return "";
	return d
		.toLocaleDateString("no-NO", {
			day: "numeric",
			month: "short",
			year: "numeric",
		})
		.toLowerCase();
}

export function formatTimelineDay(
	dateStr?: string | Date | null,
	startDateStr?: string | Date | null,
): string {
	if (!dateStr) return "";
	const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
	if (isNaN(d.getTime())) return "";

	if (!startDateStr) return "Dag 1";
	const start =
		typeof startDateStr === "string" ? new Date(startDateStr) : startDateStr;
	if (isNaN(start.getTime())) return "Dag 1";

	const startDay = new Date(
		start.getFullYear(),
		start.getMonth(),
		start.getDate(),
	);
	const currentDay = new Date(
		d.getFullYear(),
		d.getMonth(),
		d.getDate(),
	);
	const diffDays = Math.round(
		(currentDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24),
	);
	const dayNumber = Math.max(1, diffDays + 1);

	return `Dag ${dayNumber}`;
}

export function formatAge(ageMs: number): string {
	if (ageMs <= 0) return "0 timer";

	const MS_IN_HOUR = 1000 * 60 * 60;
	const MS_IN_DAY = MS_IN_HOUR * 24;
	const MS_IN_MONTH = MS_IN_DAY * 30.44;
	const MS_IN_YEAR = MS_IN_DAY * 365.25;

	const years = Math.floor(ageMs / MS_IN_YEAR);
	const months = Math.floor((ageMs % MS_IN_YEAR) / MS_IN_MONTH);
	const days = Math.floor((ageMs % MS_IN_MONTH) / MS_IN_DAY);
	const hours = Math.floor((ageMs % MS_IN_DAY) / MS_IN_HOUR);

	const parts: string[] = [];

	if (years > 0) {
		parts.push(`${years} år`);
		if (months > 0) {
			parts.push(`${months} måned${months !== 1 ? "er" : ""}`);
		}
	} else if (months > 0) {
		parts.push(`${months} måned${months !== 1 ? "er" : ""}`);
		if (days > 0) {
			parts.push(`${days} dag${days !== 1 ? "er" : ""}`);
		}
	} else if (days > 0) {
		parts.push(`${days} dag${days !== 1 ? "er" : ""}`);
		if (hours > 0) {
			parts.push(`${hours} time${hours !== 1 ? "r" : ""}`);
		}
	} else {
		parts.push(`${hours} time${hours !== 1 ? "r" : ""}`);
	}

	return parts.join(", ");
}

export function formatSg(value?: number | null): string {
	if (value === undefined || value === null || isNaN(value)) return "---";
	return value.toFixed(3);
}

export function formatPh(value?: number | null): string {
	if (value === undefined || value === null || isNaN(value)) return "---";
	return value.toFixed(2);
}

export function formatAbv(value?: number | null): string {
	if (value === undefined || value === null || isNaN(value)) return "0%";
	return `${value}%`;
}

export function formatQuantity(value: number): string {
	if (Number.isInteger(value)) return value.toString();
	return parseFloat(value.toFixed(3)).toString();
}

export function formatInventoryQuantity(value: number): string {
	return value.toFixed(2).replace(/\.00$/, "");
}

export function formatUnitPrice(
	costPerUnit?: number | null,
	currency = "NOK",
	unit = "",
): string {
	if (costPerUnit === undefined || costPerUnit === null) return "Ingen prisdata";
	return `${costPerUnit} ${currency} / ${unit}`;
}

export function formatCost(cost: number, currency = "NOK"): string {
	return `${cost.toFixed(2)} ${currency}`;
}
