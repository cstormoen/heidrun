import type { Event, InventoryItem, Recipe, Session, Status } from "../domain/models";

export interface ChartPoint {
	x: number;
	y: number;
}

export interface ChartAnnotation {
	type: "line";
	scaleID?: string;
	value?: number;
	endValue?: number;
	xMin?: number;
	xMax?: number;
	yMin?: number;
	yMax?: number;
	borderColor: string;
	borderWidth: number;
	borderDash: number[];
	label: {
		display: boolean;
		content: string;
		position: string;
		backgroundColor: string;
		color: string;
		font: { size: number; weight?: string };
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
	selected?: boolean;
}

export interface NewSessionViewModel {
	recipes: NewSessionRecipeOption[];
	selectedRecipeId?: number;
}

export interface RecipeCardViewModel {
	recipe: Recipe;
	targetSgFormatted: string;
	recipeJson: string;
}

export interface RecipesViewModel {
	starterRecipes: RecipeCardViewModel[];
	customRecipes: RecipeCardViewModel[];
}

export interface SessionDetailViewModel {
	session: Session;
	startDateFormatted?: string;
	ogFormatted: string;
	currentSgFormatted: string;
	sugarBreakFormatted?: string;
	currentPhFormatted?: string;
	chartBundle: ChartDatasetBundle;
	chartConfigJSON: string;
	inventoryUsage: InventoryUsageSummary;
	inventoryList: InventoryItem[];
	events: Event[];
}

export type { Event, InventoryItem, Recipe, Session, Status };
