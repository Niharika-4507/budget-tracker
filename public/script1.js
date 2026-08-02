const API = "http://localhost:7070/api/budget";
const CATEGORY_API = "http://localhost:7070/api/categories";
const GOAL_API = "http://localhost:7070/api/goals";

let categories = [];
let chart = null;
let ratioChart = null;
let categoryChart = null;

/* ================= CATEGORY HELPERS ================= */
async function fetchCategories() {
    const res = await fetch(CATEGORY_API);
    categories = await res.json();
}

function getCategoryName(id) {
    const cat = categories.find(c => c.category_id == id);
    return cat ? cat.name : "Unknown";
}

function getCategoryIdByName(name) {
    const cat = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
    return cat ? cat.category_id : null;
}

async function resolveOrCreateCategory(name) {
    let id = getCategoryIdByName(name);
    if (id) return id;

    await fetch(CATEGORY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type: "expense" })
    });

    await fetchCategories();
    return getCategoryIdByName(name);
}

/* ================= ADD CATEGORY ================= */
async function addCategory() {
    const name = document.getElementById("newCategory").value.trim();
    const type = document.getElementById("categoryType").value;

    if (!name) { alert("Enter category name"); return; }

    await fetch(CATEGORY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type })
    });

    alert("Category Added!");
    document.getElementById("newCategory").value = "";

    await fetchCategories();
    renderCategoryTable();
    updateCategorySuggestions();
}

function renderCategoryTable() {
    const tbody = document.getElementById("category-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";
    categories.forEach((cat, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${i + 1}</td><td>${cat.name}</td><td>${cat.type}</td>`;
        tbody.appendChild(tr);
    });
}

function updateCategorySuggestions() {
    const datalists = [
        "category-suggestions",
        "update-category-suggestions",
        "goal-category-suggestions"
    ];
    datalists.forEach(id => {
        const dl = document.getElementById(id);
        if (!dl) return;
        dl.innerHTML = "";
        categories.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat.name;
            dl.appendChild(option);
        });
    });
}

/* ================= ADD TRANSACTION ================= */
document.getElementById("student-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("category").value.trim();
    const amount = document.getElementById("amount").value;
    const date = document.getElementById("date").value;

    if (!name || !amount || !date) { alert("Fill all fields"); return; }

    try {
        const category_id = await resolveOrCreateCategory(name);

        await fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category_id: Number(category_id), amount: Number(amount), date })
        });

        alert("Transaction Added!");
        document.getElementById("student-form").reset();
        await loadData();
        await loadGoals();

    } catch (err) {
        console.error(err);
        alert("Error adding transaction");
    }
});

/* ================= UPDATE TRANSACTION ================= */
async function fetchDataForUpdate() {
    const id = document.getElementById("fetchId").value.trim();
    if (!id) { alert("Enter an ID"); return; }

    try {
        const res = await fetch(API);
        const data = await res.json();
        const item = data.find(d => d.s_no == id);

        if (!item) { alert("Transaction not found"); return; }

        document.getElementById("updateSno").value = item.s_no;
        document.getElementById("updateCategory").value = getCategoryName(item.category_id);
        document.getElementById("updateAmount").value = item.amount;
        document.getElementById("updateDate").value = item.date;

    } catch (err) {
        console.error(err);
        alert("Error fetching transaction");
    }
}

document.getElementById("update-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("updateSno").value;
    const name = document.getElementById("updateCategory").value.trim();
    const amount = document.getElementById("updateAmount").value;
    const date = document.getElementById("updateDate").value;

    if (!id || !name || !amount || !date) {
        alert("Please fetch a transaction first and fill all fields");
        return;
    }

    try {
        const category_id = await resolveOrCreateCategory(name);

        await fetch(API, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ s_no: id, category_id: Number(category_id), amount: Number(amount), date })
        });

        alert("Transaction Updated!");
        document.getElementById("update-form").reset();
        document.getElementById("fetchId").value = "";
        await loadData();
        await loadGoals();

    } catch (err) {
        console.error(err);
        alert("Error updating transaction");
    }
});

/* ================= GOALS ================= */
document.getElementById("goal-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("goal-category").value.trim();
    const limit = document.getElementById("goal-limit").value;
    const month = document.getElementById("goal-month").value;

    if (!name || !limit || !month) { alert("Fill all fields"); return; }

    try {
        const category_id = await resolveOrCreateCategory(name);

        const res = await fetch(GOAL_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category_id, limit, month })
        });

        alert(await res.text());
        document.getElementById("goal-form").reset();
        await loadGoals();

    } catch (err) {
        console.error(err);
        alert("Error adding goal");
    }
});

/* ✏️ Edit goal — pre-fills the Set Goal form above */
function editGoal(category_id, limit, month) {
    document.getElementById("goal-category").value = getCategoryName(category_id);
    document.getElementById("goal-limit").value = limit;
    document.getElementById("goal-month").value = month;

    // Scroll up to the form so user can change the limit and resubmit
    document.getElementById("goal-form").scrollIntoView({ behavior: "smooth" });
    document.getElementById("goal-limit").focus();
}

/* 🗑️ Delete goal */
async function deleteGoal(category_id, month) {
    if (!confirm(`Delete goal for "${getCategoryName(category_id)}" (${month})?`)) return;

    try {
        await fetch(GOAL_API, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category_id, month })
        });
        await loadGoals();
    } catch (err) {
        console.error(err);
        alert("Error deleting goal");
    }
}

async function loadGoals() {
    try {
        const goals = await (await fetch(GOAL_API)).json();
        const transactions = await (await fetch(API)).json();
        const container = document.getElementById("active-goals-list");

        if (!container) return;
        container.innerHTML = "";

        if (goals.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); padding: 1rem;">No goals set yet.</p>`;
            return;
        }

        goals.forEach(goal => {
            let spent = 0;
            transactions.forEach(tx => {
                if (tx.category_id == goal.category_id && tx.date.startsWith(goal.month)) {
                    spent += parseFloat(tx.amount);
                }
            });

            const limitAmount = parseFloat(goal.limit) || 0;
            const isExceeded = spent > limitAmount;
            const percent = limitAmount > 0 ? Math.min((spent / limitAmount) * 100, 100).toFixed(0) : 0;

            const div = document.createElement("div");
            div.className = "goal-item";
            div.innerHTML = `
                <div style="flex:1">
                    <strong>${getCategoryName(goal.category_id)} (${goal.month})</strong><br>
                    <small style="color: var(--text-muted)">
                        Spent: ₹${spent.toFixed(2)} / Limit: ₹${limitAmount.toFixed(2)} (${percent}%)
                    </small>
                    <div style="background:#e2e8f0; border-radius:999px; height:6px; margin-top:6px;">
                        <div style="width:${percent}%; background:${isExceeded ? '#dc2626' : '#16a34a'}; height:6px; border-radius:999px;"></div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:0.6rem; margin-left:1rem; flex-shrink:0;">
                    <span style="color:${isExceeded ? '#dc2626' : '#16a34a'}; font-weight:600; white-space:nowrap;">
                        ${isExceeded ? "❌ Over Limit" : "✅ Within Limit"}
                    </span>
                    <button
                        onclick="editGoal(${goal.category_id}, ${limitAmount}, '${goal.month}')"
                        style="padding:5px 12px; border-radius:6px; border:none; background:#e0e7ff; color:#4f46e5; font-weight:600; cursor:pointer; white-space:nowrap;">
                        ✏️ Edit
                    </button>
                    <button
                        onclick="deleteGoal(${goal.category_id}, '${goal.month}')"
                        style="padding:5px 12px; border-radius:6px; border:none; background:#fee2e2; color:#dc2626; font-weight:600; cursor:pointer; white-space:nowrap;">
                        🗑️ Delete
                    </button>
                </div>
            `;
            container.appendChild(div);
        });

    } catch (err) {
        console.error("Goal Error:", err);
    }
}

/* ================= DATA LOADING & TABLE ================= */
async function loadData() {
    const res = await fetch(API);
    const data = await res.json();
    updateDashboard(data);
    loadCharts(data);
    renderTable(data);
}

function renderTable(data) {
    const tableBody = document.getElementById("student-table-body");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No transactions yet.</td></tr>`;
        return;
    }

    data.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${item.s_no}</td>
            <td>${getCategoryName(item.category_id)}</td>
            <td>₹${parseFloat(item.amount).toFixed(2)}</td>
            <td>${item.date}</td>
            <td>
                <button class="delete-btn" onclick="deleteTransaction(${item.s_no})">Delete</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

async function deleteTransaction(id) {
    if (!confirm("Delete this transaction?")) return;
    await fetch(`${API}/${id}`, { method: "DELETE" });
    await loadData();
    await loadGoals();
}

/* ================= DASHBOARD ================= */
function updateDashboard(data) {
    let totalIncome = 0;
    let totalExpense = 0;

    data.forEach(item => {
        const cat = categories.find(c => c.category_id == item.category_id);
        const amount = parseFloat(item.amount) || 0;
        if (cat && cat.type === "income") totalIncome += amount;
        else totalExpense += amount;
    });

    const balance = totalIncome - totalExpense;
    document.getElementById("total-count").textContent = data.length;
    document.getElementById("total-income").textContent = totalIncome.toFixed(2);
    document.getElementById("total-expense").textContent = totalExpense.toFixed(2);
    document.getElementById("balance").textContent = balance.toFixed(2);
}

/* ================= CHARTS ================= */
function loadCharts(data) {
    const dailyIncome = {};
    const dailyExpense = {};
    const map = {};
    let incomeTotal = 0, expenseTotal = 0;

    const dates = [...new Set(data.map(d => d.date))].sort();
    dates.forEach(d => { dailyIncome[d] = 0; dailyExpense[d] = 0; });

    data.forEach(d => {
        const cat = categories.find(c => c.category_id == d.category_id);
        const amt = parseFloat(d.amount) || 0;

        if (cat && cat.type === "income") {
            incomeTotal += amt;
            dailyIncome[d.date] += amt;
        } else {
            expenseTotal += amt;
            dailyExpense[d.date] += amt;
            const name = cat ? cat.name : "Other";
            map[name] = (map[name] || 0) + amt;
        }
    });

    if (chart) chart.destroy();
    chart = new Chart(document.getElementById("dailyChart"), {
        type: "line",
        data: {
            labels: dates,
            datasets: [
                { label: "Income", data: dates.map(d => dailyIncome[d]), borderColor: "#16a34a", backgroundColor: "rgba(22,163,74,0.1)", fill: true, tension: 0.3 },
                { label: "Spending", data: dates.map(d => dailyExpense[d]), borderColor: "#dc2626", backgroundColor: "rgba(220,38,38,0.1)", fill: true, tension: 0.3 }
            ]
        }
    });

    if (ratioChart) ratioChart.destroy();
    ratioChart = new Chart(document.getElementById("ratioChart"), {
        type: "pie",
        data: { labels: ["Income", "Expense"], datasets: [{ data: [incomeTotal, expenseTotal], backgroundColor: ["#16a34a", "#dc2626"] }] }
    });

    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(document.getElementById("categoryChart"), {
        type: "doughnut",
        data: { labels: Object.keys(map), datasets: [{ data: Object.values(map) }] }
    });
}

/* ================= NAVIGATION ================= */
document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
        document.getElementById(btn.dataset.target).classList.add("active");

        const titles = {
            dashboard: "Dashboard", add: "Add Transaction", update: "Update Transaction",
            categories: "Categories", "budget-goals": "Budget Goals", history: "Transaction History"
        };
        const titleEl = document.getElementById("page-title");
        if (titleEl) titleEl.textContent = titles[btn.dataset.target] || "";
    });
});

/* ================= INIT ================= */
async function init() {
    await fetchCategories();
    renderCategoryTable();
    updateCategorySuggestions();
    await loadData();
    await loadGoals();
}

init();