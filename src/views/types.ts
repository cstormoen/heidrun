import type { Event, InventoryItem, Recipe, Session, Status } from "../domain/models";

export interface ChartPoint {
	x: number;
	y: number;
}

export interface ChartAnnotation {
	type: "line";
	xMin: number;
	xMax: number;
	borderColor: string;
	borderWidth: number;
	borderDash: number[];
	label: {
		display: boolean;
		content: string;
		position: "start";
		backgroundColor: string;
		color: string;
		font: { size: number };
	};
}

export interface ChartDatasetBundle {
	sgData: ChartPoint[];
	abvData: ChartPoint[];
	annotations: ChartAnnotation[];
}

export interface LinkedIngredientSummary {
	invItem: InventoryItem;
	totalQty: number;
	cost: number;
}

export interface UnlinkedIngredientItem {
	event: Event;
	ingredient?: string;
	quantityUsed?: number;
	unit?: string;
	note?: string;
}

export interface InventoryUsageSummary {
	totalCost: number;
	linkedGroups: LinkedIngredientSummary[];
	unlinkedItems: UnlinkedIngredientItem[];
}

export interface PantryItemViewModel {
	item: InventoryItem;
	unitPriceFormatted: string;
	quantityFormatted: string;
	itemJson: string;
	domainLink?: {
		url: string;
		domain: string;
	};
}

export interface PantryCategoryGroup {
	category: string;
	items: PantryItemViewModel[];
}

export interface PantryViewModel {
	categories: PantryCategoryGroup[];
	hasItems: boolean;
}

export interface SessionListViewModel {
	sessions: Session[];
}

export interface NewSessionRecipeOption {
	id: number;
	name: string;
	safeDescription: string;
}

export interface NewSessionViewModel {
	recipes: NewSessionRecipeOption[];
}

export interface SessionDetailViewModel {
	session: Session;
	startDateFormatted?: string;
	ogFormatted: string;
	currentSgFormatted: string;
	chartBundle: ChartDatasetBundle;
	chartConfigJSON: string;
	inventoryUsage: InventoryUsageSummary;
	inventoryList: InventoryItem[];
	events: Event[];
}

export type { Event, InventoryItem, Recipe, Session, Status };
