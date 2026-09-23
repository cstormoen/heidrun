import { describe, expect, it } from "bun:test";
import { DAL } from "../dal";

describe("DAL recipe operations", () => {
	it("retrieves starter recipes seeded from database", () => {
		const recipes = DAL.getRecipes();
		expect(recipes.length).toBeGreaterThanOrEqual(2);
		const starter = recipes.find((r) => r.type === "starter");
		expect(starter).toBeDefined();
		expect(starter?.name).toBeTruthy();
	});

	it("creates a custom recipe with target_sg and description", () => {
		const created = DAL.createRecipe({
			name: "Test Eplemjød",
			target_sg: 1.105,
			description: "Eplejuice og honning",
		});

		expect(created.id).toBeDefined();
		expect(created.name).toBe("Test Eplemjød");
		expect(created.target_sg).toBe(1.105);
		expect(created.description).toBe("Eplejuice og honning");
		expect(created.type).toBe("custom");

		const fetched = DAL.getRecipeById(created.id);
		expect(fetched).not.toBeNull();
		expect(fetched?.name).toBe("Test Eplemjød");

		// Clean up
		DAL.deleteRecipe(created.id);
	});

	it("updates a custom recipe", () => {
		const created = DAL.createRecipe({
			name: "Original Navn",
			target_sg: 1.09,
			description: "Gammel oppskrift",
		});

		const updated = DAL.updateRecipe(created.id, {
			name: "Nytt Navn",
			target_sg: 1.095,
			description: "Oppdatert oppskrift",
		});

		expect(updated).not.toBeNull();
		expect(updated?.name).toBe("Nytt Navn");
		expect(updated?.target_sg).toBe(1.095);
		expect(updated?.description).toBe("Oppdatert oppskrift");

		DAL.deleteRecipe(created.id);
	});

	it("prevents updating a starter recipe", () => {
		const recipes = DAL.getRecipes();
		const starter = recipes.find((r) => r.type === "starter")!;
		expect(starter).toBeDefined();

		const originalName = starter.name;
		const result = DAL.updateRecipe(starter.id, {
			name: "Forsøk på endring av standardoppskrift",
		});

		expect(result).toBeNull();

		const refreshed = DAL.getRecipeById(starter.id);
		expect(refreshed?.name).toBe(originalName);
	});

	it("prevents deleting a starter recipe", () => {
		const recipes = DAL.getRecipes();
		const starter = recipes.find((r) => r.type === "starter")!;
		expect(starter).toBeDefined();

		const result = DAL.deleteRecipe(starter.id);
		expect(result).toBe(false);

		const stillExists = DAL.getRecipeById(starter.id);
		expect(stillExists).not.toBeNull();
	});

	it("deletes a custom recipe and sets referenced session recipe_id to null", () => {
		const created = DAL.createRecipe({
			name: "Oppskrift for brygg",
			target_sg: 1.1,
		});

		const session = DAL.createSession(created.id, "Test Brygg med oppskrift");
		expect(session.recipe_id).toBe(created.id);

		const deleted = DAL.deleteRecipe(created.id);
		expect(deleted).toBe(true);

		const recipeAfterDelete = DAL.getRecipeById(created.id);
		expect(recipeAfterDelete).toBeNull();

		const sessionAfterDelete = DAL.getSessionById(session.id);
		expect(sessionAfterDelete?.recipe_id).toBeNull();
	});
});
