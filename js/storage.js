/* storage.js — state shape, localStorage persistence, versioned seed data.
   Seed items use fixed ids and a `sinceVersion` tag so that when new
   ingredients/recipes/events are added later, anyone with existing saved
   data automatically gets the new ones merged in (without touching what
   they've already edited) instead of only new visitors seeing them. */

const Storage = (function () {
  const KEY = "noneLeftOnPlate.v1";
  const SEED_VERSION = 1;

  // ---- Ingredients ----
  // onHandQty and parQty are stored in the ingredient's BASE unit (oz, fl oz, each).
  function seedIngredients() {
    return [
      // Protein
      { id: "ing_chicken_breast", sinceVersion: 1, name: "Chicken Breast", category: "Protein", baseUnit: "ozwt", purchaseUnit: "lb", purchaseQty: 40, purchaseCost: 116, yieldPct: 95, onHandQty: 320, parQty: 160 },
      { id: "ing_ground_beef", sinceVersion: 1, name: "Ground Beef 80/20", category: "Protein", baseUnit: "ozwt", purchaseUnit: "lb", purchaseQty: 10, purchaseCost: 45, yieldPct: 100, onHandQty: 160, parQty: 96 },
      { id: "ing_salmon_fillet", sinceVersion: 1, name: "Salmon Fillet", category: "Protein", baseUnit: "ozwt", purchaseUnit: "lb", purchaseQty: 10, purchaseCost: 119, yieldPct: 88, onHandQty: 40, parQty: 48 },
      { id: "ing_bacon", sinceVersion: 1, name: "Applewood Bacon", category: "Protein", baseUnit: "ozwt", purchaseUnit: "lb", purchaseQty: 15, purchaseCost: 68, yieldPct: 100, onHandQty: 96, parQty: 48 },

      // Produce
      { id: "ing_romaine", sinceVersion: 1, name: "Romaine Hearts", category: "Produce", baseUnit: "ozwt", purchaseUnit: "lb", purchaseQty: 24, purchaseCost: 32, yieldPct: 80, onHandQty: 192, parQty: 96 },
      { id: "ing_roma_tomato", sinceVersion: 1, name: "Roma Tomatoes", category: "Produce", baseUnit: "ozwt", purchaseUnit: "lb", purchaseQty: 25, purchaseCost: 27, yieldPct: 90, onHandQty: 160, parQty: 80 },
      { id: "ing_yellow_onion", sinceVersion: 1, name: "Yellow Onion", category: "Produce", baseUnit: "ozwt", purchaseUnit: "lb", purchaseQty: 50, purchaseCost: 28, yieldPct: 85, onHandQty: 320, parQty: 160 },
      { id: "ing_garlic", sinceVersion: 1, name: "Peeled Garlic", category: "Produce", baseUnit: "ozwt", purchaseUnit: "lb", purchaseQty: 5, purchaseCost: 17, yieldPct: 97, onHandQty: 32, parQty: 16 },
      { id: "ing_russet_potato", sinceVersion: 1, name: "Russet Potatoes", category: "Produce", baseUnit: "ozwt", purchaseUnit: "lb", purchaseQty: 50, purchaseCost: 24, yieldPct: 82, onHandQty: 480, parQty: 240 },
      { id: "ing_carrot", sinceVersion: 1, name: "Carrots", category: "Produce", baseUnit: "ozwt", purchaseUnit: "lb", purchaseQty: 25, purchaseCost: 19, yieldPct: 80, onHandQty: 120, parQty: 48 },
      { id: "ing_mushroom", sinceVersion: 1, name: "Cremini Mushrooms", category: "Produce", baseUnit: "ozwt", purchaseUnit: "lb", purchaseQty: 10, purchaseCost: 26, yieldPct: 95, onHandQty: 64, parQty: 32 },
      { id: "ing_basil", sinceVersion: 1, name: "Fresh Basil", category: "Produce", baseUnit: "ozwt", purchaseUnit: "ozwt", purchaseQty: 8, purchaseCost: 7.5, yieldPct: 70, onHandQty: 3, parQty: 4 },
      { id: "ing_lemon", sinceVersion: 1, name: "Lemon", category: "Produce", baseUnit: "each", unitNoun: "lemon", purchaseUnit: "each", purchaseQty: 165, purchaseCost: 38, yieldPct: 100, onHandQty: 60, parQty: 36 },

      // Dairy
      { id: "ing_butter", sinceVersion: 1, name: "Unsalted Butter", category: "Dairy", baseUnit: "ozwt", purchaseUnit: "lb", purchaseQty: 1, purchaseCost: 4.2, yieldPct: 100, onHandQty: 160, parQty: 64 },
      { id: "ing_heavy_cream", sinceVersion: 1, name: "Heavy Cream", category: "Dairy", baseUnit: "floz", purchaseUnit: "qt", purchaseQty: 1, purchaseCost: 4.5, yieldPct: 100, onHandQty: 128, parQty: 64 },
      { id: "ing_parmesan", sinceVersion: 1, name: "Parmesan", category: "Dairy", baseUnit: "ozwt", purchaseUnit: "lb", purchaseQty: 5, purchaseCost: 54, yieldPct: 92, onHandQty: 12, parQty: 16 },
      { id: "ing_mozzarella", sinceVersion: 1, name: "Fresh Mozzarella", category: "Dairy", baseUnit: "ozwt", purchaseUnit: "lb", purchaseQty: 6, purchaseCost: 33, yieldPct: 100, onHandQty: 18, parQty: 24 },
      { id: "ing_cheddar", sinceVersion: 1, name: "Sharp Cheddar", category: "Dairy", baseUnit: "ozwt", purchaseUnit: "lb", purchaseQty: 5, purchaseCost: 28, yieldPct: 100, onHandQty: 40, parQty: 16 },
      { id: "ing_egg", sinceVersion: 1, name: "Large Egg", category: "Dairy", baseUnit: "each", unitNoun: "egg", purchaseUnit: "dozen", purchaseQty: 30, purchaseCost: 62, yieldPct: 100, onHandQty: 120, parQty: 60 },

      // Dry goods
      { id: "ing_spaghetti", sinceVersion: 1, name: "Spaghetti (dry)", category: "Dry Goods", baseUnit: "ozwt", purchaseUnit: "lb", purchaseQty: 20, purchaseCost: 19, yieldPct: 100, onHandQty: 160, parQty: 80 },
      { id: "ing_jasmine_rice", sinceVersion: 1, name: "Jasmine Rice (dry)", category: "Dry Goods", baseUnit: "ozwt", purchaseUnit: "lb", purchaseQty: 25, purchaseCost: 28, yieldPct: 100, onHandQty: 200, parQty: 100 },
      { id: "ing_ap_flour", sinceVersion: 1, name: "All-Purpose Flour", category: "Dry Goods", baseUnit: "ozwt", purchaseUnit: "lb", purchaseQty: 50, purchaseCost: 24, yieldPct: 100, onHandQty: 400, parQty: 160 },

      // Bakery
      { id: "ing_brioche_bun", sinceVersion: 1, name: "Brioche Bun", category: "Bakery", baseUnit: "each", unitNoun: "bun", purchaseUnit: "each", purchaseQty: 96, purchaseCost: 42, yieldPct: 100, onHandQty: 72, parQty: 48 },
      { id: "ing_flatbread_dough", sinceVersion: 1, name: "Flatbread Dough Ball", category: "Bakery", baseUnit: "each", unitNoun: "dough ball", purchaseUnit: "each", purchaseQty: 40, purchaseCost: 36, yieldPct: 100, onHandQty: 10, parQty: 16 },
      { id: "ing_crouton", sinceVersion: 1, name: "Garlic Croutons", category: "Bakery", baseUnit: "ozwt", purchaseUnit: "lb", purchaseQty: 5, purchaseCost: 16, yieldPct: 100, onHandQty: 40, parQty: 16 },

      // Pantry
      { id: "ing_olive_oil", sinceVersion: 1, name: "Olive Oil", category: "Pantry", baseUnit: "floz", purchaseUnit: "liter", purchaseQty: 3, purchaseCost: 29, yieldPct: 100, onHandQty: 101.4, parQty: 34 },
      { id: "ing_fryer_oil", sinceVersion: 1, name: "Fryer Oil", category: "Pantry", baseUnit: "floz", purchaseUnit: "gal", purchaseQty: 4.75, purchaseCost: 38, yieldPct: 100, onHandQty: 608, parQty: 128 },
      { id: "ing_crushed_tomato", sinceVersion: 1, name: "Crushed Tomatoes (#10 can)", category: "Pantry", baseUnit: "ozwt", purchaseUnit: "ozwt", purchaseQty: 102, purchaseCost: 4.8, yieldPct: 100, onHandQty: 306, parQty: 102 },
      { id: "ing_caesar_dressing", sinceVersion: 1, name: "Caesar Dressing", category: "Pantry", baseUnit: "floz", purchaseUnit: "gal", purchaseQty: 1, purchaseCost: 22, yieldPct: 100, onHandQty: 128, parQty: 64 },
      { id: "ing_chicken_stock", sinceVersion: 1, name: "Chicken Stock", category: "Pantry", baseUnit: "floz", purchaseUnit: "gal", purchaseQty: 1, purchaseCost: 9.5, yieldPct: 100, onHandQty: 384, parQty: 128 },
      { id: "ing_soy_sauce", sinceVersion: 1, name: "Soy Sauce", category: "Pantry", baseUnit: "floz", purchaseUnit: "gal", purchaseQty: 1, purchaseCost: 14, yieldPct: 100, onHandQty: 128, parQty: 32 },

      // Spice
      { id: "ing_kosher_salt", sinceVersion: 1, name: "Kosher Salt", category: "Spice", baseUnit: "ozwt", purchaseUnit: "lb", purchaseQty: 3, purchaseCost: 5.5, yieldPct: 100, onHandQty: 96, parQty: 48 },
      { id: "ing_black_pepper", sinceVersion: 1, name: "Ground Black Pepper", category: "Spice", baseUnit: "ozwt", purchaseUnit: "lb", purchaseQty: 1, purchaseCost: 12, yieldPct: 100, onHandQty: 16, parQty: 8 },

      // Disposables — the line items that quietly wreck a catering quote
      { id: "ing_togo_container", sinceVersion: 1, name: "To-Go Container", category: "Disposables", baseUnit: "each", unitNoun: "container", purchaseUnit: "each", purchaseQty: 200, purchaseCost: 54, yieldPct: 100, onHandQty: 150, parQty: 100 },
      { id: "ing_cutlery_kit", sinceVersion: 1, name: "Cutlery Kit", category: "Disposables", baseUnit: "each", unitNoun: "kit", purchaseUnit: "each", purchaseQty: 250, purchaseCost: 32, yieldPct: 100, onHandQty: 200, parQty: 100 },
      { id: "ing_napkin", sinceVersion: 1, name: "Dinner Napkin", category: "Disposables", baseUnit: "each", unitNoun: "napkin", purchaseUnit: "each", purchaseQty: 1000, purchaseCost: 18, yieldPct: 100, onHandQty: 800, parQty: 400 },
      { id: "ing_chafing_fuel", sinceVersion: 1, name: "Chafing Fuel Can", category: "Disposables", baseUnit: "each", unitNoun: "can", purchaseUnit: "each", purchaseQty: 24, purchaseCost: 38, yieldPct: 100, onHandQty: 24, parQty: 12 },
    ];
  }

  // ---- Recipes ----
  // `portions` is the batch yield: component quantities are per BATCH, so a
  // portions: 8 sauce recipe divides its cost by 8 to get the plate cost.
  function seedRecipes() {
    const g = Calc.uid;
    return [
      {
        id: "rec_classic_burger", sinceVersion: 1, name: "Classic Cheeseburger & Fries", category: "Sandwiches",
        portions: 1, menuPrice: 11, targetFoodCostPct: 30, servingsPerWeek: 210,
        notes: "6 oz patty, smashed. Fries salted to order.",
        components: [
          { id: g("comp"), ingredientId: "ing_ground_beef", qty: 6 },
          { id: g("comp"), ingredientId: "ing_brioche_bun", qty: 1 },
          { id: g("comp"), ingredientId: "ing_cheddar", qty: 0.8 },
          { id: g("comp"), ingredientId: "ing_romaine", qty: 0.5 },
          { id: g("comp"), ingredientId: "ing_roma_tomato", qty: 1 },
          { id: g("comp"), ingredientId: "ing_yellow_onion", qty: 0.5 },
          { id: g("comp"), ingredientId: "ing_russet_potato", qty: 6 },
          { id: g("comp"), ingredientId: "ing_fryer_oil", qty: 0.5 },
          { id: g("comp"), ingredientId: "ing_kosher_salt", qty: 0.1 },
          { id: g("comp"), ingredientId: "ing_napkin", qty: 1 },
        ],
      },
      {
        id: "rec_chicken_caesar", sinceVersion: 1, name: "Chicken Caesar Salad", category: "Salads",
        portions: 1, menuPrice: 9.5, targetFoodCostPct: 28, servingsPerWeek: 140,
        notes: "Grilled chicken, sliced on the bias.",
        components: [
          { id: g("comp"), ingredientId: "ing_chicken_breast", qty: 5 },
          { id: g("comp"), ingredientId: "ing_romaine", qty: 5 },
          { id: g("comp"), ingredientId: "ing_parmesan", qty: 0.6 },
          { id: g("comp"), ingredientId: "ing_crouton", qty: 1 },
          { id: g("comp"), ingredientId: "ing_caesar_dressing", qty: 2 },
          { id: g("comp"), ingredientId: "ing_lemon", qty: 0.1 },
          { id: g("comp"), ingredientId: "ing_black_pepper", qty: 0.02 },
          { id: g("comp"), ingredientId: "ing_napkin", qty: 1 },
        ],
      },
      {
        id: "rec_spaghetti_bolognese", sinceVersion: 1, name: "Spaghetti Bolognese", category: "Pasta",
        portions: 8, menuPrice: 9, targetFoodCostPct: 26, servingsPerWeek: 120,
        notes: "Batch recipe — sauce yields 8 plates. Quantities below are per batch.",
        components: [
          { id: g("comp"), ingredientId: "ing_spaghetti", qty: 32 },
          { id: g("comp"), ingredientId: "ing_ground_beef", qty: 32 },
          { id: g("comp"), ingredientId: "ing_crushed_tomato", qty: 60 },
          { id: g("comp"), ingredientId: "ing_yellow_onion", qty: 12 },
          { id: g("comp"), ingredientId: "ing_carrot", qty: 8 },
          { id: g("comp"), ingredientId: "ing_garlic", qty: 1.5 },
          { id: g("comp"), ingredientId: "ing_olive_oil", qty: 4 },
          { id: g("comp"), ingredientId: "ing_parmesan", qty: 4 },
          { id: g("comp"), ingredientId: "ing_basil", qty: 0.5 },
          { id: g("comp"), ingredientId: "ing_kosher_salt", qty: 0.5 },
          { id: g("comp"), ingredientId: "ing_black_pepper", qty: 0.15 },
        ],
      },
      {
        id: "rec_grilled_salmon", sinceVersion: 1, name: "Grilled Salmon & Jasmine Rice", category: "Entrées",
        portions: 1, menuPrice: 18, targetFoodCostPct: 30, servingsPerWeek: 95,
        notes: "6 oz fillet, skin on. Rice steamed in stock.",
        components: [
          { id: g("comp"), ingredientId: "ing_salmon_fillet", qty: 6 },
          { id: g("comp"), ingredientId: "ing_jasmine_rice", qty: 3 },
          { id: g("comp"), ingredientId: "ing_chicken_stock", qty: 6 },
          { id: g("comp"), ingredientId: "ing_carrot", qty: 2 },
          { id: g("comp"), ingredientId: "ing_butter", qty: 0.5 },
          { id: g("comp"), ingredientId: "ing_olive_oil", qty: 0.5 },
          { id: g("comp"), ingredientId: "ing_soy_sauce", qty: 0.5 },
          { id: g("comp"), ingredientId: "ing_lemon", qty: 0.25 },
          { id: g("comp"), ingredientId: "ing_kosher_salt", qty: 0.1 },
        ],
      },
      {
        id: "rec_margherita_flatbread", sinceVersion: 1, name: "Margherita Flatbread", category: "Flatbreads",
        portions: 1, menuPrice: 9, targetFoodCostPct: 24, servingsPerWeek: 130,
        notes: "Deck oven, 6 minutes. Basil after the bake.",
        components: [
          { id: g("comp"), ingredientId: "ing_flatbread_dough", qty: 1 },
          { id: g("comp"), ingredientId: "ing_crushed_tomato", qty: 4 },
          { id: g("comp"), ingredientId: "ing_mozzarella", qty: 4 },
          { id: g("comp"), ingredientId: "ing_basil", qty: 0.15 },
          { id: g("comp"), ingredientId: "ing_olive_oil", qty: 0.5 },
          { id: g("comp"), ingredientId: "ing_kosher_salt", qty: 0.05 },
        ],
      },
      {
        id: "rec_chicken_alfredo", sinceVersion: 1, name: "Chicken Alfredo", category: "Pasta",
        portions: 1, menuPrice: 13, targetFoodCostPct: 28, servingsPerWeek: 110,
        notes: "Sauce mounted to order.",
        components: [
          { id: g("comp"), ingredientId: "ing_spaghetti", qty: 4 },
          { id: g("comp"), ingredientId: "ing_chicken_breast", qty: 5 },
          { id: g("comp"), ingredientId: "ing_heavy_cream", qty: 4 },
          { id: g("comp"), ingredientId: "ing_parmesan", qty: 1.5 },
          { id: g("comp"), ingredientId: "ing_butter", qty: 1 },
          { id: g("comp"), ingredientId: "ing_mushroom", qty: 1.5 },
          { id: g("comp"), ingredientId: "ing_garlic", qty: 0.2 },
          { id: g("comp"), ingredientId: "ing_black_pepper", qty: 0.03 },
        ],
      },
      {
        id: "rec_herb_potatoes", sinceVersion: 1, name: "Herb Roasted Potatoes", category: "Sides",
        portions: 12, menuPrice: 5, targetFoodCostPct: 18, servingsPerWeek: 90,
        notes: "Batch recipe — one full sheet pan yields 12 sides.",
        components: [
          { id: g("comp"), ingredientId: "ing_russet_potato", qty: 96 },
          { id: g("comp"), ingredientId: "ing_olive_oil", qty: 6 },
          { id: g("comp"), ingredientId: "ing_butter", qty: 3 },
          { id: g("comp"), ingredientId: "ing_garlic", qty: 1 },
          { id: g("comp"), ingredientId: "ing_kosher_salt", qty: 0.6 },
          { id: g("comp"), ingredientId: "ing_black_pepper", qty: 0.2 },
        ],
      },
    ];
  }

  // ---- Events ----
  // An event is a guest count plus the dishes you're serving it, each with a
  // portions-per-guest take rate and an overage % so the pass never runs dry.
  function seedEvents() {
    const g = Calc.uid;
    return [
      {
        id: "ev_smith_wedding", sinceVersion: 1, name: "Smith Wedding Reception", date: "2026-10-11",
        guestCount: 120, pricingMode: "perGuest", pricePerGuest: 68,
        notes: "Plated dinner, guests pre-select one of two entrées. Sides served family style. Package price covers service and rentals, so food cost runs low as a % of it.",
        lines: [
          { id: g("ln"), recipeId: "rec_grilled_salmon", portionsPerGuest: 0.45, overagePct: 8 },
          { id: g("ln"), recipeId: "rec_chicken_alfredo", portionsPerGuest: 0.55, overagePct: 8 },
          { id: g("ln"), recipeId: "rec_herb_potatoes", portionsPerGuest: 1, overagePct: 10 },
        ],
        supplies: [
          { id: g("sup"), ingredientId: "ing_cutlery_kit", qtyPerGuest: 1 },
          { id: g("sup"), ingredientId: "ing_napkin", qtyPerGuest: 2 },
          { id: g("sup"), ingredientId: "ing_chafing_fuel", qtyPerGuest: 0.1 },
        ],
      },
      {
        id: "ev_corporate_lunch", sinceVersion: 1, name: "Northside Corporate Lunch", date: "2026-09-24",
        guestCount: 40, pricingMode: "menu", pricePerGuest: 0,
        notes: "Drop-off buffet, boxed individual portions. Billed at menu price per item.",
        lines: [
          { id: g("ln"), recipeId: "rec_chicken_caesar", portionsPerGuest: 0.5, overagePct: 10 },
          { id: g("ln"), recipeId: "rec_margherita_flatbread", portionsPerGuest: 0.75, overagePct: 10 },
          { id: g("ln"), recipeId: "rec_spaghetti_bolognese", portionsPerGuest: 0.4, overagePct: 10 },
        ],
        supplies: [
          { id: g("sup"), ingredientId: "ing_togo_container", qtyPerGuest: 1 },
          { id: g("sup"), ingredientId: "ing_cutlery_kit", qtyPerGuest: 1 },
          { id: g("sup"), ingredientId: "ing_napkin", qtyPerGuest: 2 },
        ],
      },
    ];
  }

  function defaultState() {
    return {
      ingredients: seedIngredients(),
      recipes: seedRecipes(),
      events: seedEvents(),
      settings: {
        defaultTargetFoodCostPct: 30,
        defaultOveragePct: 10,
      },
      seedVersion: SEED_VERSION,
    };
  }

  // Merge in any seed ingredients/recipes/events added since the state was last
  // saved, without touching anything the user has already edited or added.
  function applySeedUpdates(state) {
    const fromVersion = state.seedVersion || 1;
    if (fromVersion >= SEED_VERSION) return state;

    const mergeNew = (list, seeds) => {
      const existing = new Set(list.map((x) => x.id));
      seeds.forEach((item) => {
        if (item.sinceVersion > fromVersion && !existing.has(item.id)) list.push(item);
      });
    };

    mergeNew(state.ingredients, seedIngredients());
    mergeNew(state.recipes, seedRecipes());
    mergeNew(state.events, seedEvents());

    state.seedVersion = SEED_VERSION;
    save(state);
    return state;
  }

  // Fill in fields that older saved data (or a hand-edited import) may be missing.
  function normalize(state) {
    state.settings = state.settings || {};
    if (state.settings.defaultTargetFoodCostPct == null) state.settings.defaultTargetFoodCostPct = 30;
    if (state.settings.defaultOveragePct == null) state.settings.defaultOveragePct = 10;
    state.events = state.events || [];

    state.ingredients.forEach((i) => {
      if (i.yieldPct == null) i.yieldPct = 100;
      if (i.onHandQty == null) i.onHandQty = 0;
      if (i.parQty == null) i.parQty = 0;
    });
    state.recipes.forEach((r) => {
      if (!r.portions) r.portions = 1;
      if (r.targetFoodCostPct == null) r.targetFoodCostPct = state.settings.defaultTargetFoodCostPct;
      if (r.servingsPerWeek == null) r.servingsPerWeek = 0;
      r.components = r.components || [];
    });
    state.events.forEach((e) => {
      e.lines = e.lines || [];
      e.supplies = e.supplies || [];
      if (!e.pricingMode) e.pricingMode = "perGuest";
      if (e.pricePerGuest == null) e.pricePerGuest = 0;
    });
    return state;
  }

  function isValid(parsed) {
    return !!(parsed && Array.isArray(parsed.ingredients) && Array.isArray(parsed.recipes));
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!isValid(parsed)) return defaultState();
      return normalize(applySeedUpdates(parsed));
    } catch (e) {
      console.warn("Failed to load saved data, using defaults.", e);
      return defaultState();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Could not save data.", e);
    }
  }

  function resetToDefaults() {
    const state = defaultState();
    save(state);
    return state;
  }

  function exportJSON(state) {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    downloadBlob(blob, "none-left-on-the-plate-data.json");
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { load, save, resetToDefaults, defaultState, normalize, isValid, exportJSON, downloadBlob, KEY };
})();
