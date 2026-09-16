import { serve } from "bun";
import { DAL } from "./db/dal";
import { deriveSessionState, calculateABV, convertUnits } from "./domain/models";

const BASE_HTML = `
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Heidrun</title>
  <script src="/htmx.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation"></script>
  <link href="/output.css" rel="stylesheet">
  <script>
    // Init theme
    const theme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    
    function toggleTheme() {
      const html = document.documentElement;
      const newTheme = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    }
  </script>
</head>
<body class="bg-base-200 text-base-content min-h-screen">
  <div class="navbar bg-base-100 shadow-sm mb-4">
    <div class="flex-1">
      <a class="btn btn-ghost normal-case text-xl" href="/" hx-get="/" hx-target="#main-content" hx-push-url="true">Heidrun</a>
      <a class="btn btn-ghost normal-case" href="/pantry" hx-get="/pantry" hx-target="#main-content" hx-push-url="true">Pantry</a>
    </div>
    <div class="flex-none">
      <button class="btn btn-square btn-ghost" onclick="toggleTheme()" title="Toggle Dark Mode">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      </button>
    </div>
  </div>
  
  <main class="container mx-auto px-4 max-w-2xl" id="main-content" hx-history-elt>
    <!-- HTMX injects content here -->
  </main>
</body>
</html>
`;

function getBadgeClasses(status: string) {
  switch (status) {
    case 'Planned': return 'bg-status-planned text-white border-status-planned';
    case 'Primary Fermentation': return 'bg-status-primary text-black border-status-primary';
    case 'Aging': return 'bg-status-aging text-white border-status-aging';
    case 'Bottled': return 'bg-status-bottled text-white border-status-bottled';
    default: return 'badge-neutral';
  }
}

function renderSessionCard(session: any) {
  const badgeClasses = getBadgeClasses(session.status);

  let startDateStr = '';
  if (session.start_date) {
    const d = new Date(session.start_date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    startDateStr = `${dd}.${mm}.${yyyy}`;
  }

  return `
    <div class="card bg-base-100 shadow-sm mb-4 transition-all duration-300 cursor-pointer border border-base-300 hover:border-primary hover:shadow-md hover:-translate-y-1" hx-get="/sessions/${session.id}" hx-target="#main-content" hx-push-url="true">
      <div class="card-body">
        <h2 class="card-title text-base-content">${session.name}</h2>
        <div class="flex gap-3 mb-2 items-center">
          <span class="badge ${badgeClasses}">${session.status}</span>
          ${startDateStr ? `
          <div class="text-sm text-pollen grid group" title="Click or hover to toggle">
            <span class="col-start-1 row-start-1 transition-opacity duration-300 opacity-100 group-hover:opacity-0 group-active:opacity-0">Age: ${session.age_formatted}</span>
            <span class="col-start-1 row-start-1 transition-opacity duration-300 opacity-0 group-hover:opacity-100 group-active:opacity-100">${startDateStr}</span>
          </div>
          ` : `
          <div class="text-sm text-pollen">
            <span>Age: ${session.age_formatted}</span>
          </div>
          `}
        </div>
        <div class="grid grid-cols-2 gap-4 mt-2">
          <div>
            <div class="text-xs text-pollen">Current SG</div>
            <div class="font-semibold text-secondary">${session.current_sg ? session.current_sg.toFixed(3) : '---'}</div>
          </div>
          <div>
            <div class="text-xs text-pollen">Calculated ABV</div>
            <div class="font-semibold text-secondary">${session.abv}%</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSessionList(sessions: any[]) {
  const sessionCards = sessions.map(renderSessionCard).join('');
  return `
    <div>
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">Your Batches</h1>
        <button class="btn btn-primary" hx-get="/sessions/new" hx-target="#main-content" hx-push-url="true">New Batch</button>
      </div>
      ${sessions.length > 0 ? sessionCards : '<div class="text-center py-10 opacity-60">No batches yet. Start brewing!</div>'}
    </div>
  `;
}

function getEventIcon(type: string) {
  switch(type) {
    case 'sg_reading':
      return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6" style="color: var(--color-honey)"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>`;
    case 'addition':
      return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6" style="color: var(--color-status-primary)"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>`;
    case 'racking':
      return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6" style="color: var(--color-status-aging)"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>`;
    case 'bottling':
      return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6" style="color: var(--color-status-bottled)"><path stroke-linecap="round" stroke-linejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>`;
    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-6 h-6 text-neutral"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" /></svg>`;
  }
}

function renderSessionDetail(sessionId: number): string {
  const session = DAL.getSessionById(sessionId);
  if (!session) return `<div class="alert alert-error">Session not found</div>`;
  
  const events = DAL.getEventsForSession(sessionId);
  const fullSession = deriveSessionState(session, events);
  
  let startDateStr = '';
  if (fullSession.start_date) {
    const d = new Date(fullSession.start_date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    startDateStr = `${dd}.${mm}.${yyyy}`;
  }
  
  const chartSgData = [];
  const chartAbvData = [];
  const chartAnnotations = [];
  
  if (fullSession.start_date) {
    const startMs = new Date(fullSession.start_date).getTime();
    let og: number | null = null;
    const sorted = [...events].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    sorted.forEach((e) => {
      const day = (new Date(e.timestamp).getTime() - startMs) / (1000 * 60 * 60 * 24);
      if (e.type === 'sg_reading') {
        let sg = e.data?.sg;
        if (sg) {
          if (sg > 2) sg = sg / 1000;
          if (og === null) og = sg;
          chartSgData.push({ x: day, y: sg });
          const abv = (og! - sg) * 131.25;
          chartAbvData.push({ x: day, y: Number(abv.toFixed(2)) });
        }
      } else {
        let label = e.type;
        let color = '#8A8377'; // Planned/neutral
        if (e.type === 'addition') { label = 'Addition'; color = '#F4C430'; } // Ferment Gold
        if (e.type === 'racking') { label = 'Racking'; color = '#7A4A3A'; } // Oak Barrel
        if (e.type === 'bottling') { label = 'Bottled'; color = '#4E795B'; } // Botanical Sage
        
        chartAnnotations.push({
          type: 'line',
          xMin: day,
          xMax: day,
          borderColor: color,
          borderWidth: 2,
          borderDash: [4, 4],
          label: {
            display: true,
            content: label,
            position: 'start',
            backgroundColor: color,
            color: 'white',
            font: { size: 10 }
          }
        });
      }
    });
  }
  
  const chartConfigJSON = JSON.stringify({
    sgData: chartSgData,
    abvData: chartAbvData,
    annotations: chartAnnotations
  });

  return `
    <div>
      <div class="flex items-center justify-between mb-2">
        <button class="btn btn-sm btn-ghost text-pollen" hx-get="/" hx-target="#main-content" hx-push-url="true">&larr; Back</button>
        ${startDateStr ? `
        <div class="text-sm text-pollen grid group cursor-default" title="Click or hover to toggle age">
          <span class="col-start-1 row-start-1 transition-opacity duration-300 opacity-100 group-hover:opacity-0 group-active:opacity-0">Age: ${fullSession.age_formatted}</span>
          <span class="col-start-1 row-start-1 transition-opacity duration-300 opacity-0 group-hover:opacity-100 group-active:opacity-100">Started: ${startDateStr}</span>
        </div>
        ` : `<div class="text-sm text-pollen">Age: ${fullSession.age_formatted}</div>`}
      </div>
      <div class="flex justify-between items-center mb-2 mt-2">
        <h2 class="text-3xl font-bold text-base-content flex items-center gap-2">
          ${fullSession.name}
          <button class="btn btn-ghost btn-sm text-pollen" onclick="document.getElementById('edit_session_name_modal').showModal()" title="Edit Batch Name">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>
          </button>
        </h2>
      </div>
      <div class="badge ${getBadgeClasses(fullSession.status)} mb-6">${fullSession.status}</div>
      
      <div class="stats shadow w-full mb-6 flex-wrap bg-base-100 border border-base-300">
        <div class="stat place-items-center">
          <div class="stat-title text-pollen">Original Gravity</div>
          <div class="stat-value text-2xl text-secondary">${fullSession.original_sg ? fullSession.original_sg.toFixed(3) : '---'}</div>
        </div>
        <div class="stat place-items-center">
          <div class="stat-title text-pollen">Current SG</div>
          <div class="stat-value text-2xl text-secondary flex items-center gap-2">
            ${fullSession.current_sg ? fullSession.current_sg.toFixed(3) : '---'}
            ${fullSession.current_sg && fullSession.original_sg && fullSession.current_sg < fullSession.original_sg ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>` : ''}
          </div>
        </div>
        <div class="stat place-items-center">
          <div class="stat-title text-pollen">Calculated ABV</div>
          <div class="stat-value text-2xl text-secondary">${fullSession.abv}%</div>
        </div>
      </div>

      ${(() => {
        const additionEvents = (fullSession.events || []).filter(e => e.type === 'addition');
        if (additionEvents.length === 0) return '';
        
        let totalCost = 0;
        const usedItems: string[] = [];
        
        additionEvents.forEach(e => {
           if (e.data?.inventory_item_id) {
             const invItem = DAL.getInventoryItemById(e.data.inventory_item_id);
             if (invItem) {
               const qty = e.data.quantity_used;
               const unit = e.data.unit || invItem.unit;
               let costStr = '';
               if (invItem.cost_per_unit) {
                  // convert qty to inventory base unit to calculate cost
                  const baseQty = convertUnits(qty, unit, invItem.unit);
                  const cost = baseQty * invItem.cost_per_unit;
                  totalCost += cost;
                  costStr = ` (~${cost.toFixed(2)} ${invItem.currency || 'NOK'})`;
               }
               usedItems.push(`<li><span class="font-semibold">${invItem.name}</span>: ${qty} ${unit}${costStr}</li>`);
             }
           } else {
             const inventoryOptions = DAL.getInventoryItems().map(i => `<option value="${i.id}">${i.name} (Stock: ${i.quantity_on_hand.toFixed(2)} ${i.unit})</option>`).join('');
             let displayStr = '';
             if (e.data?.ingredient) {
                displayStr = `<span class="font-semibold">${e.data.ingredient}</span>: ${e.data.quantity_used || ''} ${e.data.unit || ''}`;
                if (e.data?.note) displayStr += ` - ${e.data.note}`;
             } else if (e.data?.note) {
                displayStr = e.data.note;
             } else {
                displayStr = "Unknown Addition";
             }
             
             const formHtml = `
                <form hx-post="/sessions/${fullSession.id}/events/${e.id}/link" hx-target="#main-content" class="mt-1 flex flex-wrap items-center gap-1 p-2 bg-base-200 rounded-md border border-base-300 w-fit">
                  <span class="text-xs font-semibold mr-1">Link item:</span>
                  <select name="inventory_item_id" class="select select-bordered select-xs w-32" required>
                    <option value="" disabled selected>Select...</option>
                    ${inventoryOptions}
                  </select>
                  <input type="number" step="any" name="quantity" class="input input-bordered input-xs w-16" placeholder="Qty" required value="${e.data?.quantity_used || ''}" />
                  <select name="unit" class="select select-bordered select-xs w-20" required>
                    <option value="g" ${e.data?.unit === 'g' ? 'selected' : ''}>g</option>
                    <option value="kg" ${e.data?.unit === 'kg' ? 'selected' : ''}>kg</option>
                    <option value="ml" ${e.data?.unit === 'ml' ? 'selected' : ''}>ml</option>
                    <option value="L" ${e.data?.unit === 'L' ? 'selected' : ''}>L</option>
                    <option value="packets" ${e.data?.unit === 'packets' ? 'selected' : ''}>packets</option>
                    <option value="oz" ${e.data?.unit === 'oz' ? 'selected' : ''}>oz</option>
                    <option value="lb" ${e.data?.unit === 'lb' ? 'selected' : ''}>lb</option>
                    <option value="tsp" ${e.data?.unit === 'tsp' ? 'selected' : ''}>tsp</option>
                  </select>
                  <button type="submit" class="btn btn-xs btn-primary">Link</button>
                </form>
             `;
             usedItems.push(`<li class="mb-3">${displayStr}${formHtml}</li>`);
           }
        });
        
        if (usedItems.length === 0) return '';
        
        return `
          <div class="card bg-base-100 border border-base-300 shadow-sm mb-6">
            <div class="card-body p-4">
              <h3 class="card-title text-base-content text-lg mb-2">Ingredients Used</h3>
              <ul class="list-disc list-inside text-sm text-base-content mb-2">
                ${usedItems.join('')}
              </ul>
              ${totalCost > 0 ? `<div class="text-sm font-bold text-secondary mt-2 border-t border-base-200 pt-2">Estimated Batch Cost: ${totalCost.toFixed(2)} NOK</div>` : ''}
            </div>
          </div>
        `;
      })()}
      
      ${chartSgData.length > 0 ? `
      <div class="card bg-base-100 border border-base-300 shadow-sm mb-8">
        <div class="card-body p-4">
          <h3 class="card-title text-base-content text-lg mb-2">Fermentation Curve</h3>
          <div class="w-full relative" style="height: 300px;">
            <canvas id="fermentationChart"></canvas>
          </div>
        </div>
      </div>
      <script>
        setTimeout(() => {
           const ctx = document.getElementById('fermentationChart');
           if (!ctx) return;
           
           const data = ${chartConfigJSON};
           
           if (window.fermentationChartInstance) {
             window.fermentationChartInstance.destroy();
           }
           
           window.fermentationChartInstance = new Chart(ctx, {
             type: 'scatter',
             data: {
               datasets: [
                 {
                   label: 'Specific Gravity',
                   data: data.sgData,
                   borderColor: '#E5A93C',
                   backgroundColor: '#E5A93C',
                   yAxisID: 'ySG',
                   showLine: true,
                   tension: 0.2,
                   borderWidth: 3
                 },
                 {
                   label: 'ABV (%)',
                   data: data.abvData,
                   borderColor: '#4E795B',
                   backgroundColor: '#4E795B',
                   borderDash: [5, 5],
                   yAxisID: 'yABV',
                   showLine: true,
                   tension: 0.2,
                   borderWidth: 2
                 }
               ]
             },
             options: {
               responsive: true,
               maintainAspectRatio: false,
               scales: {
                 x: {
                   type: 'linear',
                   title: { display: true, text: 'Days in Fermentation' }
                 },
                 ySG: {
                   type: 'linear',
                   position: 'left',
                   title: { display: true, text: 'Specific Gravity' },
                   ticks: {
                     callback: function(value) { return value.toFixed(3); }
                   }
                 },
                 yABV: {
                   type: 'linear',
                   position: 'right',
                   title: { display: true, text: 'ABV %' },
                   grid: { drawOnChartArea: false },
                   ticks: {
                     callback: function(value) { return value.toFixed(1) + '%'; }
                   }
                 }
               },
               plugins: {
                 annotation: {
                   annotations: data.annotations
                 }
               }
             }
           });
        }, 10);
      </script>
      ` : ''}
      
      <h3 class="text-xl font-bold mb-4 text-base-content">Log Event</h3>
      <form hx-post="/sessions/${sessionId}/events" hx-target="#main-content" class="flex flex-col gap-4 mb-10 max-w-sm">
        <div class="form-control w-full">
          <label class="label"><span class="label-text">Event Type</span></label>
          <select name="type" id="event-type-select" class="select select-bordered" required onchange="updateFormFields()">
            <option value="sg_reading">SG Reading</option>
            <option value="addition">Addition (Nutrients, etc.)</option>
            <option value="racking">Racking</option>
            <option value="bottling">Bottling</option>
          </select>
          <p id="event-description" class="text-sm text-pollen mt-2 leading-tight"></p>
        </div>
        <div class="form-control w-full">
          <label class="label"><span class="label-text">Date & Time</span></label>
          <input type="datetime-local" name="timestamp" id="event-timestamp-input" required class="input input-bordered w-full" />
        </div>
        
        <div id="standard-data-container" class="form-control w-full">
          <label class="label"><span class="label-text" id="event-data-label">SG Value</span></label>
          <input type="text" name="data" id="event-data-input" class="input input-bordered w-full" />
        </div>

        <div id="addition-data-container" class="hidden flex-col gap-3">
          <div class="form-control w-full">
            <label class="label"><span class="label-text">Inventory Item</span></label>
            <select name="inventory_item_id" id="event-inventory-select" class="select select-bordered" onchange="toggleCustomIngredient()">
              <option value="">-- Custom / Not in Inventory --</option>
              ${(() => {
                 const inv = DAL.getInventoryItems();
                 return inv.map(i => `<option value="${i.id}" data-unit="${i.unit}">${i.name} (Stock: ${i.quantity_on_hand} ${i.unit})</option>`).join('');
              })()}
            </select>
          </div>
          <div class="form-control w-full hidden" id="custom-ingredient-container">
            <label class="label"><span class="label-text">Ingredient Name</span></label>
            <input type="text" name="custom_ingredient" id="custom-ingredient-input" class="input input-bordered w-full" placeholder="e.g. Cinnamon Stick" />
          </div>
          <div class="flex gap-2">
            <div class="form-control w-1/2">
              <label class="label"><span class="label-text">Quantity</span></label>
              <input type="number" step="any" name="quantity_used" id="quantity-used-input" class="input input-bordered w-full" />
            </div>
            <div class="form-control w-1/2">
              <label class="label"><span class="label-text">Unit</span></label>
              <select name="unit" id="unit-select" class="select select-bordered">
                <option value="g">g</option>
                <option value="kg">kg</option>
                <option value="ml">ml</option>
                <option value="L">L</option>
                <option value="packets">packets</option>
                <option value="oz">oz</option>
                <option value="lb">lb</option>
                <option value="tsp">tsp</option>
              </select>
            </div>
          </div>
        </div>

        <button type="submit" class="btn btn-primary w-fit">Log</button>
      </form>
      <script>
        function toggleCustomIngredient() {
          const select = document.getElementById('event-inventory-select');
          const customContainer = document.getElementById('custom-ingredient-container');
          const unitSelect = document.getElementById('unit-select');
          if (select.value === "") {
            customContainer.classList.remove('hidden');
          } else {
            customContainer.classList.add('hidden');
            const selectedOption = select.options[select.selectedIndex];
            if (selectedOption && selectedOption.dataset.unit) {
               unitSelect.value = selectedOption.dataset.unit;
            }
          }
        }
      
        function updateFormFields() {
          const type = document.getElementById('event-type-select').value;
          const desc = document.getElementById('event-description');
          
          const standardContainer = document.getElementById('standard-data-container');
          const additionContainer = document.getElementById('addition-data-container');
          
          const label = document.getElementById('event-data-label');
          const input = document.getElementById('event-data-input');
          
          const qtyInput = document.getElementById('quantity-used-input');
          
          if (type === 'addition') {
             standardContainer.classList.add('hidden');
             additionContainer.classList.remove('hidden');
             additionContainer.classList.add('flex');
             desc.innerText = "Log additions like yeast pitching, staggered nutrient additions (SNA), fruit, or spices.";
             
             input.required = false;
             qtyInput.required = true;
             toggleCustomIngredient();
          } else {
             additionContainer.classList.add('hidden');
             additionContainer.classList.remove('flex');
             standardContainer.classList.remove('hidden');
             qtyInput.required = false;
             
            if (type === 'sg_reading') {
              desc.innerText = "Record the Specific Gravity (SG). The first reading acts as your Original Gravity (OG) to calculate ABV.";
              label.innerText = "SG Value";
              input.type = "number";
              input.step = "0.001";
              input.placeholder = "e.g. 1.090";
              input.required = true;
            } else if (type === 'racking') {
              desc.innerText = "Transfer off the sediment (lees) to a new vessel. Progresses the batch to the Aging stage.";
              label.innerText = "Notes (Optional)";
              input.type = "text";
              input.removeAttribute("step");
              input.placeholder = "e.g. Racked to glass carboy";
              input.required = false;
            } else if (type === 'bottling') {
              desc.innerText = "Final packaging. Completes the batch and moves it to the Bottled stage.";
              label.innerText = "Notes (Optional)";
              input.type = "text";
              input.removeAttribute("step");
              input.placeholder = "e.g. Yielded 10 bottles";
              input.required = false;
            }
          }
        }
        
        // Initialize default date
        const tzOffset = (new Date()).getTimezoneOffset() * 60000;
        const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 16);
        document.getElementById('event-timestamp-input').value = localISOTime;
        
        updateFormFields();
      </script>
      
      <h3 class="text-xl font-bold mb-4 text-base-content">Event History</h3>
      <div class="overflow-x-auto pb-6">
        <ul class="timeline">
          ${fullSession.events && fullSession.events.length > 0 ? 
            [...fullSession.events].reverse().map((e, index, arr) => `
            <li>
              ${index > 0 ? '<hr/>' : ''}
              <div class="timeline-start text-xs text-pollen mb-2 whitespace-nowrap">
                ${new Date(e.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toLowerCase()}
              </div>
              <div class="timeline-middle bg-base-100 rounded-full p-1 shadow-sm border border-base-300">
                ${getEventIcon(e.type)}
              </div>
              <div class="timeline-end timeline-box bg-base-100 border-base-300 mt-2 flex items-center gap-3">
                <div class="flex flex-col">
                  <span class="font-bold text-sm uppercase text-base-content">${e.type.replace('_', ' ')}</span>
                  <span class="text-sm text-base-content">${(() => {
                    if (e.type === 'sg_reading') return e.data?.sg?.toFixed(3) || '';
                    if (e.type === 'addition') {
                      let itemText = '';
                      if (e.data?.inventory_item_id) {
                        const invItem = DAL.getInventoryItemById(e.data.inventory_item_id);
                        if (invItem) {
                          itemText = `${invItem.name}: ${e.data.quantity_used || ''} ${e.data.unit || invItem.unit || ''}`;
                        }
                      } else if (e.data?.ingredient) {
                        itemText = `${e.data.ingredient}: ${e.data.quantity_used || ''} ${e.data.unit || ''}`;
                      }
                      const note = e.data?.note ? ` - ${e.data.note}` : '';
                      return itemText ? (itemText + note).trim() : (e.data?.note || '');
                    }
                    return e.data?.note || '';
                  })()}</span>
                </div>
                <button class="btn btn-ghost btn-xs text-primary ml-auto" onclick='openEditEventModal(${JSON.stringify(e).replace(/'/g, "&#39;")})' title="Edit Event">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>
                </button>
                <button class="btn btn-ghost btn-xs text-error ml-1" hx-delete="/sessions/${sessionId}/events/${e.id}" hx-target="#main-content" hx-confirm="Are you sure you want to delete this event?" title="Delete Event">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                </button>
              </div>
              ${index < arr.length - 1 ? '<hr/>' : ''}
            </li>
          `).join('') : '<div class="text-pollen">No events logged yet.</div>'}
        </ul>
      </div>

      <!-- Edit Event Modal -->
      <dialog id="edit_event_modal" class="modal">
        <div class="modal-box">
          <h3 class="font-bold text-lg mb-4">Edit Event</h3>
          <form id="edit_event_form" hx-post="/sessions/${fullSession.id}/events/edit" hx-target="#main-content" onsubmit="document.getElementById('edit_event_modal').close()">
            <input type="hidden" name="id" id="edit-event-id" />
            <input type="hidden" name="type" id="edit-event-type" />
            
            <div class="form-control w-full mb-3">
              <label class="label"><span class="label-text">Date & Time</span></label>
              <input type="datetime-local" name="timestamp" id="edit-event-timestamp" required class="input input-bordered w-full" />
            </div>

            <!-- Dynamic Fields -->
            <div id="edit-event-dynamic-fields"></div>
            
            <div class="modal-action">
              <button type="button" class="btn" onclick="document.getElementById('edit_event_modal').close()">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      <!-- Edit Session Name Modal -->
      <dialog id="edit_session_name_modal" class="modal">
        <div class="modal-box">
          <h3 class="font-bold text-lg mb-4">Edit Batch Name</h3>
          <form hx-post="/sessions/${fullSession.id}/name" hx-target="#main-content" onsubmit="document.getElementById('edit_session_name_modal').close()">
            <div class="form-control w-full mb-3">
              <label class="label"><span class="label-text">Name</span></label>
              <input type="text" name="name" required class="input input-bordered w-full" value="${fullSession.name.replace(/"/g, '&quot;')}" />
            </div>
            <div class="modal-action">
              <button type="button" class="btn" onclick="document.getElementById('edit_session_name_modal').close()">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
      
      <script>
        function openEditEventModal(event) {
          document.getElementById('edit-event-id').value = event.id;
          document.getElementById('edit-event-type').value = event.type;
          
          const localTime = new Date(new Date(event.timestamp).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
          document.getElementById('edit-event-timestamp').value = localTime;
          
          const dyn = document.getElementById('edit-event-dynamic-fields');
          if (event.type === 'sg_reading') {
            dyn.innerHTML = \`
              <div class="form-control w-full mb-3">
                <label class="label"><span class="label-text">SG Value</span></label>
                <input type="number" step="0.001" name="sg" required class="input input-bordered w-full" value="\${event.data?.sg || ''}" />
              </div>
            \`;
          } else if (event.type === 'racking' || event.type === 'bottling') {
            dyn.innerHTML = \`
              <div class="form-control w-full mb-3">
                <label class="label"><span class="label-text">Notes</span></label>
                <input type="text" name="note" class="input input-bordered w-full" value="\${event.data?.note || ''}" />
              </div>
            \`;
          } else if (event.type === 'addition') {
            dyn.innerHTML = \`
              <div class="form-control w-full mb-3">
                <label class="label"><span class="label-text">Notes / Ingredient</span></label>
                <input type="text" name="note" class="input input-bordered w-full" value="\${event.data?.note || event.data?.ingredient || ''}" placeholder="e.g. 4.2g Fermaid-O" />
              </div>
              \${event.data?.quantity_used !== undefined ? \`
                <div class="flex gap-2 mb-3">
                  <div class="form-control w-1/2">
                    <label class="label"><span class="label-text">Quantity</span></label>
                    <input type="number" step="any" name="quantity_used" class="input input-bordered w-full" value="\${event.data.quantity_used}" />
                  </div>
                  <div class="form-control w-1/2">
                    <label class="label"><span class="label-text">Unit</span></label>
                    <input type="text" name="unit" class="input input-bordered w-full" value="\${event.data.unit || ''}" />
                  </div>
                </div>
              \` : ''}
            \`;
          }
          
          document.getElementById('edit_event_modal').showModal();
        }
      </script>
    </div>
  `;
}

function renderPantry(): string {
  const items = DAL.getInventoryItems();
  
  // Group by category
  const categories = ['Honey & Sugars', 'Yeast & Cultures', 'Nutrients & Additives', 'Fruits & Adjuncts'];
  const grouped: Record<string, any[]> = {};
  categories.forEach(c => grouped[c] = []);
  
  items.forEach(item => {
    if (grouped[item.category]) grouped[item.category].push(item);
  });

  const categoryBlocks = categories.map(cat => {
    const catItems = grouped[cat];
    if (catItems.length === 0) return '';
    
    return `
      <div class="mb-6">
        <h3 class="text-lg font-bold text-base-content border-b border-base-300 pb-2 mb-3">${cat}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${catItems.map(item => `
            <div class="card bg-base-100 shadow-sm border border-base-300 group">
              <div class="card-body p-4">
                <div class="flex justify-between items-start">
                  <div>
                    <h4 class="font-semibold text-base-content flex items-center gap-2">
                      ${item.name}
                    </h4>
                    <div class="text-xs text-pollen mt-1">${item.cost_per_unit ? (item.cost_per_unit + ' ' + (item.currency || 'NOK') + ' / ' + item.unit) : 'No cost data'}</div>
                  </div>
                  <div class="text-right">
                    <div class="text-xl font-bold text-secondary">${item.quantity_on_hand.toFixed(2).replace(/\.00$/, '')}</div>
                    <div class="text-xs text-pollen uppercase">${item.unit}</div>
                  </div>
                </div>
                <div class="mt-2 pt-2 border-t border-base-200 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  ${item.url ? (() => {
                     try {
                        const urlObj = new URL(item.url);
                        const domain = urlObj.hostname.replace(/^www\./, '');
                        return `<a href="${item.url}" target="_blank" class="btn btn-xs btn-outline text-primary mr-auto">Go to ${domain}</a>`;
                     } catch(e) { return ''; }
                  })() : ''}
                  <button class="btn btn-xs btn-ghost text-pollen hover:text-primary" onclick='openEditModal(${JSON.stringify(item).replace(/'/g, "&#39;")})'>Edit</button>
                  <button class="btn btn-xs btn-ghost text-error" hx-delete="/pantry/${item.id}" hx-target="#main-content" hx-confirm="Are you sure you want to delete this item?">Delete</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div>
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">Pantry Inventory</h1>
        <button class="btn btn-primary" onclick="document.getElementById('add_inventory_modal').showModal()">Add Item</button>
      </div>
      
      ${items.length === 0 ? '<div class="text-center py-10 opacity-60">Your pantry is empty.</div>' : categoryBlocks}
      
      <dialog id="add_inventory_modal" class="modal">
        <div class="modal-box">
          <h3 class="font-bold text-lg mb-4">Add Inventory Item</h3>
          <form hx-post="/pantry" hx-target="#main-content" hx-push-url="true" onsubmit="document.getElementById('add_inventory_modal').close()">
            <div class="form-control w-full mb-3">
              <label class="label"><span class="label-text">Name</span></label>
              <input type="text" name="name" required class="input input-bordered w-full" placeholder="e.g. Wildflower Honey" />
            </div>
            <div class="form-control w-full mb-3">
              <label class="label"><span class="label-text">Category</span></label>
              <select name="category" class="select select-bordered" required>
                <option value="Honey & Sugars">Honey & Sugars</option>
                <option value="Yeast & Cultures">Yeast & Cultures</option>
                <option value="Nutrients & Additives">Nutrients & Additives</option>
                <option value="Fruits & Adjuncts">Fruits & Adjuncts</option>
              </select>
            </div>
            <div class="flex gap-4 mb-3">
              <div class="form-control w-1/2">
                <label class="label"><span class="label-text">Initial Quantity</span></label>
                <input type="number" step="0.01" name="quantity" required class="input input-bordered w-full" />
              </div>
              <div class="form-control w-1/2">
                <label class="label"><span class="label-text">Unit</span></label>
                <select name="unit" class="select select-bordered" required>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="ml">ml</option>
                  <option value="L">L</option>
                  <option value="packets">packets</option>
                  <option value="oz">oz</option>
                  <option value="lb">lb</option>
                  <option value="tsp">tsp</option>
                </select>
              </div>
            </div>
            <div class="flex gap-4 mb-3">
              <div class="form-control w-1/2">
                <label class="label"><span class="label-text">Cost per unit (Optional)</span></label>
                <input type="number" step="0.01" name="cost" class="input input-bordered w-full" />
              </div>
              <div class="form-control w-1/2">
                <label class="label"><span class="label-text">Currency</span></label>
                <input type="text" name="currency" class="input input-bordered w-full" value="NOK" />
              </div>
            </div>
            <div class="form-control w-full mb-5">
              <label class="label"><span class="label-text">Link (Optional URL)</span></label>
              <input type="url" name="url" class="input input-bordered w-full" placeholder="https://..." />
            </div>
            <div class="modal-action">
              <button type="button" class="btn" onclick="document.getElementById('add_inventory_modal').close()">Cancel</button>
              <button type="submit" class="btn btn-primary">Add Item</button>
            </div>
          </form>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      <dialog id="edit_inventory_modal" class="modal">
        <div class="modal-box">
          <h3 class="font-bold text-lg mb-4">Edit Inventory Item</h3>
          <form id="edit_inventory_form" hx-post="/pantry/edit" hx-target="#main-content" hx-push-url="true" onsubmit="document.getElementById('edit_inventory_modal').close()">
            <input type="hidden" name="id" id="edit-id" />
            <div class="form-control w-full mb-3">
              <label class="label"><span class="label-text">Name</span></label>
              <input type="text" name="name" id="edit-name" required class="input input-bordered w-full" />
            </div>
            <div class="form-control w-full mb-3">
              <label class="label"><span class="label-text">Category</span></label>
              <select name="category" id="edit-category" class="select select-bordered" required>
                <option value="Honey & Sugars">Honey & Sugars</option>
                <option value="Yeast & Cultures">Yeast & Cultures</option>
                <option value="Nutrients & Additives">Nutrients & Additives</option>
                <option value="Fruits & Adjuncts">Fruits & Adjuncts</option>
              </select>
            </div>
            <div class="flex gap-4 mb-3">
              <div class="form-control w-1/2">
                <label class="label"><span class="label-text">Quantity</span></label>
                <input type="number" step="0.01" name="quantity" id="edit-quantity" required class="input input-bordered w-full" />
              </div>
              <div class="form-control w-1/2">
                <label class="label"><span class="label-text">Unit</span></label>
                <select name="unit" id="edit-unit" class="select select-bordered" required>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="ml">ml</option>
                  <option value="L">L</option>
                  <option value="packets">packets</option>
                  <option value="oz">oz</option>
                  <option value="lb">lb</option>
                  <option value="tsp">tsp</option>
                </select>
              </div>
            </div>
            <div class="flex gap-4 mb-3">
              <div class="form-control w-1/2">
                <label class="label"><span class="label-text">Cost per unit (Optional)</span></label>
                <input type="number" step="0.01" name="cost" id="edit-cost" class="input input-bordered w-full" />
              </div>
              <div class="form-control w-1/2">
                <label class="label"><span class="label-text">Currency</span></label>
                <input type="text" name="currency" id="edit-currency" class="input input-bordered w-full" />
              </div>
            </div>
            <div class="form-control w-full mb-5">
              <label class="label"><span class="label-text">Link (Optional URL)</span></label>
              <input type="url" name="url" id="edit-url" class="input input-bordered w-full" />
            </div>
            <div class="modal-action">
              <button type="button" class="btn" onclick="document.getElementById('edit_inventory_modal').close()">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      <script>
        function openEditModal(item) {
          document.getElementById('edit-id').value = item.id;
          document.getElementById('edit-name').value = item.name;
          document.getElementById('edit-category').value = item.category;
          document.getElementById('edit-quantity').value = item.quantity_on_hand;
          document.getElementById('edit-unit').value = item.unit;
          document.getElementById('edit-cost').value = item.cost_per_unit || '';
          document.getElementById('edit-currency').value = item.currency || 'NOK';
          document.getElementById('edit-url').value = item.url || '';
          
          document.getElementById('edit_inventory_modal').showModal();
        }
      </script>
    </div>
  `;
}

serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/htmx.js") {
      return new Response(Bun.file("node_modules/htmx.org/dist/htmx.min.js"));
    }
    if (url.pathname === "/output.css") {
      return new Response(Bun.file("public/output.css"));
    }
    
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      const rawSessions = DAL.getSessions();
      const sessions = rawSessions.map(s => {
        const events = DAL.getEventsForSession(s.id);
        return deriveSessionState(s, events);
      });
      
      const content = renderSessionList(sessions);
      
      if (req.headers.get("HX-Request") === "true") {
        return new Response(content, { headers: { "Content-Type": "text/html" } });
      }
      
      const html = BASE_HTML.replace('<!-- HTMX injects content here -->', content);
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    if (req.method === "GET" && url.pathname === "/pantry") {
      const content = renderPantry();
      if (req.headers.get("HX-Request") === "true") {
        return new Response(content, { headers: { "Content-Type": "text/html" } });
      }
      const html = BASE_HTML.replace('<!-- HTMX injects content here -->', content);
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    if (req.method === "POST" && url.pathname === "/pantry") {
      const formData = await req.formData();
      const name = formData.get("name") as string;
      const category = formData.get("category") as any;
      const quantity = parseFloat(formData.get("quantity") as string);
      const unit = formData.get("unit") as string;
      const costStr = formData.get("cost") as string;
      const cost = costStr ? parseFloat(costStr) : undefined;
      const currency = formData.get("currency") as string || undefined;
      let itemUrl = formData.get("url") as string || undefined;

      if (itemUrl) {
         if (!/^https?:\/\//i.test(itemUrl)) {
            itemUrl = 'https://' + itemUrl;
         }
         try {
            new URL(itemUrl);
         } catch (e) {
            itemUrl = undefined;
         }
      }

      if (name && category && !isNaN(quantity) && unit) {
        DAL.addInventoryItem({
          name,
          category,
          quantity_on_hand: quantity,
          unit,
          cost_per_unit: cost,
          currency,
          url: itemUrl
        });
      }

      const content = renderPantry();
      return new Response(content, { 
        headers: { 
          "Content-Type": "text/html",
          "HX-Push-Url": "/pantry"
        } 
      });
    }

    if (req.method === "POST" && url.pathname === "/pantry/edit") {
      const formData = await req.formData();
      const idStr = formData.get("id") as string;
      const id = parseInt(idStr);
      
      const name = formData.get("name") as string;
      const category = formData.get("category") as any;
      const quantityStr = formData.get("quantity") as string;
      const quantity = quantityStr ? parseFloat(quantityStr) : undefined;
      const unit = formData.get("unit") as string;
      const costStr = formData.get("cost") as string;
      const cost = costStr ? parseFloat(costStr) : undefined;
      const currency = formData.get("currency") as string || undefined;
      let itemUrl: string | null | undefined = formData.get("url") as string || undefined;
      
      if (itemUrl) {
         if (!/^https?:\/\//i.test(itemUrl)) {
            itemUrl = 'https://' + itemUrl;
         }
         try {
            new URL(itemUrl);
         } catch (e) {
            itemUrl = undefined; // reset on invalid, so it doesn't get saved
         }
      } else {
         itemUrl = null; // explicitly clear out if empty
      }
      
      if (!isNaN(id)) {
        DAL.updateInventoryItem(id, {
          ...(name && { name }),
          ...(category && { category }),
          ...(quantity !== undefined && !isNaN(quantity) && { quantity_on_hand: quantity }),
          ...(unit && { unit }),
          cost_per_unit: cost,
          currency,
          url: itemUrl === null ? "" : itemUrl // models.ts interface expects optional string.
        });
      }
      
      const content = renderPantry();
      return new Response(content, { 
        headers: { 
          "Content-Type": "text/html",
          "HX-Push-Url": "/pantry"
        } 
      });
    }

    if (req.method === "DELETE" && url.pathname.match(/^\/pantry\/\d+$/)) {
      const idStr = url.pathname.split("/")[2];
      const id = parseInt(idStr);
      
      if (!isNaN(id)) {
        DAL.deleteInventoryItem(id);
      }
      
      const content = renderPantry();
      return new Response(content, { 
        headers: { 
          "Content-Type": "text/html",
          "HX-Push-Url": "/pantry"
        } 
      });
    }

    if (req.method === "GET" && url.pathname === "/sessions/new") {
      const recipes = DAL.getRecipes();
      const options = recipes.map(r => {
        const safeDesc = (r.description || '').replace(/"/g, '&quot;');
        return `<option value="${r.id}" data-desc="${safeDesc}">${r.name}</option>`;
      }).join('');
      
      const content = `
        <div>
          <h2 class="text-3xl font-bold mb-6 text-base-content">Start New Batch</h2>
          <form hx-post="/sessions" hx-target="#main-content" hx-push-url="/" class="flex flex-col gap-4">
            <div class="form-control w-full max-w-sm">
              <label class="label"><span class="label-text">Batch Name</span></label>
              <input type="text" name="name" placeholder="e.g. Summer Melomel" required class="input input-bordered w-full max-w-sm" />
            </div>
            <div class="form-control w-full max-w-sm">
              <label class="label"><span class="label-text">Recipe / Foundation</span></label>
              <select name="recipe_id" id="recipe-select" class="select select-bordered" required onchange="updateRecipeDesc()">
                ${options}
              </select>
              <p id="recipe-desc" class="text-sm text-pollen mt-2 leading-tight"></p>
            </div>
            <div class="mt-4 flex gap-2">
              <button type="submit" class="btn btn-primary">Start Session</button>
              <button type="button" class="btn btn-ghost" hx-get="/" hx-target="#main-content" hx-push-url="true">Cancel</button>
            </div>
          </form>
          <script>
            function updateRecipeDesc() {
              const select = document.getElementById('recipe-select');
              if (select && select.options.length > 0) {
                const desc = select.options[select.selectedIndex].getAttribute('data-desc');
                document.getElementById('recipe-desc').innerHTML = desc || '';
              }
            }
            updateRecipeDesc();
          </script>
        </div>
      `;
      
      if (req.headers.get("HX-Request") === "true") {
        return new Response(content, { headers: { "Content-Type": "text/html" } });
      }
      
      const html = BASE_HTML.replace('<!-- HTMX injects content here -->', content);
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    if (req.method === "POST" && url.pathname === "/sessions") {
      const formData = await req.formData();
      const name = formData.get("name") as string;
      const recipeId = parseInt(formData.get("recipe_id") as string);
      
      if (name && !isNaN(recipeId)) {
        DAL.createSession(recipeId, name);
      }
      
      // After creation, render the session list (like GET /)
      const rawSessions = DAL.getSessions();
      const sessions = rawSessions.map(s => deriveSessionState(s, DAL.getEventsForSession(s.id)));
      const content = renderSessionList(sessions);
      
      return new Response(content, { 
        headers: { 
          "Content-Type": "text/html",
          "HX-Push-Url": "/"
        } 
      });
    }

    // Stub for session details view
    if (req.method === "GET" && url.pathname.startsWith("/sessions/")) {
      const idStr = url.pathname.split("/")[2];
      const id = parseInt(idStr);
      if (!isNaN(id)) {
        const content = renderSessionDetail(id);
        if (req.headers.get("HX-Request") === "true") {
          return new Response(content, { headers: { "Content-Type": "text/html" } });
        }
        const html = BASE_HTML.replace('<!-- HTMX injects content here -->', content);
        return new Response(html, { headers: { "Content-Type": "text/html" } });
      }
    }
    
    if (req.method === "POST" && url.pathname.match(/^\/sessions\/\d+\/name$/)) {
      const idStr = url.pathname.split("/")[2];
      const sessionId = parseInt(idStr);
      const formData = await req.formData();
      const name = formData.get("name") as string;
      
      if (!isNaN(sessionId) && name) {
        DAL.updateSessionName(sessionId, name);
      }
      
      const content = renderSessionDetail(sessionId);
      return new Response(content, {
        status: 200,
        headers: { "Content-Type": "text/html" }
      });
    }
    
    if (req.method === "POST" && url.pathname.match(/^\/sessions\/\d+\/events$/)) {
      const idStr = url.pathname.split("/")[2];
      const sessionId = parseInt(idStr);
      
      const formData = await req.formData();
      const type = formData.get("type") as string;
      const dataRaw = formData.get("data") as string;
      const timestampRaw = formData.get("timestamp") as string;
      
      if (!isNaN(sessionId) && type) {
        let data: any = { note: dataRaw };
        if (type === "sg_reading") {
          const sg = parseFloat(dataRaw);
          if (!isNaN(sg)) {
            data = { sg };
          }
        } else if (type === "addition") {
          const invIdStr = formData.get("inventory_item_id") as string;
          const qtyStr = formData.get("quantity_used") as string;
          const unit = formData.get("unit") as string;
          const customName = formData.get("custom_ingredient") as string;
          
          if (invIdStr) {
            data = {
              inventory_item_id: parseInt(invIdStr),
              quantity_used: parseFloat(qtyStr),
              unit: unit
            };
          } else {
            data = {
              ingredient: customName,
              quantity_used: parseFloat(qtyStr),
              unit: unit
            };
          }
        }
        
        let timestampToUse = undefined;
        if (timestampRaw) {
           const dateObj = new Date(timestampRaw);
           if (!isNaN(dateObj.getTime())) {
             timestampToUse = dateObj.toISOString();
           }
        }
        
        DAL.addEvent(sessionId, type, data, timestampToUse);
      }
      
      const content = renderSessionDetail(sessionId);
      return new Response(content, {
        status: 200,
        headers: { "Content-Type": "text/html" }
      });
    }


    if (req.method === "POST" && url.pathname.match(/^\/sessions\/\d+\/events\/\d+\/link$/)) {
      const parts = url.pathname.split("/");
      const sessionId = parseInt(parts[2]);
      const eventId = parseInt(parts[4]);
      
      const formData = await req.formData();
      const invIdStr = formData.get("inventory_item_id") as string;
      const invId = parseInt(invIdStr);
      const qtyStr = formData.get("quantity") as string;
      const unit = formData.get("unit") as string;
      
      if (!isNaN(sessionId) && !isNaN(eventId) && !isNaN(invId)) {
         const event = DAL.getEventById(eventId);
         const invItem = DAL.getInventoryItemById(invId);
         if (event && event.type === 'addition' && invItem) {
            const qty = parseFloat(qtyStr) || 0;
            
            const newData = { ...event.data };
            delete newData.ingredient;
            newData.inventory_item_id = invId;
            newData.quantity_used = qty;
            newData.unit = unit;
            DAL.updateEventData(eventId, newData);
            
            if (qty > 0) {
               const qtyToDeduct = convertUnits(qty, unit, invItem.unit);
               DAL.updateInventoryQuantity(invItem.id, -qtyToDeduct);
            }
         }
      }
      
      const content = renderSessionDetail(sessionId);
      return new Response(content, {
        status: 200,
        headers: { "Content-Type": "text/html" }
      });
    }

    if (req.method === "POST" && url.pathname.match(/^\/sessions\/\d+\/events\/edit$/)) {
      const sessionId = parseInt(url.pathname.split("/")[2]);
      const formData = await req.formData();
      const eventId = parseInt(formData.get("id") as string);
      const type = formData.get("type") as string;
      const timestampRaw = formData.get("timestamp") as string;
      
      let timestampToUse = undefined;
      if (timestampRaw) {
         const dateObj = new Date(timestampRaw);
         if (!isNaN(dateObj.getTime())) {
           timestampToUse = dateObj.toISOString();
         }
      }

      if (!isNaN(sessionId) && !isNaN(eventId) && timestampToUse && type) {
         const event = DAL.getEventById(eventId);
         if (event) {
            const newData = { ...event.data };
            if (type === 'sg_reading') {
               const sg = parseFloat(formData.get("sg") as string);
               if (!isNaN(sg)) newData.sg = sg;
            } else if (type === 'racking' || type === 'bottling') {
               newData.note = formData.get("note") as string;
            } else if (type === 'addition') {
               const note = formData.get("note") as string;
               if (note) {
                  newData.note = note;
               } else {
                  delete newData.note;
               }
               
               if (newData.quantity_used !== undefined) {
                  const qty = parseFloat(formData.get("quantity_used") as string);
                  if (!isNaN(qty)) newData.quantity_used = qty;
                  newData.unit = formData.get("unit") as string;
               }
            }
            DAL.updateEvent(eventId, newData, timestampToUse);
         }
      }
      
      const content = renderSessionDetail(sessionId);
      return new Response(content, {
        status: 200,
        headers: { "Content-Type": "text/html" }
      });
    }
    if (req.method === "DELETE" && url.pathname.match(/^\/sessions\/\d+\/events\/\d+$/)) {
      const parts = url.pathname.split("/");
      const sessionId = parseInt(parts[2]);
      const eventId = parseInt(parts[4]);
      
      if (!isNaN(sessionId) && !isNaN(eventId)) {
        DAL.deleteEvent(eventId);
      }
      
      const content = renderSessionDetail(sessionId);
      return new Response(content, {
        status: 200,
        headers: { "Content-Type": "text/html" }
      });
    }
    
    return new Response("Not Found", { status: 404 });
  }
});

console.log("Server running on http://localhost:3000");
