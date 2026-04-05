const API = "http://localhost:7070/api/budget";

let chart = null;
let pieChart = null;

/* ================= NAVIGATION ================= */
document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {

        document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const target = btn.getAttribute("data-target");

        document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
        document.getElementById(target).classList.add("active");

        document.getElementById("page-title").textContent = btn.textContent;

        if (target === "dashboard") {
            loadData();
        }
    });
});

/* ================= AUTO ID ================= */
function generateId(data) {
    if (data.length === 0) return 1;
    const maxId = Math.max(...data.map(item => parseInt(item.s_no)));
    return maxId + 1;
}

/* ================= LOAD DATA ================= */
async function loadData() {

    const res = await fetch(API);
    const data = await res.json();

    console.log("DATA:", data);

    loadTable(data);
    updateDashboard(data);
    loadCategories(data);
    loadChart(data);
    loadPieChart(data);
    loadCategoryChart(data);

    const newId = generateId(data);
    const idInput = document.getElementById("s_no");
    if (idInput) idInput.value = newId;
}

/* ================= ADD ================= */
document.getElementById("student-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const obj = {
        s_no: document.getElementById("s_no").value,
        category: document.getElementById("category").value,
        amount: document.getElementById("amount").value,
        date: document.getElementById("date").value,
        type: (document.getElementById("type").value || "expense").toLowerCase()
    };

    await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obj)
    });

    alert("Transaction Added!");
    loadData();
});

/* ================= TABLE ================= */
function loadTable(data) {

    const tbody = document.getElementById("student-table-body");
    tbody.innerHTML = "";

    data.forEach(item => {

        const type = (item.type || "expense").toLowerCase();

        tbody.innerHTML += `
        <tr>
            <td>${item.s_no}</td>
            <td>${item.category}</td>
            <td>${item.amount}</td>
            <td>${item.date}</td>
            <td>${type}</td>
            <td>
                <button class="delete-btn" onclick="deleteData('${item.s_no}')">Delete</button>
            </td>
        </tr>`;
    });
}

/* ================= DELETE ================= */
async function deleteData(id) {
    await fetch(`${API}/${id}`, { method: "DELETE" });
    loadData();
}

/* ================= UPDATE ================= */
document.getElementById("update-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const obj = {
        s_no: document.getElementById("updateSno").value,
        category: document.getElementById("updateCategory").value,
        amount: document.getElementById("updateAmount").value,
        date: document.getElementById("updateDate").value,
        type: document.getElementById("updateType").value
    };

    await fetch(API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obj)
    });

    alert("Updated Successfully!");
    loadData();
});

/* ================= DASHBOARD ================= */
function updateDashboard(data) {

    let total = 0;
    let income = 0;
    let expense = 0;

    data.forEach(item => {

        const amt = parseFloat(item.amount) || 0;
        const type = (item.type || "expense").toLowerCase();

        total += amt;

        if (type === "income") income += amt;
        else expense += amt;
    });

    document.getElementById("total-count").textContent = total;
    document.getElementById("total-income").textContent = income;
    document.getElementById("total-expense").textContent = expense;
    document.getElementById("balance").textContent = income - expense;
}

/* ================= CATEGORY ================= */
function loadCategories(data) {

    const map = {};

    data.forEach(item => {
        const cat = item.category;
        const amt = parseFloat(item.amount) || 0;

        if (!map[cat]) map[cat] = 0;
        map[cat] += amt;
    });

    const tbody = document.getElementById("category-table-body");
    tbody.innerHTML = "";

    let i = 1;
    for (let key in map) {
        tbody.innerHTML += `
        <tr>
            <td>${i++}</td>
            <td>${key}</td>
            <td>${map[key]}</td>
        </tr>`;
    }
}

/* ================= LINE CHART ================= */
function loadChart(data) {

    const canvas = document.getElementById("dailyChart");
    if (!canvas) return;

    const map = {};

    data.forEach(item => {
        const date = item.date;
        const amt = parseFloat(item.amount) || 0;

        if (!map[date]) map[date] = 0;
        map[date] += amt;
    });

    const labels = Object.keys(map).sort();
    const values = labels.map(d => map[d]);

    if (chart) chart.destroy();

    chart = new Chart(canvas, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Daily Spending",
                data: values,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false   // 🔥 smaller chart
        }
    });
}

/* ================= PIE CHART ================= */
function loadPieChart(data) {

    const canvas = document.getElementById("pieChart");
    if (!canvas) return;

    let income = 0;
    let expense = 0;

    data.forEach(item => {
        const amt = parseFloat(item.amount) || 0;
        const type = (item.type || "expense").toLowerCase();

        if (type === "income") income += amt;
        else expense += amt;
    });

    if (pieChart) pieChart.destroy();

    pieChart = new Chart(canvas, {
        type: "pie",
        data: {
            labels: ["Income", "Expense"],
            datasets: [{
                data: [income, expense],
                backgroundColor: ["#22c55e", "#ef4444"]
            }]
        }
    });
}
let categoryChart = null;

function loadCategoryChart(data) {

    const canvas = document.getElementById("categoryChart");
    if (!canvas) return;

    const map = {};

    data.forEach(item => {

        const type = (item.type || "expense").toLowerCase();

        // ✅ ONLY include EXPENSE
        if (type === "expense") {

            const cat = item.category;
            const amt = parseFloat(item.amount) || 0;

            if (!map[cat]) map[cat] = 0;
            map[cat] += amt;
        }
    });

    const labels = Object.keys(map);
    const values = Object.values(map);

    if (categoryChart) categoryChart.destroy();

    categoryChart = new Chart(canvas, {
        type: "pie",
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    "#ef4444", "#f97316", "#eab308",
                    "#22c55e", "#3b82f6", "#a855f7"
                ]
            }]
        }
    });
}
async function fetchDataForUpdate() {

    const id = document.getElementById("fetchId").value;

    const res = await fetch(API);
    const data = await res.json();

    const item = data.find(d => d.s_no == id);

    if (!item) {
        alert("Data not found");
        return;
    }

    // ✅ SET VALUES (NOT PLACEHOLDER)
    document.getElementById("updateSno").value = item.s_no;
    document.getElementById("updateCategory").value = item.category;
    document.getElementById("updateAmount").value = item.amount;
    document.getElementById("updateDate").value = item.date;
    document.getElementById("updateType").value = item.type;
}
const toggleBtn = document.getElementById("themeToggle");

// Load saved theme
if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
    toggleBtn.textContent = "☀️";
}

toggleBtn.addEventListener("click", () => {

    document.body.classList.toggle("dark");

    if (document.body.classList.contains("dark")) {
        localStorage.setItem("theme", "dark");
        toggleBtn.textContent = "☀️";
    } else {
        localStorage.setItem("theme", "light");
        toggleBtn.textContent = "🌙";
    }
});

/* ================= INIT ================= */
loadData();