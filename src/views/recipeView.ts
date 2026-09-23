import type { Recipe } from "../domain/models";
import { formatSg } from "./formatters";
import { renderView } from "./render";
import type { RecipeCardViewModel, RecipesViewModel } from "./types";

/**
 * Prepares the view model for the recipes page.
 */
export function getRecipeViewModel(recipes: Recipe[]): RecipesViewModel {
	const starterRecipes: RecipeCardViewModel[] = [];
	const customRecipes: RecipeCardViewModel[] = [];

	for (const r of recipes) {
		const cardVm: RecipeCardViewModel = {
			recipe: r,
			targetSgFormatted: formatSg(r.target_sg),
			recipeJson: JSON.stringify(r).replace(/'/g, "&#39;"),
		};

		if (r.type === "starter") {
			starterRecipes.push(cardVm);
		} else {
			customRecipes.push(cardVm);
		}
	}

	return {
		starterRecipes,
		customRecipes,
	};
}

/**
 * Renders the Recipes page.
 */
export function renderRecipeView(
	recipes: Recipe[],
	isHtmx: boolean = true,
): string {
	const viewModel = getRecipeViewModel(recipes);
	return renderView("recipes/index", viewModel, isHtmx);
}
