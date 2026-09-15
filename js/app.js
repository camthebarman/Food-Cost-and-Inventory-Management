/* app.js — rendering + event wiring. Depends on Calc and Storage. */

const App = (function () {
  let state = Storage.load();
  let activeEventId = state.events.length ? state.events[0].id : null;

  const MENUS = ["Appetizers", "Lunch", "Dinner"];

  const CATEGORIES = [
    "Protein", "Produce", "Dairy", "Dry Goods", "Bakery", "Pantry",
    "Spice", "Beverage", "Disposables", "Prep / Sub-Recipe", "Other",
  ];

  // ---------- generic helpers ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    });
    (children || []).forEach((c) => {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }
  function persist() { Storage.save(state); }
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { t.hidden = true; }, 2200);
  }

  function getIngredient(id) { return state.ingredients.find((i) => i.id === id); }
  function getRecipe(id) { return state.recipes.find((r) => r.id === id); }
  function getEvent(id) { return state.events.find((e) => e.id === id); }

  function menuOrder(name) {
    const i = MENUS.indexOf(name);
    return i === -1 ? MENUS.length : i;
  }

  // Dishes grouped by the menu they sit on, in service order. Any custom menu a
  // user invents sorts after the built-in three rather than disappearing.
  function groupedByMenu() {
    const groups = new Map();
    state.recipes.forEach((r) => {
      const m = r.menu || "Dinner";
      if (!groups.has(m)) groups.set(m, []);
      groups.get(m).push(r);
    });
    return Array.from(groups.entries()).sort(
      (a, b) => menuOrder(a[0]) - menuOrder(b[0]) || a[0].localeCompare(b[0])
    );
  }

  function menuOptions(current) {
    const opts = MENUS.slice();
    if (current && !opts.includes(current)) opts.push(current);
    return opts;
  }

  // Unit an ingredient's inventory is counted in — its purchase unit unless overridden.
  function countUnit(ing) { return ing.countUnit || ing.purchaseUnit; }

  // ---------- modal ----------
  function openModal(title, renderFn) {
    $("#modal-title").textContent = title;
    const body = $("#modal-body");
    body.innerHTML = "";
    renderFn(body, closeModal);
    $("#modal-overlay").hidden = false;
  }
  function closeModal() { $("#modal-overlay").hidden = true; }
  $("#modal-close").addEventListener("click", closeModal);
  $("#modal-overlay").addEventListener("click", (e) => { if (e.target === $("#modal-overlay")) closeModal(); });

  // ---------- tabs ----------
  function switchTab(name) {
    $all(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    $all(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + name));
  }
  $all(".tab-btn").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

  // ---------- header actions ----------
  function updateThemeButton() {
    const btn = $("#btn-theme-toggle");
    btn.textContent = window.Theme.effective() === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";
  }
  $("#btn-theme-toggle").addEventListener("click", () => {
    window.Theme.toggle();
    updateThemeButton();
  });
  updateThemeButton();

  $("#btn-export").addEventListener("click", () => Storage.exportJSON(state));
  $("#btn-reset").addEventListener("click", () => {
    if (confirm("Reset all data to the built-in sample kitchen? This discards your current data (export first if you want a backup).")) {
      state = Storage.resetToDefaults();
      activeEventId = state.events.length ? state.events[0].id : null;
      renderAll();
      toast("Data reset to defaults.");
    }
  });
  $("#input-import").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!Storage.isValid(parsed)) throw new Error("Missing ingredients or recipes");
        state = Storage.normalize(parsed);
        activeEventId = state.events.length ? state.events[0].id : null;
        persist();
        renderAll();
        toast("Data imported.");
      } catch (err) {
        alert("Could not import that file: " + err.message);
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  });

  // ================= INGREDIENTS =================
  function renderIngredients() {
    const panel = $("#panel-ingredients");
    panel.innerHTML = "";
    panel.append(
      el("div", { class: "panel-head" }, [
        el("div", {}, [
          el("h2", {}, ["Ingredients"]),
          el("div", { class: "sub" }, ["What you pay, how you buy it, and how much of it survives trimming — priced down to the cost per usable ounce."]),
        ]),
        el("button", { class: "btn btn-primary", onclick: () => openIngredientForm() }, ["+ Add Ingredient"]),
      ])
    );

    const wrap = el("div", { class: "card" });
    if (!state.ingredients.length) {
      wrap.append(el("div", { class: "empty-state" }, ["No ingredients yet. Add your first one."]));
      panel.append(wrap);
      return;
    }

    const table = el("table", {}, [
      el("thead", {}, [
        el("tr", {}, [
          el("th", {}, ["Ingredient"]),
          el("th", {}, ["Category"]),
          el("th", {}, ["Purchased As"]),
          el("th", { class: "num" }, ["Yield"]),
          el("th", { class: "num" }, ["Cost / Unit"]),
          el("th", { class: "num" }, ["True Cost / Usable Unit"]),
          el("th", {}, [""]),
        ]),
      ]),
    ]);
    const tbody = el("tbody");
    sortedIngredients().forEach((ing) => {
      const unit = Calc.unitLabel(ing, 1);
      const pu = Calc.purchaseUnit(ing.baseUnit, ing.purchaseUnit);
      const purchaseLabel = pu.id === "each" ? Calc.unitLabel(ing, ing.purchaseQty) : pu.label;
      const raw = Calc.costPerBaseUnit(ing);
      const usable = Calc.costPerUsableUnit(ing);
      const trimmed = Math.abs(usable - raw) > 0.0001;
      tbody.append(
        el("tr", {}, [
          el("td", {}, [el("strong", {}, [ing.name])]),
          el("td", {}, [el("span", { class: "pill" }, [ing.category])]),
          el("td", { class: "muted" }, [`${Calc.fmtQty(ing.purchaseQty)} ${purchaseLabel} for ${Calc.fmtMoney(ing.purchaseCost)}`]),
          el("td", { class: "num" }, [`${Calc.fmtQty(ing.yieldPct, 1)}%`]),
          el("td", { class: "num muted" }, [`${Calc.fmtMoney(raw)} / ${unit}`]),
          el("td", { class: "num" }, [
            el("strong", { class: trimmed ? "flag-ink" : "" }, [`${Calc.fmtMoney(usable)} / ${unit}`]),
          ]),
          el("td", {}, [
            el("div", { class: "row-actions" }, [
              el("button", { class: "btn btn-sm", onclick: () => openIngredientForm(ing.id) }, ["Edit"]),
              el("button", { class: "btn btn-sm danger", onclick: () => deleteIngredient(ing.id) }, ["Delete"]),
            ]),
          ]),
        ])
      );
    });
    table.append(tbody);
    wrap.append(el("div", { class: "table-wrap" }, [table]));
    panel.append(wrap);
  }

  function sortedIngredients() {
    return state.ingredients
      .slice()
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }

  function openIngredientForm(id) {
    const existing = id ? getIngredient(id) : null;
    openModal(existing ? "Edit Ingredient" : "Add Ingredient", (body) => {
      const draft = existing
        ? { ...existing }
        : {
            name: "", category: "Protein", baseUnit: "ozwt", purchaseUnit: "lb",
            purchaseQty: "", purchaseCost: "", yieldPct: 100, unitNoun: "",
            onHandQty: 0, parQty: 0,
          };

      // On-hand and par are typed in the count unit and only converted to base
      // units on commit — so commit before any re-render that changes the unit.
      function commitCounts() {
        const cUnit = countUnit(draft);
        if (draft._onHandInput != null) {
          draft.onHandQty = Calc.toBaseQty(draft.baseUnit, cUnit, draft._onHandInput);
          delete draft._onHandInput;
        }
        if (draft._parInput != null) {
          draft.parQty = Calc.toBaseQty(draft.baseUnit, cUnit, draft._parInput);
          delete draft._parInput;
        }
      }

      function render() {
        body.innerHTML = "";
        const purchaseOptions = Calc.purchaseUnitsFor(draft.baseUnit);
        if (!purchaseOptions.find((u) => u.id === draft.purchaseUnit)) draft.purchaseUnit = purchaseOptions[0].id;

        const form = el("form", {}, [
          field("Name", el("input", { type: "text", required: "required", value: draft.name, oninput: (e) => (draft.name = e.target.value) })),
          fieldRow([
            field("Category", selectEl(CATEGORIES, draft.category, (v) => (draft.category = v))),
            field(
              "Measured By",
              selectEl(
                Object.entries(Calc.BASE_UNITS).map(([id, u]) => ({ id, label: u.long })),
                draft.baseUnit,
                (v) => { commitCounts(); draft.baseUnit = v; delete draft.countUnit; render(); },
                true
              )
            ),
          ]),
          draft.baseUnit === "each"
            ? field(
                "Unit Name (optional)",
                el("input", { type: "text", placeholder: "bun, egg, lemon, container…", value: draft.unitNoun || "", oninput: (e) => (draft.unitNoun = e.target.value) }),
                "Used in recipes and prep lists: “2 buns” instead of “2 each”."
              )
            : null,

          el("div", { class: "section-title" }, ["How it's purchased"]),
          fieldRow([
            field("Quantity", el("input", { type: "number", step: "any", min: "0", required: "required", value: draft.purchaseQty, oninput: (e) => { draft.purchaseQty = e.target.value; refreshHint(); } })),
            field(
              "Unit",
              selectEl(
                purchaseOptions.map((u) => ({ id: u.id, label: u.label })),
                draft.purchaseUnit,
                (v) => { draft.purchaseUnit = v; refreshHint(); },
                true
              )
            ),
            field("Total Cost ($)", el("input", { type: "number", step: "any", min: "0", required: "required", value: draft.purchaseCost, oninput: (e) => { draft.purchaseCost = e.target.value; refreshHint(); } })),
          ]),
          field(
            "Yield % (usable after trim / waste)",
            el("input", { type: "number", step: "any", min: "1", max: "100", value: draft.yieldPct, oninput: (e) => { draft.yieldPct = e.target.value; refreshHint(); } }),
            "100% for buns or canned goods; ~80% for romaine you core and trim; ~88% for salmon you portion."
          ),
          el("p", { class: "hint", id: "ing-cost-hint" }, [costHint()]),

          el("div", { class: "section-title" }, ["Inventory on hand"]),
          fieldRow([
            field(
              "On Hand",
              el("input", {
                type: "number", step: "any", min: "0",
                value: Calc.fmtQty(Calc.fromBaseQty(draft.baseUnit, countUnit(draft), draft.onHandQty), 3),
                oninput: (e) => (draft._onHandInput = e.target.value),
              })
            ),
            field(
              "Par Level",
              el("input", {
                type: "number", step: "any", min: "0",
                value: Calc.fmtQty(Calc.fromBaseQty(draft.baseUnit, countUnit(draft), draft.parQty), 3),
                oninput: (e) => (draft._parInput = e.target.value),
              })
            ),
            field(
              "Counted In",
              selectEl(
                purchaseOptions.map((u) => ({ id: u.id, label: u.id === "each" ? Calc.unitLabel(draft, 2) || u.label : u.label })),
                countUnit(draft),
                (v) => { commitCounts(); draft.countUnit = v; render(); },
                true
              )
            ),
          ]),
          el("p", { class: "hint" }, ["Par is the level you want to keep on the shelf — anything below it shows up as a reorder on the Inventory tab."]),

          el("div", { class: "form-actions" }, [
            el("button", { type: "button", class: "btn", onclick: closeModal }, ["Cancel"]),
            el("button", { type: "submit", class: "btn btn-primary" }, [existing ? "Save Changes" : "Add Ingredient"]),
          ]),
        ]);

        function costHint() {
          const unit = Calc.BASE_UNITS[draft.baseUnit].label;
          const raw = Calc.costPerBaseUnit(draft);
          const usable = Calc.costPerUsableUnit(draft);
          return `≈ ${Calc.fmtMoney(raw)} per ${unit} as purchased → ${Calc.fmtMoney(usable)} per usable ${unit}. Recipes are priced at the usable cost.`;
        }
        function refreshHint() {
          const hint = $("#ing-cost-hint", form);
          if (hint) hint.textContent = costHint();
        }

        form.addEventListener("submit", (e) => {
          e.preventDefault();
          if (!draft.name.trim()) return;
          draft.purchaseQty = Number(draft.purchaseQty) || 0;
          draft.purchaseCost = Number(draft.purchaseCost) || 0;
          draft.yieldPct = Math.min(Math.max(Number(draft.yieldPct) || 100, 1), 100);
          commitCounts();
          if (draft.baseUnit !== "each") delete draft.unitNoun;

          if (existing) {
            Object.assign(existing, draft);
          } else {
            draft.id = Calc.uid("ing");
            state.ingredients.push(draft);
          }
          persist();
          renderAll();
          closeModal();
          toast(existing ? "Ingredient updated." : "Ingredient added.");
        });
        body.append(form);
      }
      render();
    });
  }

  function deleteIngredient(id) {
    const usedIn = state.recipes.filter((r) => r.components.some((c) => c.ingredientId === id));
    const suppliedTo = state.events.filter((e) => (e.supplies || []).some((s) => s.ingredientId === id));
    if (usedIn.length || suppliedTo.length) {
      const where = usedIn.map((r) => r.name).concat(suppliedTo.map((e) => e.name)).join(", ");
      alert(`Can't delete — still used in: ${where}. Remove it there first.`);
      return;
    }
    if (!confirm("Delete this ingredient?")) return;
    state.ingredients = state.ingredients.filter((i) => i.id !== id);
    persist();
    renderAll();
    toast("Ingredient deleted.");
  }

  // ================= RECIPES =================
  function renderRecipes() {
    const panel = $("#panel-recipes");
    panel.innerHTML = "";
    panel.append(
      el("div", { class: "panel-head" }, [
        el("div", {}, [
          el("h2", {}, ["Recipes"]),
          el("div", { class: "sub" }, ["Plate cost per serving, suggested menu price, and how many servings your inventory can still produce."]),
        ]),
        el("button", { class: "btn btn-primary", onclick: () => openRecipeForm() }, ["+ Add Recipe"]),
      ])
    );

    if (!state.recipes.length) {
      panel.append(el("div", { class: "card empty-state" }, ["No recipes yet. Add your first dish."]));
      return;
    }

    groupedByMenu().forEach(([menu, dishes]) => {
      const priced = dishes.filter((r) => r.menuPrice);
      const avgPct = priced.length
        ? priced.reduce((sum, r) => sum + Calc.foodCostPct(Calc.recipeCost(r, getIngredient), r.menuPrice), 0) / priced.length
        : null;
      panel.append(
        el("div", { class: "menu-head" }, [
          el("h3", {}, [menu]),
          el("span", { class: "muted" }, [
            `${dishes.length} dish${dishes.length === 1 ? "" : "es"}${avgPct == null ? "" : ` · avg food cost ${Calc.fmtPct(avgPct)}`}`,
          ]),
        ])
      );
      dishes.forEach((r) => panel.append(renderRecipeCard(r)));
    });
  }

  function renderRecipeCard(recipe) {
    const portions = Calc.portionsPerBatch(recipe);
    const batchCost = Calc.recipeBatchCost(recipe, getIngredient);
    const cost = Calc.recipeCost(recipe, getIngredient);
    const suggested = Calc.suggestedPrice(cost, recipe.targetFoodCostPct);
    const actualPct = Calc.foodCostPct(cost, recipe.menuPrice);
    const profit = Calc.grossProfit(cost, recipe.menuPrice);
    const avail = Calc.maxPortions(recipe, getIngredient);

    let pillClass = "good";
    if (recipe.menuPrice) {
      if (actualPct > recipe.targetFoodCostPct + 5) pillClass = "bad";
      else if (actualPct > recipe.targetFoodCostPct) pillClass = "warn";
    }

    const card = el("div", { class: "card recipe-card" }, [
      el("div", { class: "recipe-card-head" }, [
        el("div", {}, [
          el("h3", {}, [recipe.name]),
          el("div", { class: "recipe-meta" }, [
            `${recipe.menu || "Dinner"} · ${recipe.category || "Uncategorized"} · ${portions > 1 ? `batch of ${Calc.fmtQty(portions)} servings (batch cost ${Calc.fmtMoney(batchCost)})` : "single serving"}`,
          ]),
        ]),
        el("div", { class: "row-actions" }, [
          el("button", { class: "btn btn-sm", onclick: () => openRecipeForm(recipe.id) }, ["Edit"]),
          el("button", { class: "btn btn-sm danger", onclick: () => deleteRecipe(recipe.id) }, ["Delete"]),
        ]),
      ]),
    ]);

    // Left: component breakdown
    const list = el("ul", { class: "breakdown-list" });
    recipe.components.forEach((c) => {
      const ing = getIngredient(c.ingredientId);
      if (!ing) return;
      const lineCost = Calc.componentCost(ing, c.qty);
      const perPortion = Calc.componentQtyPerPortion(recipe, c);
      list.append(
        el("li", {}, [
          el("span", {}, [
            `${ing.name} — ${Calc.fmtQty(c.qty, 3)} ${Calc.unitLabel(ing, c.qty)}`,
            portions > 1 ? el("span", { class: "muted" }, [` (${Calc.fmtQty(perPortion, 3)} / serving)`]) : null,
          ]),
          el("span", {}, [Calc.fmtMoney(lineCost)]),
        ])
      );
    });
    if (!recipe.components.length) list.append(el("li", {}, [el("span", { class: "muted" }, ["No components added yet."])]));

    const left = el("div", {}, [
      el("div", { class: "section-title" }, [portions > 1 ? "Batch Cost Breakdown" : "Plate Cost Breakdown"]),
      list,
      recipe.notes ? el("p", { class: "muted", style: "margin-top:10px" }, [recipe.notes]) : null,
    ]);

    const right = el("div", {}, [
      el("div", { class: "section-title" }, ["Food Cost Summary"]),
      el("div", { class: "grid grid-2", style: "gap:10px" }, [
        statMini("Plate Cost / Serving", Calc.fmtMoney(cost)),
        statMini(`Suggested Price (@${Calc.fmtQty(recipe.targetFoodCostPct)}%)`, Calc.fmtMoney(suggested)),
        statMini("Menu Price", recipe.menuPrice ? Calc.fmtMoney(recipe.menuPrice) : "—"),
        statMini("Gross Profit / Serving", recipe.menuPrice ? Calc.fmtMoney(profit) : "—"),
      ]),
      recipe.menuPrice
        ? el("div", { class: "callout " + pillClass, style: "margin-top:12px" }, [
            `Actual food cost: ${Calc.fmtPct(actualPct)} (target ${Calc.fmtQty(recipe.targetFoodCostPct)}%) · margin ${Calc.fmtPct(Calc.marginPct(cost, recipe.menuPrice))}`,
          ])
        : el("div", { class: "callout warn", style: "margin-top:12px" }, ["Set a menu price to see actual food cost %."]),
      el("div", { class: "callout " + availClass(avail.portions), style: "margin-top:0" }, [
        availText(avail),
      ]),
    ]);

    card.append(el("div", { class: "recipe-card-body two-col" }, [left, right]));
    return card;
  }

  function availClass(portions) {
    if (portions <= 0) return "bad";
    if (portions < 10) return "warn";
    return "good";
  }

  function availText(avail) {
    if (avail.unlimited) return "Add components to see how many servings inventory can cover.";
    if (avail.portions <= 0) {
      return avail.limitedBy
        ? `0 servings available — out of ${avail.limitedBy.name}.`
        : "0 servings available.";
    }
    return `${avail.portions} serving${avail.portions === 1 ? "" : "s"} available from inventory on hand${avail.limitedBy ? ` — limited by ${avail.limitedBy.name}` : ""}.`;
  }

  function statMini(label, value) {
    return el("div", { class: "stat-card" }, [
      el("div", { class: "label" }, [label]),
      el("div", { class: "value small" }, [value]),
    ]);
  }

  function openRecipeForm(id) {
    const existing = id ? getRecipe(id) : null;
    openModal(existing ? "Edit Recipe" : "Add Recipe", (body) => {
      const draft = existing
        ? JSON.parse(JSON.stringify(existing))
        : {
            name: "", category: "", menu: "Dinner", portions: 1, menuPrice: "",
            targetFoodCostPct: state.settings.defaultTargetFoodCostPct || 30,
            servingsPerWeek: "", notes: "", components: [],
          };

      function render() {
        body.innerHTML = "";
        const form = el("form", {});
        form.append(
          field("Recipe Name", el("input", { type: "text", required: "required", value: draft.name, oninput: (e) => (draft.name = e.target.value) })),
          fieldRow([
            field(
              "Menu",
              selectEl(menuOptions(draft.menu), draft.menu || "Dinner", (v) => (draft.menu = v), true),
              "Which menu this dish is sold on — drives the Recipes grouping and the Insights breakdown."
            ),
            field("Category (optional)", el("input", { type: "text", placeholder: "Entrées, Sides, Pasta…", value: draft.category || "", oninput: (e) => (draft.category = e.target.value) })),
            field(
              "Batch Yield (servings)",
              el("input", { type: "number", step: "any", min: "1", required: "required", value: draft.portions, oninput: (e) => { draft.portions = e.target.value; render(); } }),
              "1 for a plated dish; 8 if the quantities below make eight servings."
            ),
          ])
        );

        const compSection = el("div", {}, [
          el("div", { class: "section-title" }, [
            Calc.portionsPerBatch(draft) > 1 ? "Components (quantities per batch)" : "Components (quantities per serving)",
          ]),
        ]);
        if (!draft.components.length) {
          compSection.append(el("p", { class: "muted" }, ["No components yet — add one below."]));
        }
        draft.components.forEach((comp, idx) => {
          const ing = getIngredient(comp.ingredientId);
          compSection.append(
            el("div", { class: "component-row" }, [
              field(
                idx === 0 ? "Ingredient" : "",
                selectEl(
                  state.ingredients.map((i) => ({ id: i.id, label: `${i.name} (${i.category})` })),
                  comp.ingredientId,
                  (v) => { comp.ingredientId = v; render(); }
                )
              ),
              field(
                `Qty (${ing ? Calc.unitLabel(ing, comp.qty) : "unit"})`,
                el("input", { type: "number", step: "any", min: "0", value: comp.qty, oninput: (e) => { comp.qty = e.target.value; refreshCostLine(); }, onchange: () => render() })
              ),
              field(idx === 0 ? "Line Cost" : "", el("input", { type: "text", disabled: "disabled", value: Calc.fmtMoney(Calc.componentCost(ing, comp.qty)) })),
              el("button", { type: "button", class: "btn btn-sm danger btn-icon", title: "Remove", onclick: () => { draft.components.splice(idx, 1); render(); } }, ["✕"]),
            ])
          );
        });
        compSection.append(
          el(
            "button",
            {
              type: "button", class: "btn btn-sm", style: "margin-top:8px",
              onclick: () => {
                draft.components.push({ id: Calc.uid("comp"), ingredientId: state.ingredients[0] ? state.ingredients[0].id : "", qty: 0 });
                render();
              },
            },
            ["+ Add Component"]
          )
        );
        form.append(compSection);

        form.append(
          el("div", { class: "section-title" }, ["Pricing"]),
          fieldRow([
            field("Menu Price ($ per serving)", el("input", { type: "number", step: "any", min: "0", value: draft.menuPrice, oninput: (e) => (draft.menuPrice = e.target.value) })),
            field("Target Food Cost %", el("input", { type: "number", step: "any", min: "0", max: "100", value: draft.targetFoodCostPct, oninput: (e) => { draft.targetFoodCostPct = e.target.value; refreshCostLine(); } })),
          ]),
          el("p", { class: "hint", id: "recipe-cost-line" }, [costLineText()]),

          el("div", { class: "section-title" }, ["Usage"]),
          field(
            "Estimated servings / week",
            el("input", { type: "number", step: "any", min: "0", value: draft.servingsPerWeek, oninput: (e) => (draft.servingsPerWeek = e.target.value) }),
            "Drives the weekly / monthly / annual projections on the Usage tab."
          ),
          field("Prep Notes (optional)", el("input", { type: "text", value: draft.notes || "", oninput: (e) => (draft.notes = e.target.value) })),

          el("div", { class: "form-actions" }, [
            el("button", { type: "button", class: "btn", onclick: closeModal }, ["Cancel"]),
            el("button", { type: "submit", class: "btn btn-primary" }, [existing ? "Save Changes" : "Add Recipe"]),
          ])
        );

        function costLineText() {
          const plate = Calc.recipeCost(draft, getIngredient);
          const sp = Calc.suggestedPrice(plate, draft.targetFoodCostPct);
          const batch = Calc.recipeBatchCost(draft, getIngredient);
          const batchNote = Calc.portionsPerBatch(draft) > 1 ? `Batch cost ${Calc.fmtMoney(batch)} → ` : "";
          return `${batchNote}plate cost ${Calc.fmtMoney(plate)} — suggested price at ${Calc.fmtQty(draft.targetFoodCostPct) || 0}% food cost: ${Calc.fmtMoney(sp)}`;
        }
        function refreshCostLine() {
          const line = $("#recipe-cost-line", form);
          if (line) line.textContent = costLineText();
        }

        form.addEventListener("submit", (e) => {
          e.preventDefault();
          if (!draft.name.trim()) return;
          draft.portions = Math.max(Number(draft.portions) || 1, 0.0001);
          draft.menuPrice = draft.menuPrice === "" ? "" : Number(draft.menuPrice);
          draft.targetFoodCostPct = Number(draft.targetFoodCostPct) || 0;
          draft.servingsPerWeek = Number(draft.servingsPerWeek) || 0;
          draft.components = draft.components
            .filter((c) => c.ingredientId)
            .map((c) => ({ ...c, qty: Number(c.qty) || 0 }));

          if (existing) {
            Object.assign(existing, draft);
          } else {
            draft.id = Calc.uid("rec");
            state.recipes.push(draft);
          }
          persist();
          renderAll();
          closeModal();
          toast(existing ? "Recipe updated." : "Recipe added.");
        });

        body.append(form);
      }
      render();
    });
  }

  function deleteRecipe(id) {
    const usedIn = state.events.filter((e) => (e.lines || []).some((l) => l.recipeId === id));
    if (usedIn.length) {
      alert(`Can't delete — this dish is on the menu for: ${usedIn.map((e) => e.name).join(", ")}. Remove it from those events first.`);
      return;
    }
    if (!confirm("Delete this recipe?")) return;
    state.recipes = state.recipes.filter((r) => r.id !== id);
    persist();
    renderAll();
    toast("Recipe deleted.");
  }

  // ================= INVENTORY =================
  function renderInventory() {
    const panel = $("#panel-inventory");
    panel.innerHTML = "";
    panel.append(
      el("div", { class: "panel-head" }, [
        el("div", {}, [
          el("h2", {}, ["Inventory"]),
          el("div", { class: "sub" }, ["Count what's on the shelf, set par levels, and see how many servings of each dish you can still send out."]),
        ]),
        el("button", { class: "btn", onclick: fillAllToPar }, ["Fill All To Par"]),
      ])
    );

    const belowPar = state.ingredients.filter(Calc.belowPar);
    const totalValue = state.ingredients.reduce((s, i) => s + Calc.inventoryValue(i), 0);
    const reorderCost = belowPar.reduce((s, i) => {
      const pack = Calc.packBaseQty(i);
      const short = (Number(i.parQty) || 0) - (Number(i.onHandQty) || 0);
      const packs = pack > 0 ? Math.ceil(short / pack) : 0;
      return s + packs * (Number(i.purchaseCost) || 0);
    }, 0);

    panel.append(
      el("div", { class: "grid grid-4" }, [
        statCard("Inventory Value", Calc.fmtMoney(totalValue)),
        statCard("Items Tracked", state.ingredients.length),
        statCard("Below Par", belowPar.length),
        statCard("Est. Reorder Cost", Calc.fmtMoney(reorderCost)),
      ])
    );

    // What the shelf can actually produce right now.
    const availCard = el("div", { class: "card" }, [
      el("h3", {}, ["Servings Available Now"]),
      el("div", { class: "sub", style: "margin-bottom:10px" }, ["The most servings of each dish you could make from current inventory, and the ingredient that runs out first."]),
    ]);
    if (!state.recipes.length) {
      availCard.append(el("div", { class: "empty-state" }, ["Add recipes to see what inventory can cover."]));
    } else {
      const table = el("table", {}, [
        el("thead", {}, [
          el("tr", {}, [
            el("th", {}, ["Dish"]),
            el("th", { class: "num" }, ["Servings Available"]),
            el("th", {}, ["Limited By"]),
            el("th", { class: "num" }, ["Days of Cover"]),
            el("th", {}, ["Status"]),
          ]),
        ]),
      ]);
      const tbody = el("tbody");
      state.recipes
        .map((r) => ({ r, avail: Calc.maxPortions(r, getIngredient) }))
        .sort((a, b) => a.avail.portions - b.avail.portions)
        .forEach(({ r, avail }) => {
          const cover = Calc.daysOfCover(avail.portions, r.servingsPerWeek);
          tbody.append(
            el("tr", {}, [
              el("td", {}, [el("strong", {}, [r.name])]),
              el("td", { class: "num" }, [String(avail.portions)]),
              el("td", { class: "muted" }, [avail.limitedBy ? avail.limitedBy.name : "—"]),
              el("td", { class: "num" }, [cover == null ? "—" : Calc.fmtNum(cover, 1)]),
              el("td", {}, [
                el("span", { class: "pill " + availClass(avail.portions) }, [
                  avail.portions <= 0 ? "Can't make" : avail.portions < 10 ? "Running low" : "Covered",
                ]),
              ]),
            ])
          );
        });
      table.append(tbody);
      availCard.append(el("div", { class: "table-wrap" }, [table]));
    }
    panel.append(availCard);

    // The count sheet itself.
    const countCard = el("div", { class: "card" }, [
      el("h3", {}, ["Count Sheet"]),
      el("div", { class: "sub", style: "margin-bottom:10px" }, ["Type counts in whatever unit you count in — cases, pounds, each. Everything else converts automatically."]),
    ]);
    if (!state.ingredients.length) {
      countCard.append(el("div", { class: "empty-state" }, ["Add ingredients to start counting."]));
      panel.append(countCard);
      return;
    }

    const table = el("table", {}, [
      el("thead", {}, [
        el("tr", {}, [
          el("th", {}, ["Ingredient"]),
          el("th", {}, ["Category"]),
          el("th", { class: "num" }, ["On Hand"]),
          el("th", { class: "num" }, ["Par"]),
          el("th", {}, ["Unit"]),
          el("th", { class: "num" }, ["Value"]),
          el("th", {}, ["Status"]),
          el("th", {}, [""]),
        ]),
      ]),
    ]);
    const tbody = el("tbody");
    sortedIngredients().forEach((ing) => {
      const unit = countUnit(ing);
      const low = Calc.belowPar(ing);
      const out = (Number(ing.onHandQty) || 0) <= 0;
      tbody.append(
        el("tr", { class: out ? "row-bad" : low ? "row-warn" : "" }, [
          el("td", {}, [el("strong", {}, [ing.name])]),
          el("td", {}, [el("span", { class: "pill" }, [ing.category])]),
          el("td", { class: "num" }, [
            el("input", {
              class: "inline-input num", type: "number", step: "any", min: "0",
              value: Calc.fmtQty(Calc.fromBaseQty(ing.baseUnit, unit, ing.onHandQty), 3),
              oninput: (e) => { ing.onHandQty = Calc.toBaseQty(ing.baseUnit, unit, e.target.value); persist(); },
              onchange: () => { renderInventory(); renderRecipes(); renderDashboard(); renderUsage(); renderEvents(); },
            }),
          ]),
          el("td", { class: "num" }, [
            el("input", {
              class: "inline-input num", type: "number", step: "any", min: "0",
              value: Calc.fmtQty(Calc.fromBaseQty(ing.baseUnit, unit, ing.parQty), 3),
              oninput: (e) => { ing.parQty = Calc.toBaseQty(ing.baseUnit, unit, e.target.value); persist(); },
              onchange: () => renderInventory(),
            }),
          ]),
          el("td", {}, [
            selectEl(
              Calc.purchaseUnitsFor(ing.baseUnit).map((u) => ({ id: u.id, label: u.id === "each" ? Calc.unitLabel(ing, 2) || u.label : u.label })),
              unit,
              (v) => { ing.countUnit = v; persist(); renderInventory(); }
            ),
          ]),
          el("td", { class: "num" }, [Calc.fmtMoney(Calc.inventoryValue(ing))]),
          el("td", {}, [
            out
              ? el("span", { class: "pill bad" }, ["Out"])
              : low
              ? el("span", { class: "pill warn" }, ["Reorder"])
              : el("span", { class: "pill good" }, ["OK"]),
          ]),
          el("td", {}, [
            el("div", { class: "row-actions" }, [
              el("button", { class: "btn btn-sm", title: "Set on hand up to par", onclick: () => fillToPar(ing.id) }, ["To Par"]),
            ]),
          ]),
        ])
      );
    });
    table.append(tbody);
    countCard.append(el("div", { class: "table-wrap" }, [table]));
    panel.append(countCard);
  }

  function fillToPar(id) {
    const ing = getIngredient(id);
    if (!ing) return;
    if ((Number(ing.parQty) || 0) <= 0) {
      toast("Set a par level for this item first.");
      return;
    }
    if ((Number(ing.onHandQty) || 0) < ing.parQty) ing.onHandQty = ing.parQty;
    persist();
    renderAll();
    toast(`${ing.name} topped up to par.`);
  }

  function fillAllToPar() {
    const low = state.ingredients.filter(Calc.belowPar);
    if (!low.length) {
      toast("Nothing is below par.");
      return;
    }
    if (!confirm(`Top ${low.length} item${low.length === 1 ? "" : "s"} up to par? Use this after a delivery is put away.`)) return;
    low.forEach((i) => (i.onHandQty = i.parQty));
    persist();
    renderAll();
    toast(`${low.length} item${low.length === 1 ? "" : "s"} topped up to par.`);
  }

  // ================= USAGE =================
  function renderUsage() {
    const panel = $("#panel-usage");
    panel.innerHTML = "";
    panel.append(
      el("div", { class: "panel-head" }, [
        el("div", {}, [
          el("h2", {}, ["Usage"]),
          el("div", { class: "sub" }, ["Guesstimate weekly servings per dish and see the weekly, monthly, and annual cost, revenue, and profit it adds up to."]),
        ]),
      ])
    );

    if (!state.recipes.length) {
      panel.append(el("div", { class: "card empty-state" }, ["Add recipes first to project usage."]));
      return;
    }

    let totalWeeklyCost = 0, totalWeeklyRevenue = 0;
    const rows = state.recipes.map((r) => {
      const cost = Calc.recipeCost(r, getIngredient);
      const proj = Calc.periodProjection(cost, r.menuPrice, r.servingsPerWeek);
      totalWeeklyCost += proj.weekly.cost;
      totalWeeklyRevenue += proj.weekly.revenue;
      return { r, cost, proj };
    });

    panel.append(
      el("div", { class: "grid grid-4" }, [
        statCard("Weekly Food Cost", Calc.fmtMoney(totalWeeklyCost)),
        statCard("Weekly Revenue", Calc.fmtMoney(totalWeeklyRevenue)),
        statCard("Weekly Profit", Calc.fmtMoney(totalWeeklyRevenue - totalWeeklyCost)),
        statCard("Annual Profit", Calc.fmtMoney((totalWeeklyRevenue - totalWeeklyCost) * 52)),
      ])
    );

    rows.forEach(({ r, cost, proj }) => {
      const avail = Calc.maxPortions(r, getIngredient);
      const cover = Calc.daysOfCover(avail.portions, r.servingsPerWeek);
      const card = el("div", { class: "card" });
      card.append(
        el("div", { class: "card-head-row" }, [
          el("h3", {}, [r.name]),
          el("span", { class: "muted" }, [
            `Plate cost ${Calc.fmtMoney(cost)} · menu ${r.menuPrice ? Calc.fmtMoney(r.menuPrice) : "—"} · ${avail.portions} serving${avail.portions === 1 ? "" : "s"} on hand${cover == null ? "" : ` (${Calc.fmtNum(cover, 1)} days of cover)`}`,
          ]),
        ])
      );

      card.append(
        field(
          "Servings / week",
          el("input", {
            type: "number", step: "any", min: "0", value: r.servingsPerWeek,
            oninput: (e) => { r.servingsPerWeek = Number(e.target.value) || 0; persist(); },
            onchange: () => { renderUsage(); renderDashboard(); renderInventory(); renderInsights(); },
          })
        )
      );

      const table = el("table", { style: "margin-top:12px" }, [
        el("thead", {}, [
          el("tr", {}, [
            el("th", {}, ["Period"]),
            el("th", { class: "num" }, ["Servings"]),
            el("th", { class: "num" }, ["Food Cost"]),
            el("th", { class: "num" }, ["Revenue"]),
            el("th", { class: "num" }, ["Profit"]),
          ]),
        ]),
        el("tbody", {}, [
          projRow("Weekly", proj.weekly),
          projRow("Monthly", proj.monthly),
          projRow("Annual", proj.annual),
        ]),
      ]);
      card.append(el("div", { class: "table-wrap" }, [table]));
      panel.append(card);
    });
  }

  function projRow(label, data) {
    return el("tr", {}, [
      el("td", {}, [label]),
      el("td", { class: "num" }, [Calc.fmtNum(data.servings, 0)]),
      el("td", { class: "num" }, [Calc.fmtMoney(data.cost)]),
      el("td", { class: "num" }, [Calc.fmtMoney(data.revenue)]),
      el("td", { class: "num" }, [Calc.fmtMoney(data.profit)]),
    ]);
  }

  // ================= EVENTS =================
  // Portions to prep for one menu line of an event.
  function linePortions(ev, line) {
    return Calc.eventPortions(ev.guestCount, line.portionsPerGuest, line.overagePct);
  }

  // Total quantity of a per-guest supply item (napkins, cutlery, to-go boxes).
  function supplyQty(ev, sup) {
    return Math.ceil((Number(ev.guestCount) || 0) * (Number(sup.qtyPerGuest) || 0));
  }

  // Everything the event needs, rolled up per ingredient: dish components + supplies.
  function eventRequirements(ev) {
    const lists = [];
    (ev.lines || []).forEach((line) => {
      const recipe = getRecipe(line.recipeId);
      if (!recipe) return;
      lists.push(Calc.portionRequirements(recipe, linePortions(ev, line), getIngredient));
    });

    const supplyReqs = [];
    (ev.supplies || []).forEach((sup) => {
      const ing = getIngredient(sup.ingredientId);
      if (!ing) return;
      const qty = supplyQty(ev, sup);
      supplyReqs.push({
        ingredient: ing,
        usableQty: qty,
        asPurchasedQty: qty / Calc.yieldFactor(ing),
        cost: Calc.componentCost(ing, qty),
      });
    });
    if (supplyReqs.length) lists.push(supplyReqs);

    return Calc.aggregateRequirements(lists);
  }

  function eventTotals(ev) {
    const guests = Number(ev.guestCount) || 0;
    let foodCost = 0, menuRevenue = 0, portions = 0;
    (ev.lines || []).forEach((line) => {
      const recipe = getRecipe(line.recipeId);
      if (!recipe) return;
      const p = linePortions(ev, line);
      foodCost += Calc.recipeCost(recipe, getIngredient) * p;
      menuRevenue += (Number(recipe.menuPrice) || 0) * p;
      portions += p;
    });

    let supplyCost = 0;
    (ev.supplies || []).forEach((sup) => {
      const ing = getIngredient(sup.ingredientId);
      if (!ing) return;
      supplyCost += Calc.componentCost(ing, supplyQty(ev, sup));
    });

    const totalCost = foodCost + supplyCost;
    const revenue = ev.pricingMode === "perGuest" ? guests * (Number(ev.pricePerGuest) || 0) : menuRevenue;
    return {
      guests, portions, foodCost, supplyCost, totalCost, revenue,
      profit: revenue - totalCost,
      costPct: revenue ? (totalCost / revenue) * 100 : 0,
      costPerGuest: guests ? totalCost / guests : 0,
      revenuePerGuest: guests ? revenue / guests : 0,
    };
  }

  function renderEvents() {
    const panel = $("#panel-events");
    panel.innerHTML = "";
    panel.append(
      el("div", { class: "panel-head" }, [
        el("div", {}, [
          el("h2", {}, ["Events"]),
          el("div", { class: "sub" }, ["Plan a catered meal or pre-numbered event: set the guest count, pick the menu, and get prep quantities, a shopping list, and the margin before you commit."]),
        ]),
        el("button", { class: "btn btn-primary", onclick: () => openEventForm() }, ["+ New Event"]),
      ])
    );

    if (!state.events.length) {
      panel.append(el("div", { class: "card empty-state" }, ["No events yet. Create one to plan quantities for a catered meal or a ticketed dinner."]));
      return;
    }

    if (!getEvent(activeEventId)) activeEventId = state.events[0].id;

    const chips = el("div", { class: "chip-row" });
    state.events.forEach((ev) => {
      const t = eventTotals(ev);
      chips.append(
        el("button", {
          class: "chip" + (ev.id === activeEventId ? " active" : ""),
          onclick: () => { activeEventId = ev.id; renderEvents(); },
        }, [`${ev.name} · ${t.guests} guests`])
      );
    });
    panel.append(chips);

    const ev = getEvent(activeEventId);
    panel.append(renderEventSummary(ev));
    panel.append(renderEventMenu(ev));
    panel.append(renderEventSupplies(ev));
    panel.append(renderEventShoppingList(ev));
  }

  function renderEventSummary(ev) {
    const t = eventTotals(ev);
    let pctClass = "good";
    if (!t.revenue) pctClass = "warn";
    else if (t.costPct > 40) pctClass = "bad";
    else if (t.costPct > 32) pctClass = "warn";

    const card = el("div", { class: "card" }, [
      el("div", { class: "card-head-row" }, [
        el("div", {}, [
          el("h3", {}, [ev.name]),
          el("div", { class: "recipe-meta" }, [
            [ev.date || "No date set", `${t.guests} guests`,
             ev.pricingMode === "perGuest" ? `${Calc.fmtMoney(ev.pricePerGuest)} / guest` : "billed at menu prices",
            ].join(" · "),
          ]),
        ]),
        el("div", { class: "row-actions" }, [
          el("button", { class: "btn btn-sm", onclick: () => openEventForm(ev.id) }, ["Edit"]),
          el("button", { class: "btn btn-sm", onclick: () => duplicateEvent(ev.id) }, ["Duplicate"]),
          el("button", { class: "btn btn-sm danger", onclick: () => deleteEvent(ev.id) }, ["Delete"]),
        ]),
      ]),
      el("div", { class: "grid grid-4", style: "margin-top:12px" }, [
        statMini("Portions To Prep", Calc.fmtNum(t.portions, 0)),
        statMini("Food Cost", Calc.fmtMoney(t.foodCost)),
        statMini("Supplies Cost", Calc.fmtMoney(t.supplyCost)),
        statMini("Total Cost", Calc.fmtMoney(t.totalCost)),
      ]),
      el("div", { class: "grid grid-4", style: "margin-top:12px" }, [
        statMini("Revenue", Calc.fmtMoney(t.revenue)),
        statMini("Profit", Calc.fmtMoney(t.profit)),
        statMini("Cost / Guest", Calc.fmtMoney(t.costPerGuest)),
        statMini("Revenue / Guest", Calc.fmtMoney(t.revenuePerGuest)),
      ]),
      el("div", { class: "callout " + pctClass, style: "margin-top:14px;margin-bottom:0" }, [
        t.revenue
          ? `Event cost is ${Calc.fmtPct(t.costPct)} of revenue — ${Calc.fmtMoney(t.profit)} profit at ${t.guests} guests.`
          : "Set a per-guest price (or menu prices on the dishes) to see the event's margin.",
      ]),
      ev.notes ? el("p", { class: "muted", style: "margin:10px 0 0" }, [ev.notes]) : null,
    ]);
    return card;
  }

  function renderEventMenu(ev) {
    const card = el("div", { class: "card" }, [
      el("div", { class: "card-head-row" }, [
        el("div", {}, [
          el("h3", {}, ["Event Menu & Prep Quantities"]),
          el("div", { class: "sub" }, ["Portions per guest is the take rate — 0.5 means half the room orders it. Overage pads the count so you don't run out."]),
        ]),
        el("button", { class: "btn btn-sm btn-primary", onclick: () => addEventLine(ev.id) }, ["+ Add Dish"]),
      ]),
    ]);

    if (!(ev.lines || []).length) {
      card.append(el("div", { class: "empty-state" }, ["No dishes on this event yet."]));
      return card;
    }

    const table = el("table", { style: "margin-top:10px" }, [
      el("thead", {}, [
        el("tr", {}, [
          el("th", {}, ["Dish"]),
          el("th", { class: "num" }, ["Portions / Guest"]),
          el("th", { class: "num" }, ["Overage %"]),
          el("th", { class: "num" }, ["Portions To Prep"]),
          el("th", { class: "num" }, ["Batches"]),
          el("th", { class: "num" }, ["Plate Cost"]),
          el("th", { class: "num" }, ["Line Cost"]),
          el("th", { class: "num" }, ["On Hand"]),
          el("th", {}, [""]),
        ]),
      ]),
    ]);
    const tbody = el("tbody");

    (ev.lines || []).forEach((line, idx) => {
      const recipe = getRecipe(line.recipeId);
      if (!recipe) {
        tbody.append(
          el("tr", {}, [
            el("td", { class: "muted", colspan: "8" }, ["Deleted dish — remove this line."]),
            el("td", {}, [el("button", { class: "btn btn-sm danger btn-icon", onclick: () => removeEventLine(ev.id, idx) }, ["✕"])]),
          ])
        );
        return;
      }
      const portions = linePortions(ev, line);
      const perBatch = Calc.portionsPerBatch(recipe);
      const plateCost = Calc.recipeCost(recipe, getIngredient);
      const avail = Calc.maxPortions(recipe, getIngredient);
      const shortOnHand = avail.portions < portions;

      tbody.append(
        el("tr", {}, [
          el("td", {}, [
            el("strong", {}, [recipe.name]),
            el("div", { class: "muted small-note" }, [recipe.category || "Uncategorized"]),
          ]),
          el("td", { class: "num" }, [
            el("input", {
              class: "inline-input num", type: "number", step: "any", min: "0", value: line.portionsPerGuest,
              oninput: (e) => { line.portionsPerGuest = Number(e.target.value) || 0; persist(); },
              onchange: () => renderEvents(),
            }),
          ]),
          el("td", { class: "num" }, [
            el("input", {
              class: "inline-input num", type: "number", step: "any", min: "0", value: line.overagePct,
              oninput: (e) => { line.overagePct = Number(e.target.value) || 0; persist(); },
              onchange: () => renderEvents(),
            }),
          ]),
          el("td", { class: "num" }, [el("strong", {}, [String(portions)])]),
          el("td", { class: "num" }, [perBatch > 1 ? `${Math.ceil(portions / perBatch)} × ${Calc.fmtQty(perBatch)}` : "—"]),
          el("td", { class: "num" }, [Calc.fmtMoney(plateCost)]),
          el("td", { class: "num" }, [Calc.fmtMoney(plateCost * portions)]),
          el("td", { class: "num" }, [
            el("span", { class: "pill " + (shortOnHand ? "warn" : "good") }, [String(avail.portions)]),
          ]),
          el("td", {}, [
            el("div", { class: "row-actions" }, [
              el("button", { class: "btn btn-sm danger btn-icon", title: "Remove dish", onclick: () => removeEventLine(ev.id, idx) }, ["✕"]),
            ]),
          ]),
        ])
      );
    });
    table.append(tbody);
    card.append(el("div", { class: "table-wrap" }, [table]));
    card.append(
      el("p", { class: "hint" }, ["“On Hand” is how many servings current inventory covers — an amber badge means you'll need to order before the event."])
    );
    return card;
  }

  function renderEventSupplies(ev) {
    const card = el("div", { class: "card" }, [
      el("div", { class: "card-head-row" }, [
        el("div", {}, [
          el("h3", {}, ["Per-Guest Supplies"]),
          el("div", { class: "sub" }, ["Napkins, cutlery kits, to-go containers, chafing fuel — the line items that quietly eat a catering margin."]),
        ]),
        el("button", { class: "btn btn-sm", onclick: () => addEventSupply(ev.id) }, ["+ Add Supply"]),
      ]),
    ]);

    if (!(ev.supplies || []).length) {
      card.append(el("div", { class: "empty-state" }, ["No supplies added for this event."]));
      return card;
    }

    const table = el("table", { style: "margin-top:10px" }, [
      el("thead", {}, [
        el("tr", {}, [
          el("th", {}, ["Item"]),
          el("th", { class: "num" }, ["Qty / Guest"]),
          el("th", { class: "num" }, ["Total Needed"]),
          el("th", { class: "num" }, ["Cost"]),
          el("th", {}, [""]),
        ]),
      ]),
    ]);
    const tbody = el("tbody");
    (ev.supplies || []).forEach((sup, idx) => {
      const ing = getIngredient(sup.ingredientId);
      const qty = ing ? supplyQty(ev, sup) : 0;
      tbody.append(
        el("tr", {}, [
          el("td", {}, [
            selectEl(
              state.ingredients.map((i) => ({ id: i.id, label: `${i.name} (${i.category})` })),
              sup.ingredientId,
              (v) => { sup.ingredientId = v; persist(); renderEvents(); }
            ),
          ]),
          el("td", { class: "num" }, [
            el("input", {
              class: "inline-input num", type: "number", step: "any", min: "0", value: sup.qtyPerGuest,
              oninput: (e) => { sup.qtyPerGuest = Number(e.target.value) || 0; persist(); },
              onchange: () => renderEvents(),
            }),
          ]),
          el("td", { class: "num" }, [ing ? `${Calc.fmtQty(qty)} ${Calc.unitLabel(ing, qty)}` : "—"]),
          el("td", { class: "num" }, [ing ? Calc.fmtMoney(Calc.componentCost(ing, qty)) : "—"]),
          el("td", {}, [
            el("div", { class: "row-actions" }, [
              el("button", { class: "btn btn-sm danger btn-icon", title: "Remove", onclick: () => removeEventSupply(ev.id, idx) }, ["✕"]),
            ]),
          ]),
        ])
      );
    });
    table.append(tbody);
    card.append(el("div", { class: "table-wrap" }, [table]));
    return card;
  }

  function renderEventShoppingList(ev) {
    const reqs = eventRequirements(ev).sort((a, b) => {
      const sa = Calc.shortfall(a).shortQty > 0 ? 0 : 1;
      const sb = Calc.shortfall(b).shortQty > 0 ? 0 : 1;
      return sa - sb || a.ingredient.category.localeCompare(b.ingredient.category) || a.ingredient.name.localeCompare(b.ingredient.name);
    });

    const card = el("div", { class: "card" }, [
      el("h3", {}, ["Shopping List"]),
      el("div", { class: "sub", style: "margin-bottom:10px" }, ["Total quantities this event draws, checked against inventory on hand. Shortfalls are rounded up to whole purchase packs."]),
    ]);

    if (!reqs.length) {
      card.append(el("div", { class: "empty-state" }, ["Add dishes or supplies to build a shopping list."]));
      return card;
    }

    const shorts = reqs.map((r) => Calc.shortfall(r));
    const buyTotal = shorts.reduce((s, x) => s + x.buyCost, 0);
    const shortCount = shorts.filter((x) => x.shortQty > 0).length;

    card.append(
      el("div", { class: "grid grid-3", style: "margin-bottom:14px" }, [
        statMini("Items To Order", String(shortCount)),
        statMini("Est. Purchase Cost", Calc.fmtMoney(buyTotal)),
        statMini("Items Covered", String(reqs.length - shortCount)),
      ])
    );

    const table = el("table", {}, [
      el("thead", {}, [
        el("tr", {}, [
          el("th", {}, ["Ingredient"]),
          el("th", {}, ["Category"]),
          el("th", { class: "num" }, ["Needed (usable)"]),
          el("th", { class: "num" }, ["Needed (as purchased)"]),
          el("th", { class: "num" }, ["On Hand"]),
          el("th", { class: "num" }, ["Short"]),
          el("th", {}, ["Order"]),
          el("th", { class: "num" }, ["Est. Cost"]),
        ]),
      ]),
    ]);
    const tbody = el("tbody");
    reqs.forEach((req, i) => {
      const ing = req.ingredient;
      const s = shorts[i];
      const pu = Calc.purchaseUnit(ing.baseUnit, ing.purchaseUnit);
      const packLabel = pu.id === "each" ? Calc.unitLabel(ing, ing.purchaseQty) : pu.label;
      tbody.append(
        el("tr", { class: s.shortQty > 0 ? "row-warn" : "" }, [
          el("td", {}, [el("strong", {}, [ing.name])]),
          el("td", {}, [el("span", { class: "pill" }, [ing.category])]),
          el("td", { class: "num" }, [Calc.fmtBaseQty(ing, req.usableQty)]),
          el("td", { class: "num" }, [Calc.fmtBaseQty(ing, req.asPurchasedQty)]),
          el("td", { class: "num muted" }, [Calc.fmtBaseQty(ing, s.onHandQty)]),
          el("td", { class: "num" }, [s.shortQty > 0 ? Calc.fmtBaseQty(ing, s.shortQty) : "—"]),
          el("td", {}, [s.packs > 0 ? `${s.packs} × ${Calc.fmtQty(ing.purchaseQty)} ${packLabel}` : el("span", { class: "muted" }, ["covered"])]),
          el("td", { class: "num" }, [s.buyCost > 0 ? Calc.fmtMoney(s.buyCost) : "—"]),
        ])
      );
    });
    table.append(tbody);
    card.append(el("div", { class: "table-wrap" }, [table]));
    card.append(
      el("div", { class: "row-actions", style: "margin-top:12px;justify-content:flex-start" }, [
        el("button", { class: "btn btn-sm", onclick: () => exportEventPlan(ev.id) }, ["Download Prep & Shopping Sheet"]),
        el("button", { class: "btn btn-sm", onclick: () => consumeEvent(ev.id) }, ["Deduct From Inventory"]),
      ])
    );
    card.append(
      el("p", { class: "hint" }, ["“Deduct From Inventory” draws this event's quantities down off your counts — run it once the event is plated."])
    );
    return card;
  }

  // Plain-text prep sheet a kitchen can actually print and work from.
  function exportEventPlan(id) {
    const ev = getEvent(id);
    if (!ev) return;
    const t = eventTotals(ev);
    const lines = [];
    lines.push(`NONE LEFT ON THE PLATE — EVENT PLAN`);
    lines.push(`${ev.name}${ev.date ? " — " + ev.date : ""}`);
    lines.push(`${t.guests} guests · ${Calc.fmtNum(t.portions, 0)} portions · total cost ${Calc.fmtMoney(t.totalCost)} · revenue ${Calc.fmtMoney(t.revenue)} · profit ${Calc.fmtMoney(t.profit)}`);
    if (ev.notes) lines.push(`Notes: ${ev.notes}`);
    lines.push("");
    lines.push("PREP SHEET");
    (ev.lines || []).forEach((line) => {
      const recipe = getRecipe(line.recipeId);
      if (!recipe) return;
      const portions = linePortions(ev, line);
      const perBatch = Calc.portionsPerBatch(recipe);
      const batchNote = perBatch > 1 ? ` (${Math.ceil(portions / perBatch)} batches of ${Calc.fmtQty(perBatch)})` : "";
      lines.push(`  [ ] ${recipe.name} — ${portions} portions${batchNote}`);
      recipe.components.forEach((c) => {
        const ing = getIngredient(c.ingredientId);
        if (!ing) return;
        const qty = Calc.componentQtyPerPortion(recipe, c) * portions;
        lines.push(`        ${ing.name}: ${Calc.fmtBaseQty(ing, qty)}`);
      });
    });
    if ((ev.supplies || []).length) {
      lines.push("");
      lines.push("SUPPLIES");
      ev.supplies.forEach((sup) => {
        const ing = getIngredient(sup.ingredientId);
        if (!ing) return;
        const qty = supplyQty(ev, sup);
        lines.push(`  [ ] ${ing.name}: ${Calc.fmtQty(qty)} ${Calc.unitLabel(ing, qty)}`);
      });
    }
    lines.push("");
    lines.push("SHOPPING LIST (shortfalls vs. inventory on hand)");
    const reqs = eventRequirements(ev);
    let buyTotal = 0;
    reqs.forEach((req) => {
      const s = Calc.shortfall(req);
      if (s.shortQty <= 0) return;
      const pu = Calc.purchaseUnit(req.ingredient.baseUnit, req.ingredient.purchaseUnit);
      const packLabel = pu.id === "each" ? Calc.unitLabel(req.ingredient, req.ingredient.purchaseQty) : pu.label;
      buyTotal += s.buyCost;
      lines.push(`  [ ] ${req.ingredient.name}: short ${Calc.fmtBaseQty(req.ingredient, s.shortQty)} — order ${s.packs} × ${Calc.fmtQty(req.ingredient.purchaseQty)} ${packLabel} (${Calc.fmtMoney(s.buyCost)})`);
    });
    if (!buyTotal) lines.push("  Everything is covered by inventory on hand.");
    else lines.push(`  Estimated purchase cost: ${Calc.fmtMoney(buyTotal)}`);

    const slug = ev.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event";
    Storage.downloadBlob(new Blob([lines.join("\n")], { type: "text/plain" }), `${slug}-prep-sheet.txt`);
    toast("Prep sheet downloaded.");
  }

  // Draw the event's quantities down off inventory once it's been executed.
  function consumeEvent(id) {
    const ev = getEvent(id);
    if (!ev) return;
    if (!confirm(`Deduct this event's quantities from inventory on hand? Use this after ${ev.name} has been plated.`)) return;
    eventRequirements(ev).forEach((req) => {
      const ing = getIngredient(req.ingredient.id);
      if (!ing) return;
      ing.onHandQty = Math.max(0, (Number(ing.onHandQty) || 0) - req.asPurchasedQty);
    });
    persist();
    renderAll();
    toast("Inventory updated from event.");
  }

  function addEventLine(id) {
    const ev = getEvent(id);
    if (!ev) return;
    if (!state.recipes.length) {
      alert("Add a recipe first — an event menu is built from your dishes.");
      return;
    }
    const used = new Set(ev.lines.map((l) => l.recipeId));
    const next = state.recipes.find((r) => !used.has(r.id)) || state.recipes[0];
    ev.lines.push({
      id: Calc.uid("ln"),
      recipeId: next.id,
      portionsPerGuest: 1,
      overagePct: state.settings.defaultOveragePct || 10,
    });
    persist();
    renderEvents();
  }

  function removeEventLine(id, idx) {
    const ev = getEvent(id);
    if (!ev) return;
    ev.lines.splice(idx, 1);
    persist();
    renderEvents();
  }

  function addEventSupply(id) {
    const ev = getEvent(id);
    if (!ev) return;
    const disposable = state.ingredients.find((i) => i.category === "Disposables") || state.ingredients[0];
    if (!disposable) {
      alert("Add an ingredient first.");
      return;
    }
    ev.supplies.push({ id: Calc.uid("sup"), ingredientId: disposable.id, qtyPerGuest: 1 });
    persist();
    renderEvents();
  }

  function removeEventSupply(id, idx) {
    const ev = getEvent(id);
    if (!ev) return;
    ev.supplies.splice(idx, 1);
    persist();
    renderEvents();
  }

  function openEventForm(id) {
    const existing = id ? getEvent(id) : null;
    openModal(existing ? "Edit Event" : "New Event", (body) => {
      const draft = existing
        ? { ...existing }
        : {
            name: "", date: "", guestCount: "", pricingMode: "perGuest",
            pricePerGuest: "", notes: "", lines: [], supplies: [],
          };

      function render() {
        body.innerHTML = "";
        const form = el("form", {}, [
          field("Event Name", el("input", { type: "text", required: "required", placeholder: "Smith Wedding Reception", value: draft.name, oninput: (e) => (draft.name = e.target.value) })),
          fieldRow([
            field("Date", el("input", { type: "date", value: draft.date || "", oninput: (e) => (draft.date = e.target.value) })),
            field("Guest Count", el("input", { type: "number", step: "1", min: "0", required: "required", value: draft.guestCount, oninput: (e) => (draft.guestCount = e.target.value) })),
          ]),
          field(
            "How it's billed",
            selectEl(
              [
                { id: "perGuest", label: "Flat price per guest" },
                { id: "menu", label: "À la carte — each dish at its menu price" },
              ],
              draft.pricingMode,
              (v) => { draft.pricingMode = v; render(); },
              true
            )
          ),
          draft.pricingMode === "perGuest"
            ? field(
                "Price Per Guest ($)",
                el("input", { type: "number", step: "any", min: "0", value: draft.pricePerGuest, oninput: (e) => (draft.pricePerGuest = e.target.value) }),
                "Revenue = guest count × this price."
              )
            : el("p", { class: "hint" }, ["Revenue comes from each dish's menu price × the portions prepped."]),
          field("Notes", el("input", { type: "text", value: draft.notes || "", oninput: (e) => (draft.notes = e.target.value) })),
          el("div", { class: "form-actions" }, [
            el("button", { type: "button", class: "btn", onclick: closeModal }, ["Cancel"]),
            el("button", { type: "submit", class: "btn btn-primary" }, [existing ? "Save Changes" : "Create Event"]),
          ]),
        ]);

        form.addEventListener("submit", (e) => {
          e.preventDefault();
          if (!draft.name.trim()) return;
          draft.guestCount = Number(draft.guestCount) || 0;
          draft.pricePerGuest = Number(draft.pricePerGuest) || 0;
          if (existing) {
            Object.assign(existing, draft);
          } else {
            draft.id = Calc.uid("ev");
            state.events.push(draft);
            activeEventId = draft.id;
          }
          persist();
          renderAll();
          closeModal();
          toast(existing ? "Event updated." : "Event created.");
        });
        body.append(form);
      }
      render();
    });
  }

  function duplicateEvent(id) {
    const ev = getEvent(id);
    if (!ev) return;
    const copy = JSON.parse(JSON.stringify(ev));
    copy.id = Calc.uid("ev");
    copy.name = ev.name + " (copy)";
    delete copy.sinceVersion;
    copy.lines.forEach((l) => (l.id = Calc.uid("ln")));
    (copy.supplies || []).forEach((s) => (s.id = Calc.uid("sup")));
    state.events.push(copy);
    activeEventId = copy.id;
    persist();
    renderAll();
    toast("Event duplicated.");
  }

  function deleteEvent(id) {
    const ev = getEvent(id);
    if (!ev) return;
    if (!confirm(`Delete “${ev.name}”?`)) return;
    state.events = state.events.filter((e) => e.id !== id);
    if (activeEventId === id) activeEventId = state.events.length ? state.events[0].id : null;
    persist();
    renderAll();
    toast("Event deleted.");
  }

  // ================= INSIGHTS =================
  // The read on the menu: what sells, what earns, what shares a prep list, and
  // what stands alone — without anyone having to build a spreadsheet.
  function renderInsights() {
    const panel = $("#panel-insights");
    panel.innerHTML = "";
    panel.append(
      el("div", { class: "panel-head" }, [
        el("div", {}, [
          el("h2", {}, ["Insights"]),
          el("div", { class: "sub" }, ["What sells, what doesn't, which dishes share a prep list, and which ones stand on their own."]),
        ]),
      ])
    );

    if (state.recipes.length < 2) {
      panel.append(el("div", { class: "card empty-state" }, ["Add a few dishes — with servings per week on the Usage tab — and the menu read shows up here."]));
      return;
    }

    const ranked = Calc.popularityRanking(state.recipes, getIngredient);
    const withServings = ranked.filter((r) => r.servings > 0);
    const best = withServings[0];
    const worst = withServings[withServings.length - 1];
    const topProfit = ranked.slice().sort((a, b) => b.weeklyProfit - a.weeklyProfit)[0];
    const pricedRows = ranked.filter((r) => r.foodCostPct !== null);
    const worstPct = pricedRows.slice().sort((a, b) => b.foodCostPct - a.foodCostPct)[0];

    panel.append(
      el("div", { class: "grid grid-4" }, [
        insightStat("Most Popular", best ? best.recipe.name : "—", best ? `${Calc.fmtNum(best.servings, 0)} / week` : ""),
        insightStat("Least Popular", worst ? worst.recipe.name : "—", worst ? `${Calc.fmtNum(worst.servings, 0)} / week` : ""),
        insightStat("Biggest Weekly Profit", topProfit ? topProfit.recipe.name : "—", topProfit ? Calc.fmtMoney(topProfit.weeklyProfit) + " / week" : ""),
        insightStat("Highest Food Cost", worstPct ? worstPct.recipe.name : "—", worstPct ? Calc.fmtPct(worstPct.foodCostPct) + " of price" : ""),
      ])
    );

    panel.append(renderPopularityCard(ranked));
    panel.append(renderMenuEngineeringCard());
    panel.append(renderSharedIngredientsCard());
    panel.append(renderStandaloneCard());
    panel.append(
      el("div", { class: "two-col" }, [renderOrphanCard(), renderWorkhorseCard()])
    );
  }

  function insightStat(label, value, sub) {
    return el("div", { class: "stat-card" }, [
      el("div", { class: "label" }, [label]),
      el("div", { class: "value small" }, [value]),
      sub ? el("div", { class: "muted small-note" }, [sub]) : null,
    ]);
  }

  // ---- what sells ----
  function renderPopularityCard(ranked) {
    const card = el("div", { class: "card" }, [
      el("h3", {}, ["Menu Mix & Popularity"]),
      el("div", { class: "sub", style: "margin-bottom:10px" }, ["Ranked by servings per week. Share of covers is that dish's slice of everything you sell in a week."]),
    ]);
    const maxServings = Math.max(...ranked.map((r) => r.servings), 1);
    const table = el("table", {}, [
      el("thead", {}, [
        el("tr", {}, [
          el("th", {}, ["Dish"]),
          el("th", {}, ["Menu"]),
          el("th", { class: "num" }, ["Servings / Wk"]),
          el("th", {}, ["Share Of Covers"]),
          el("th", { class: "num" }, ["Plate Cost"]),
          el("th", { class: "num" }, ["Price"]),
          el("th", { class: "num" }, ["Food Cost %"]),
          el("th", { class: "num" }, ["Profit / Plate"]),
          el("th", { class: "num" }, ["Weekly Profit"]),
        ]),
      ]),
    ]);
    const tbody = el("tbody");
    const n = ranked.length;
    ranked.forEach((row, idx) => {
      let flag = null;
      if (idx < 3) flag = el("span", { class: "pill good" }, ["Top seller"]);
      else if (idx >= n - 3) flag = el("span", { class: "pill warn" }, ["Slow mover"]);
      tbody.append(
        el("tr", {}, [
          el("td", {}, [el("strong", {}, [row.recipe.name]), flag ? el("span", { style: "margin-left:8px" }, [flag]) : null]),
          el("td", {}, [el("span", { class: "pill" }, [row.recipe.menu || "Dinner"])]),
          el("td", { class: "num" }, [Calc.fmtNum(row.servings, 0)]),
          el("td", {}, [
            el("div", { class: "bar" }, [
              el("div", { class: "bar-fill", style: `width:${(row.servings / maxServings) * 100}%` }),
            ]),
            el("div", { class: "muted small-note" }, [Calc.fmtPct(row.share)]),
          ]),
          el("td", { class: "num" }, [Calc.fmtMoney(row.cost)]),
          el("td", { class: "num" }, [row.recipe.menuPrice ? Calc.fmtMoney(row.recipe.menuPrice) : "—"]),
          el("td", { class: "num" }, [row.foodCostPct === null ? "—" : Calc.fmtPct(row.foodCostPct)]),
          el("td", { class: "num" }, [row.recipe.menuPrice ? Calc.fmtMoney(row.profitEach) : "—"]),
          el("td", { class: "num" }, [el("strong", {}, [Calc.fmtMoney(row.weeklyProfit)])]),
        ])
      );
    });
    table.append(tbody);
    card.append(el("div", { class: "table-wrap" }, [table]));
    return card;
  }

  // ---- what earns ----
  function renderMenuEngineeringCard() {
    const { rows, medServings, medProfit } = Calc.menuEngineering(state.recipes, getIngredient);
    const card = el("div", { class: "card" }, [
      el("h3", {}, ["Menu Engineering"]),
      el("div", { class: "sub", style: "margin-bottom:12px" }, [
        `Every priced dish sorted on two axes: how often it sells and how much it earns per plate. The split is the menu median — ${Calc.fmtNum(medServings, 0)} servings a week and ${Calc.fmtMoney(medProfit)} profit per plate.`,
      ]),
    ]);
    if (!rows.length) {
      card.append(el("div", { class: "empty-state" }, ["Set menu prices to see the menu engineering read."]));
      return card;
    }

    const grid = el("div", { class: "grid grid-2" });
    ["star", "plowhorse", "puzzle", "dog"].forEach((cls) => {
      const meta = Calc.MENU_CLASSES[cls];
      const members = rows.filter((r) => r.menuClass === cls);
      const box = el("div", { class: "quad quad-" + cls }, [
        el("div", { class: "quad-head" }, [
          el("strong", {}, [meta.label]),
          el("span", { class: "pill" }, [String(members.length)]),
        ]),
        el("div", { class: "muted small-note", style: "margin-bottom:8px" }, [meta.blurb]),
      ]);
      if (!members.length) {
        box.append(el("div", { class: "muted small-note" }, ["Nothing here."]));
      } else {
        const list = el("ul", { class: "breakdown-list" });
        members.forEach((m) => {
          list.append(
            el("li", {}, [
              el("span", {}, [m.recipe.name]),
              el("span", { class: "muted" }, [`${Calc.fmtNum(m.servings, 0)}/wk · ${Calc.fmtMoney(m.profitEach)}/plate`]),
            ])
          );
        });
        box.append(list);
      }
      grid.append(box);
    });
    card.append(grid);
    return card;
  }

  // ---- what shares a prep list ----
  function renderSharedIngredientsCard() {
    const pairs = Calc.sharedIngredientPairs(state.recipes, getIngredient, 3).slice(0, 12);
    const card = el("div", { class: "card" }, [
      el("h3", {}, ["Dishes That Share Ingredients"]),
      el("div", { class: "sub", style: "margin-bottom:10px" }, ["Pairs with the most overlap. High overlap is good news: one delivery covers both, and a slow night on one still moves the product."]),
    ]);
    if (!pairs.length) {
      card.append(el("div", { class: "empty-state" }, ["No two dishes share three or more ingredients yet."]));
      return card;
    }
    const table = el("table", {}, [
      el("thead", {}, [
        el("tr", {}, [
          el("th", {}, ["Dish"]),
          el("th", {}, ["Shares With"]),
          el("th", { class: "num" }, ["Shared"]),
          el("th", { class: "num" }, ["Overlap"]),
          el("th", {}, ["What They Share"]),
        ]),
      ]),
    ]);
    const tbody = el("tbody");
    pairs.forEach((pair) => {
      tbody.append(
        el("tr", {}, [
          el("td", {}, [el("strong", {}, [pair.a.name])]),
          el("td", {}, [el("strong", {}, [pair.b.name])]),
          el("td", { class: "num" }, [String(pair.sharedCount)]),
          el("td", { class: "num" }, [Calc.fmtPct(pair.overlapPct)]),
          el("td", {}, [
            el("div", { class: "tag-list" }, pair.shared.map((ing) => el("span", { class: "tag" }, [ing.name]))),
          ]),
        ])
      );
    });
    table.append(tbody);
    card.append(el("div", { class: "table-wrap" }, [table]));
    return card;
  }

  // ---- what stands alone ----
  function renderStandaloneCard() {
    const rows = Calc.crossUtilization(state.recipes, getIngredient);
    const card = el("div", { class: "card" }, [
      el("h3", {}, ["Dishes That Stand Alone"]),
      el("div", { class: "sub", style: "margin-bottom:10px" }, ["Least cross-utilized first. A dish low on this list carries ingredients nothing else on the menu uses — that's where spoilage and dead inventory come from, and it's the hardest kind of dish to keep on."]),
    ]);
    const table = el("table", {}, [
      el("thead", {}, [
        el("tr", {}, [
          el("th", {}, ["Dish"]),
          el("th", {}, ["Menu"]),
          el("th", { class: "num" }, ["Ingredients"]),
          el("th", {}, ["Shared With Other Dishes"]),
          el("th", {}, ["Used Nowhere Else"]),
        ]),
      ]),
    ]);
    const tbody = el("tbody");
    rows.forEach((row) => {
      const lonely = row.sharedPct < 50;
      tbody.append(
        el("tr", { class: row.sharedPct === 0 ? "row-bad" : lonely ? "row-warn" : "" }, [
          el("td", {}, [el("strong", {}, [row.recipe.name])]),
          el("td", {}, [el("span", { class: "pill" }, [row.recipe.menu || "Dinner"])]),
          el("td", { class: "num" }, [String(row.ingredientCount)]),
          el("td", {}, [
            el("div", { class: "bar" }, [el("div", { class: "bar-fill", style: `width:${row.sharedPct}%` })]),
            el("div", { class: "muted small-note" }, [`${Calc.fmtPct(row.sharedPct)} shared`]),
          ]),
          el("td", {}, [
            row.exclusive.length
              ? el("div", { class: "tag-list" }, row.exclusive.map((ing) => el("span", { class: "tag warn" }, [ing.name])))
              : el("span", { class: "muted" }, ["Nothing — every ingredient earns its keep elsewhere"]),
          ]),
        ])
      );
    });
    table.append(tbody);
    card.append(el("div", { class: "table-wrap" }, [table]));
    return card;
  }

  // ---- single-use inventory ----
  function renderOrphanCard() {
    const orphans = Calc.orphanIngredients(state.recipes, state.ingredients);
    const tied = orphans.reduce((sum, o) => sum + o.onHandValue, 0);
    const card = el("div", { class: "card" }, [
      el("h3", {}, ["Single-Use Ingredients"]),
      el("div", { class: "sub", style: "margin-bottom:10px" }, [
        orphans.length
          ? `${orphans.length} ingredient${orphans.length === 1 ? "" : "s"} only one dish uses, holding ${Calc.fmtMoney(tied)} of inventory. Pull that dish and this stock has nowhere to go.`
          : "Every ingredient is used by more than one dish.",
      ]),
    ]);
    if (!orphans.length) return card;
    const table = el("table", {}, [
      el("thead", {}, [
        el("tr", {}, [
          el("th", {}, ["Ingredient"]),
          el("th", {}, ["Only Used By"]),
          el("th", { class: "num" }, ["On Hand"]),
        ]),
      ]),
    ]);
    const tbody = el("tbody");
    orphans.slice(0, 12).forEach((o) => {
      tbody.append(
        el("tr", {}, [
          el("td", {}, [el("strong", {}, [o.ingredient.name])]),
          el("td", { class: "muted" }, [o.usedBy.name]),
          el("td", { class: "num" }, [Calc.fmtMoney(o.onHandValue)]),
        ])
      );
    });
    table.append(tbody);
    card.append(el("div", { class: "table-wrap" }, [table]));
    return card;
  }

  // ---- the opposite end ----
  function renderWorkhorseCard() {
    const workhorses = Calc.workhorseIngredients(state.recipes, state.ingredients, 10);
    const card = el("div", { class: "card" }, [
      el("h3", {}, ["Workhorse Ingredients"]),
      el("div", { class: "sub", style: "margin-bottom:10px" }, ["Carrying the most dishes. A supplier price rise on any of these moves your food cost across the whole menu at once."]),
    ]);
    if (!workhorses.length) {
      card.append(el("div", { class: "empty-state" }, ["No ingredient is shared between dishes yet."]));
      return card;
    }
    const table = el("table", {}, [
      el("thead", {}, [
        el("tr", {}, [
          el("th", {}, ["Ingredient"]),
          el("th", { class: "num" }, ["Dishes"]),
          el("th", { class: "num" }, ["Cost / Usable Unit"]),
        ]),
      ]),
    ]);
    const tbody = el("tbody");
    workhorses.forEach((w) => {
      tbody.append(
        el("tr", {}, [
          el("td", {}, [el("strong", {}, [w.ingredient.name])]),
          el("td", { class: "num" }, [String(w.dishes.length)]),
          el("td", { class: "num" }, [`${Calc.fmtMoney(Calc.costPerUsableUnit(w.ingredient))} / ${Calc.unitLabel(w.ingredient, 1)}`]),
        ])
      );
    });
    table.append(tbody);
    card.append(el("div", { class: "table-wrap" }, [table]));
    return card;
  }

  // ================= DASHBOARD =================
  function renderDashboard() {
    const panel = $("#panel-dashboard");
    panel.innerHTML = "";
    panel.append(
      el("div", { class: "panel-head" }, [
        el("div", {}, [
          el("h2", {}, ["Dashboard"]),
          el("div", { class: "sub" }, ["Menu-wide food cost health, what's on the shelf, and what the book looks like."]),
        ]),
      ])
    );

    const recipeStats = state.recipes.map((r) => {
      const cost = Calc.recipeCost(r, getIngredient);
      return {
        r, cost,
        pct: r.menuPrice ? Calc.foodCostPct(cost, r.menuPrice) : null,
        avail: Calc.maxPortions(r, getIngredient),
      };
    });
    const priced = recipeStats.filter((s) => s.pct !== null);
    const avgPct = priced.length ? priced.reduce((s, x) => s + x.pct, 0) / priced.length : 0;

    let weeklyCost = 0, weeklyRevenue = 0;
    recipeStats.forEach((s) => {
      const proj = Calc.periodProjection(s.cost, s.r.menuPrice, s.r.servingsPerWeek);
      weeklyCost += proj.weekly.cost;
      weeklyRevenue += proj.weekly.revenue;
    });

    const inventoryValue = state.ingredients.reduce((s, i) => s + Calc.inventoryValue(i), 0);
    const belowPar = state.ingredients.filter(Calc.belowPar);
    const eventTotalsAll = state.events.map(eventTotals);
    const eventProfit = eventTotalsAll.reduce((s, t) => s + t.profit, 0);

    panel.append(
      el("div", { class: "grid grid-4" }, [
        statCard("Dishes On Menu", state.recipes.length),
        statCard("Ingredients Tracked", state.ingredients.length),
        statCard("Avg. Food Cost %", priced.length ? Calc.fmtPct(avgPct) : "—"),
        statCard("Weekly Profit (est.)", Calc.fmtMoney(weeklyRevenue - weeklyCost)),
      ])
    );
    panel.append(
      el("div", { class: "grid grid-4" }, [
        statCard("Inventory Value", Calc.fmtMoney(inventoryValue)),
        statCard("Items Below Par", belowPar.length),
        statCard("Events Planned", state.events.length),
        statCard("Event Profit (planned)", Calc.fmtMoney(eventProfit)),
      ])
    );

    const card = el("div", { class: "card" }, [el("h3", {}, ["Menu Food Cost Overview"])]);
    if (!recipeStats.length) {
      card.append(el("div", { class: "empty-state" }, ["Add recipes to see food cost analysis here."]));
    } else {
      const table = el("table", {}, [
        el("thead", {}, [
          el("tr", {}, [
            el("th", {}, ["Dish"]),
            el("th", { class: "num" }, ["Plate Cost"]),
            el("th", { class: "num" }, ["Menu Price"]),
            el("th", { class: "num" }, ["Food Cost %"]),
            el("th", { class: "num" }, ["Profit / Serving"]),
            el("th", { class: "num" }, ["Servings On Hand"]),
            el("th", {}, ["Status"]),
          ]),
        ]),
      ]);
      const tbody = el("tbody");
      recipeStats
        .slice()
        .sort((a, b) => (b.pct || 0) - (a.pct || 0))
        .forEach((s) => {
          let status = el("span", { class: "pill" }, ["No price set"]);
          if (s.pct !== null) {
            if (s.pct > s.r.targetFoodCostPct + 5) status = el("span", { class: "pill bad" }, ["Over target"]);
            else if (s.pct > s.r.targetFoodCostPct) status = el("span", { class: "pill warn" }, ["Slightly over"]);
            else status = el("span", { class: "pill good" }, ["On target"]);
          }
          tbody.append(
            el("tr", {}, [
              el("td", {}, [s.r.name]),
              el("td", { class: "num" }, [Calc.fmtMoney(s.cost)]),
              el("td", { class: "num" }, [s.r.menuPrice ? Calc.fmtMoney(s.r.menuPrice) : "—"]),
              el("td", { class: "num" }, [s.pct !== null ? Calc.fmtPct(s.pct) : "—"]),
              el("td", { class: "num" }, [s.r.menuPrice ? Calc.fmtMoney(Calc.grossProfit(s.cost, s.r.menuPrice)) : "—"]),
              el("td", { class: "num" }, [String(s.avail.portions)]),
              el("td", {}, [status]),
            ])
          );
        });
      table.append(tbody);
      card.append(el("div", { class: "table-wrap" }, [table]));
    }
    panel.append(card);

    if (belowPar.length) {
      const reorder = el("div", { class: "card" }, [
        el("h3", {}, ["Reorder List"]),
        el("div", { class: "sub", style: "margin-bottom:10px" }, [`${belowPar.length} item${belowPar.length === 1 ? "" : "s"} below par.`]),
      ]);
      const list = el("ul", { class: "breakdown-list" });
      belowPar
        .slice()
        .sort((a, b) => Calc.inventoryValue(a) - Calc.inventoryValue(b))
        .slice(0, 8)
        .forEach((ing) => {
          const short = (Number(ing.parQty) || 0) - (Number(ing.onHandQty) || 0);
          list.append(
            el("li", {}, [
              el("span", {}, [ing.name]),
              el("span", { class: "muted" }, [`${Calc.fmtBaseQty(ing, ing.onHandQty)} on hand — ${Calc.fmtBaseQty(ing, short)} below par`]),
            ])
          );
        });
      reorder.append(list);
      panel.append(reorder);
    }
  }

  function statCard(label, value) {
    return el("div", { class: "stat-card" }, [
      el("div", { class: "label" }, [label]),
      el("div", { class: "value" }, [String(value)]),
    ]);
  }

  // ---------- form field helpers ----------
  function field(label, inputEl, hint) {
    const wrap = el("div", { class: "field" });
    if (label) wrap.append(el("label", {}, [label]));
    wrap.append(inputEl);
    if (hint) wrap.append(el("div", { class: "hint" }, [hint]));
    return wrap;
  }
  function fieldRow(fields) { return el("div", { class: "field-row" }, fields); }
  function selectEl(options, value, onChange, required) {
    const sel = el("select", required ? { required: "required" } : {});
    options.forEach((o) => {
      const optVal = typeof o === "string" ? o : o.id;
      const optLabel = typeof o === "string" ? o : o.label;
      const opt = el("option", { value: optVal }, [optLabel]);
      if (optVal === value) opt.setAttribute("selected", "selected");
      sel.append(opt);
    });
    sel.addEventListener("change", (e) => onChange(e.target.value));
    return sel;
  }

  // ---------- init ----------
  function renderAll() {
    renderDashboard();
    renderIngredients();
    renderRecipes();
    renderInventory();
    renderInsights();
    renderUsage();
    renderEvents();
  }

  function init() {
    renderAll();
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", App.init);
