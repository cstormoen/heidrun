import type { Event, InventoryItem } from "../domain/models";
import { convertUnits } from "../domain/models";
import { PANTRY_CATEGORIES } from "./constants";
import {
	formatCost,
	formatInventoryQuantity,
	formatQuantity,
	formatUnitPrice,
} from "./formatters";
import { renderTemplate, renderView } from "./render";
import type {
	InventoryUsageSummary,
	LinkedIngredientSummary,
	PantryCategoryGroup,
	PantryItemViewModel,
	PantryViewModel,
	UnlinkedIngredientItem,
} from "./types";

/**
 * Summarizes inventory usage from addition events against the inventory stock.
 */
export function summarizeInventoryUsage(
	additionEvents: Event[],
	inventoryMap: Map<number, InventoryItem>,
): InventoryUsageSummary {
	let totalCost = 0;
	const groupedLinked = new Map<number, LinkedIngredientSummary>();
	const unlinkedItems: UnlinkedIngredientItem[] = [];

	for (const e of additionEvents) {
		if (e.data?.inventory_item_id) {
			const invItem = inventoryMap.get(e.data.inventory_item_id);
			if (invItem) {
				const qty = e.data.quantity_used || 0;
				const unit = e.data.unit || invItem.unit;
				const baseQty = convertUnits(qty, unit, invItem.unit);
				let cost = 0;
				if (invItem.cost_per_unit) {
					cost = baseQty * invItem.cost_per_unit;
					totalCost += cost;
				}

				if (!groupedLinked.has(invItem.id)) {
					groupedLinked.set(invItem.id, { invItem, totalQty: baseQty, cost });
				} else {
					const existing = groupedLinked.get(invItem.id)!;
					existing.totalQty += baseQty;
					existing.cost += cost;
				}
			}
		} else {
			unlinkedItems.push({
				event: e,
				ingredient: e.data?.ingredient,
				quantityUsed: e.data?.quantity_used,
				unit: e.data?.unit,
				note: e.data?.note,
			});
		}
	}

	return {
		totalCost,
		linkedGroups: Array.from(groupedLinked.values()),
		unlinkedItems,
	};
}

/**
 * Prepares the view model for the pantry inventory page.
 */
export function getPantryViewModel(items: InventoryItem[]): PantryViewModel {
	const grouped: Record<string, PantryItemViewModel[]> = {};
	for (const c of PANTRY_CATEGORIES) {
		grouped[c] = [];
	}

	for (const item of items) {
		let domainLink: { url: string; domain: string } | undefined;
		if (item.url) {
			try {
				const urlObj = new URL(item.url);
				const domain = urlObj.hostname.replace(/^www\./, "");
				domainLink = { url: item.url, domain };
			} catch {
				// Invalid URL, leave undefined
			}
		}

		const itemVm: PantryItemViewModel = {
			item,
			unitPriceFormatted: formatUnitPrice(
				item.cost_per_unit,
				item.currency,
				item.unit,
			),
			quantityFormatted: formatInventoryQuantity(item.quantity_on_hand),
			itemJson: JSON.stringify(item).replace(/'/g, "&#39;"),
			domainLink,
		};

		if (grouped[item.category]) {
			grouped[item.category].push(itemVm);
		}
	}

	const categories: PantryCategoryGroup[] = PANTRY_CATEGORIES.map((cat) => ({
		category: cat,
		items: grouped[cat] || [],
	}));

	return {
		categories,
		hasItems: items.length > 0,
	};
}

/**
 * Renders an unlinked inventory form snippet.
 */
export function renderUnlinkedInventoryForm(
	item: UnlinkedIngredientItem,
	inventoryList: InventoryItem[],
	sessionId: number,
): string {
	return renderTemplate("partials/ingredientsUsed", {
		usage: { totalCost: 0, linkedGroups: [], unlinkedItems: [item] },
		inventoryList,
		sessionId,
	});
}

/**
 * Renders a linked inventory item summary entry snippet.
 */
export function renderLinkedInventoryEntry(
	group: LinkedIngredientSummary,
): string {
	const invItem = group.invItem;
	const unit = invItem.unit;
	let costStr = "";
	if (invItem.cost_per_unit) {
		costStr = ` (~${group.cost.toFixed(2)} ${invItem.currency || "NOK"})`;
	}
	const displayQty = formatQuantity(group.totalQty);
	return `<li><span class="font-semibold">${invItem.name}</span>: ${displayQty} ${unit}${costStr}</li>`;
}

/**
 * Renders the Ingredients Used card section.
 */
export function renderIngredientsUsedSection(
	usage: InventoryUsageSummary,
	inventoryList: InventoryItem[],
	sessionId: number,
): string {
	if (usage.linkedGroups.length === 0 && usage.unlinkedItems.length === 0) {
		return "";
	}
	return renderTemplate("partials/ingredientsUsed", {
		usage,
		inventoryList,
		sessionId,
	});
}

/**
 * Renders the Pantry page.
 */
export function renderPantryView(
	items: InventoryItem[],
	isHtmx: boolean = true,
): string {
	const viewModel = getPantryViewModel(items);
	return renderView("pantry/index", viewModel, isHtmx);
}
