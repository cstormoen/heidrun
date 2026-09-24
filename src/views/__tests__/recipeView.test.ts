import { describe, expect, it } from "bun:test";
import type { Recipe } from "../../domain/models";
import { getRecipeViewModel, renderRecipeView } from "../recipeView";
import { getNewSessionViewModel } from "../sessionView";

describe("recipeView", () => {
	const mockStarterRecipe: Recipe = {
		id: 1,
		name: "Tradisjonell mjød",
		description: "Klassisk honningmjød med 1,8 kg honning",
		target_sg: 1.11,
		type: "starter",
	};

	const mockCustomRecipe: Recipe = {
		id: 2,
		name: "Min Bærmjød",
		description: "Bringebær og villblomsthonning\nTrinn 1: Kok opp bær",
		target_sg: 1.115,
		type: "custom",
	};

	const mockRecipes = [mockStarterRecipe, mockCustomRecipe];

	describe("getRecipeViewModel", () => {
		it("correctly groups starter and custom recipes and formats values", () => {
			const vm = getRecipeViewModel(mockRecipes);

			expect(vm.starterRecipes.length).toBe(1);
			expect(vm.starterRecipes[0].recipe.name).toBe("Tradisjonell mjød");
			expect(vm.starterRecipes[0].targetSgFormatted).toBe("1.110");
			expect(vm.starterRecipes[0].recipe.type).toBe("starter");

			expect(vm.customRecipes.length).toBe(1);
			expect(vm.customRecipes[0].recipe.name).toBe("Min Bærmjød");
			expect(vm.customRecipes[0].targetSgFormatted).toBe("1.115");
			expect(vm.customRecipes[0].recipe.type).toBe("custom");
			expect(vm.customRecipes[0].recipeJson).toContain("Min Bærmjød");
		});

		it("handles recipes with undefined or null target_sg", () => {
			const recipeWithoutSg: Recipe = {
				id: 3,
				name: "Uten SG",
				description: "Notat",
				target_sg: null,
				type: "custom",
			};
			const vm = getRecipeViewModel([recipeWithoutSg]);
			expect(vm.customRecipes[0].targetSgFormatted).toBe("---");
		});
	});

	describe("renderRecipeView", () => {
		it("renders overview with sections, cards, and action buttons", () => {
			const html = renderRecipeView(mockRecipes, true);

			expect(html).toContain("Oppskrifter");
			expect(html).toContain("Ny oppskrift");
			expect(html).toContain("Standardoppskrifter");
			expect(html).toContain("Mine oppskrifter");

			// Cards content
			expect(html).toContain("Tradisjonell mjød");
			expect(html).toContain("Min Bærmjød");
			expect(html).toContain("1.110");
			expect(html).toContain("1.115");

			// Action buttons: "Start brygg" should be present on both
			expect(html).toContain('href="/sessions/new?recipe_id=1"');
			expect(html).toContain('href="/sessions/new?recipe_id=2"');
			expect(html).toContain("Start brygg");

			// "Endre" should only be present on the custom recipe
			expect(html).toContain("Endre");
			// The starter recipe should not have openEditModal called for id 1
			expect(html).not.toMatch(/openEditModal\([^)]*"id":1[^)]*\)/);
			// The custom recipe should have openEditModal called
			expect(html).toMatch(/openEditModal\([^)]*"id":2[^)]*\)/);

			// Modals
			expect(html).toContain('id="add_recipe_modal"');
			expect(html).toContain('id="edit_recipe_modal"');
			expect(html).toContain("Mål for startvekt (Target SG)");
			expect(html).toContain("Slett");
		});

		it("renders empty state for custom recipes when none exist", () => {
			const html = renderRecipeView([mockStarterRecipe], true);
			expect(html).toContain("Ingen egne oppskrifter ennå.");
		});
	});

	describe("getNewSessionViewModel pre-selection", () => {
		it("sets selected flag on the recipe matching selectedRecipeId", () => {
			const vm = getNewSessionViewModel(mockRecipes, 2);
			expect(vm.recipes.length).toBe(2);
			expect(vm.recipes[0].selected).toBe(false);
			expect(vm.recipes[1].selected).toBe(true);
			expect(vm.selectedRecipeId).toBe(2);
		});

		it("leaves selected false when selectedRecipeId is not passed", () => {
			const vm = getNewSessionViewModel(mockRecipes);
			expect(vm.recipes[0].selected).toBe(false);
			expect(vm.recipes[1].selected).toBe(false);
			expect(vm.selectedRecipeId).toBeUndefined();
		});
	});
});
