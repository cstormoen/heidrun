import type { Event, InventoryItem, Recipe, Session } from "../domain/models";
import { deriveSessionState } from "../domain/models";
import { buildFermentationChartData } from "./chartData";
import { formatDateForDisplay, formatSg } from "./formatters";
import { summarizeInventoryUsage } from "./inventoryView";
import { renderTemplate, renderView } from "./render";
import type {
	NewSessionRecipeOption,
	NewSessionViewModel,
	SessionDetailViewModel,
	SessionListViewModel,
} from "./types";

/**
 * Prepares view model for session list.
 */
export function getSessionListViewModel(
	sessions: Session[],
): SessionListViewModel {
	return { sessions };
}

/**
 * Prepares view model for new session creation form.
 */
export function getNewSessionViewModel(
	recipes: Recipe[],
): NewSessionViewModel {
	const recipeOptions: NewSessionRecipeOption[] = recipes.map((r) => ({
		id: r.id,
		name: r.name,
		safeDescription: (r.description || "").replace(/"/g, "&quot;"),
	}));

	return { recipes: recipeOptions };
}

/**
 * Prepares view model for session detail view.
 */
export function getSessionDetailViewModel(
	session: Session,
	events: Event[],
	inventoryList: InventoryItem[],
): SessionDetailViewModel {
	const fullSession = deriveSessionState(session, events, inventoryList);
	const startDateFormatted = formatDateForDisplay(fullSession.start_date);
	const ogFormatted = formatSg(fullSession.original_sg);
	const currentSgFormatted = formatSg(fullSession.current_sg);
	const sugarBreakFormatted = formatSg(fullSession.sugar_break_sg);

	const chartBundle = buildFermentationChartData(
		events,
		fullSession.start_date,
		fullSession.sugar_break_sg,
	);
	const chartConfigJSON = JSON.stringify(chartBundle);

	const inventoryMap = new Map<number, InventoryItem>(
		inventoryList.map((i) => [i.id, i]),
	);
	const additionEvents = (fullSession.events || []).filter(
		(e) => e.type === "addition",
	);
	const inventoryUsage = summarizeInventoryUsage(additionEvents, inventoryMap);

	return {
		session: fullSession,
		startDateFormatted,
		ogFormatted,
		currentSgFormatted,
		sugarBreakFormatted,
		chartBundle,
		chartConfigJSON,
		inventoryUsage,
		inventoryList,
		events: fullSession.events || [],
	};
}

/**
 * Renders an individual session card.
 */
export function renderSessionCard(session: Session): string {
	return renderTemplate("sessions/card", { session });
}

/**
 * Renders the session list snippet.
 */
export function renderSessionList(
	sessions: Session[],
	isHtmx: boolean = true,
): string {
	const viewModel = getSessionListViewModel(sessions);
	return renderView("sessions/list", viewModel, isHtmx);
}

/**
 * Renders the new session form snippet.
 */
export function renderNewSessionForm(
	recipes: Recipe[],
	isHtmx: boolean = true,
): string {
	const viewModel = getNewSessionViewModel(recipes);
	return renderView("sessions/new", viewModel, isHtmx);
}

/**
 * Renders the session detail snippet.
 */
export function renderSessionDetail(
	session: Session,
	events: Event[],
	inventoryList: InventoryItem[],
	isHtmx: boolean = true,
): string {
	const viewModel = getSessionDetailViewModel(session, events, inventoryList);
	return renderView("sessions/detail", viewModel, isHtmx);
}
