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

export function formatTimelineDate(dateStr?: string | Date | null): string {
	if (!dateStr) return "";
	const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
	if (isNaN(d.getTime())) return "";
	return d
		.toLocaleDateString("en-GB", {
			day: "numeric",
			month: "short",
			year: "numeric",
		})
		.toLowerCase();
}

export function formatAge(ageMs: number): string {
	if (ageMs <= 0) return "0 hours";

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
		parts.push(`${years} year${years !== 1 ? "s" : ""}`);
		if (months > 0) {
			parts.push(`${months} month${months !== 1 ? "s" : ""}`);
		}
	} else if (months > 0) {
		parts.push(`${months} month${months !== 1 ? "s" : ""}`);
		if (days > 0) {
			parts.push(`${days} day${days !== 1 ? "s" : ""}`);
		}
	} else if (days > 0) {
		parts.push(`${days} day${days !== 1 ? "s" : ""}`);
		if (hours > 0) {
			parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
		}
	} else {
		parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
	}

	return parts.join(", ");
}

export function formatSg(value?: number | null): string {
	if (value === undefined || value === null || isNaN(value)) return "---";
	return value.toFixed(3);
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
	if (costPerUnit === undefined || costPerUnit === null) return "No cost data";
	return `${costPerUnit} ${currency} / ${unit}`;
}

export function formatCost(cost: number, currency = "NOK"): string {
	return `${cost.toFixed(2)} ${currency}`;
}
