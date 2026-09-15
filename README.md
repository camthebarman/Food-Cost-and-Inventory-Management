# None Left On The Plate

A food cost, inventory, and catering planner for kitchens. It prices every dish down to the
plate — proteins, produce, dairy, dry goods, disposables — accounting for the trim and waste
you actually throw away, then tells you how many servings you can still make from what's on
the shelf and what a catered event will cost before you commit to it.

Companion to [Don't Go Pour](https://github.com/camthebarman/Don-t-Go-Pour), the beverage
pour cost calculator — same idea, same no-dependency stack, for the food side of the house.

No build step, no dependencies — it's a static HTML/CSS/JS app. Data is saved to your
browser's `localStorage`, with JSON export/import for backups or sharing between machines.

## Running it

Just open `index.html` in a browser, or serve the folder with any static file server:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## What it does

- **Ingredients** — enter how you actually buy something ("40 lb case for $116", "#10 can for
  $4.80", "96 buns for $42") and it computes the true cost per usable ounce, fluid ounce, or
  each. Every ingredient carries a **yield %** for trim and waste, so 24 lb of romaine you have
  to core and trim is priced as the 19 lb that reaches the plate — not the 24 you paid for.
- **Recipes** — build a dish from any combination of ingredients, as a single plate or as a
  batch ("this sauce yields 8 servings"). Get the plate cost per serving, a suggested menu
  price at your target food cost %, and — once you set an actual menu price — the real food
  cost %, gross profit, and margin per serving.
- **Inventory** — a count sheet you can work down the shelf with. Count in whatever unit you
  count in (cases, pounds, each) and it converts automatically. Set **par levels** and anything
  that falls below one shows up as a reorder, with an estimated cost to get back to par.
- **Number remaining** — the question this app exists to answer: *how many can we still make?*
  Every dish shows the maximum servings your current inventory can produce and the ingredient
  that runs out first, plus **days of cover** at your projected run rate. It's on the recipe
  cards, the Inventory tab, and the dashboard.
- **Usage & Projections** — guesstimate servings per week per dish, rolled up into weekly,
  monthly, and annual food cost, revenue, and profit.
- **Events** — plan a catered meal or a pre-numbered event end to end:
  - Set the guest count and build the menu from your dishes, with a **portions-per-guest take
    rate** (0.45 means 45% of the room picks that entrée) and an **overage %** so the pass
    never runs dry.
  - Get **prep quantities** per dish, including how many batches of a batch recipe to make.
  - Add **per-guest supplies** — napkins, cutlery kits, to-go containers, chafing fuel — the
    line items that quietly eat a catering margin.
  - See cost, revenue, profit, and cost per guest, billed either as a flat price per guest or
    à la carte at each dish's menu price.
  - Get a **shopping list**: total quantities the event draws, checked against inventory on
    hand, with shortfalls rounded up to whole purchase packs and priced.
  - Download a plain-text **prep and shopping sheet** the kitchen can print and work from, and
    **deduct the event from inventory** once it's plated.
- **Dashboard** — menu-wide view: dish count, ingredients tracked, average food cost %,
  estimated weekly profit, inventory value, items below par, and planned event profit, plus a
  sortable food-cost overview flagging dishes running over target.

A sample kitchen — 37 ingredients, 7 dishes (cheeseburger, Caesar, bolognese, salmon,
flatbread, alfredo, roasted potatoes), and 2 events (a 120-guest wedding and a 40-guest
corporate lunch) — is seeded on first load so the tool is immediately usable. Edit or delete
it freely, or use **Reset Data** to restore the sample set at any time.

## Where the sample prices come from

The seeded purchase packs and prices are real quotes captured on **2026-09-15**, not
placeholders:

- **Center-of-plate, dry goods, pantry, bakery and disposables** — WebstaurantStore product
  listings, at foodservice list price (the non-member price where both were shown), in the
  pack sizes a kitchen actually orders: a 20 lb case of 80/20 ground beef, a #10 can of
  crushed tomatoes, 96 brioche buns, 3,000 dinner napkins.
- **Fresh produce** — USDA AMS Specialty Crops *terminal market* reports for 2026-09-08 to
  09-14 (New York, Atlanta, Baltimore, Miami). Terminal market is the wholesale level a
  distributor sells to a kitchen at, which is the right benchmark here — shipping-point FOB
  prices are a step too far upstream and would understate what you actually pay.
- **Shell eggs** — USDA ERS retail price spreads, August 2026.

Menu prices on the seeded dishes are ordinary market prices, chosen to sit sensibly against
those costs; salmon and the Margherita flatbread are deliberately left tight so the
over-target flagging is visible out of the box.

Produce and protein pricing moves constantly and is regional, so treat all of it as a
starting point and overwrite it with your own invoices — that's what the Ingredients tab is
for. Each seeded ingredient carries a source tag in `js/storage.js` noting which of the
three sources it came from.
