document.addEventListener('DOMContentLoaded', () => {

    // === NAVIGATION ===
    const navButtons = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view');
    const pageTitle = document.getElementById('page-title');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');

            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            views.forEach(v => v.classList.remove('active'));
            document.getElementById(target).classList.add('active');

            pageTitle.textContent = btn.textContent;

            fetchData();
        });
    });

    // === ADD EXPENSE ===
    const form = document.getElementById('student-form');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const expense = {
            s_no: document.getElementById('s_no').value,
            category: document.getElementById('category').value,
            amount: document.getElementById('amount').value,
            date: document.getElementById('date').value
        };

        try {
            const response = await fetch('http://localhost:7070/api/budget', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(expense)
            });

            if (response.ok) {
                alert('Expense added ✅');
                form.reset();
                fetchData();
            } else {
                alert('Error ❌');
            }

        } catch (err) {
            alert('Server error ❌');
        }
    });

    let dailyChart;

    // === FETCH DATA ===
    async function fetchData() {
    try {
        const response = await fetch('http://localhost:7070/api/budget');
        const data = await response.json();

        const activeView = document.querySelector('.view.active').id;

        updateDashboard(data);

        if (activeView === 'dashboard') {
            renderDailyChart(data);  // ✅ FIXED
        }

        if (activeView === 'view-students') {
            updateTransactionTable(data);
        } 
        else if (activeView === 'categories') {
            updateCategoryTable(data);
        }

    } catch (err) {
        console.log(err);
    }
}
    // async function fetchData() {
    //     try {
    //         const response = await fetch('http://localhost:7070/api/budget');
    //         const data = await response.json();

    //         updateDashboard(data);
    //         renderDailyChart(data);

    //         const activeView = document.querySelector('.view.active').id;

    //         if (activeView === 'view-students') {
    //             updateTransactionTable(data);
    //         } 
    //         else if (activeView === 'categories') {
    //             updateCategoryTable(data);
    //         }

    //     } catch (err) {
    //         console.log(err);
    //     }
    // }

    // === DAILY LINE CHART ===
    function renderDailyChart(data) {

        let dateMap = {};

        data.forEach(item => {
            if (!item.date) return;

            const date = item.date;
            const amt = parseFloat(item.amount || 0);

            dateMap[date] = (dateMap[date] || 0) + amt;
        });

        const sortedDates = Object.keys(dateMap).sort();

        const labels = sortedDates;
        const values = sortedDates.map(d => dateMap[d]);

        if (dailyChart) dailyChart.destroy();

        const ctx = document.getElementById('dailyChart');

        dailyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: "Daily Spending",
                    data: values,
                    fill: true,
                    tension: 0.3
                }]
            }
        });
    }

    // === TRANSACTION TABLE ===
    function updateTransactionTable(data) {
        const tableBody = document.getElementById('student-table-body');
        tableBody.innerHTML = '';

        data.forEach(item => {
            const row = document.createElement('tr');

            row.innerHTML = `
                <td>${item.s_no}</td>
                <td>${item.category}</td>
                <td>${item.amount}</td>
                <td>${item.date}</td>
                <td>
                    <button onclick="deleteExpense(${item.s_no})" style="color:red;">
                        Delete
                    </button>
                </td>
            `;

            tableBody.appendChild(row);
        });
    }

    // === CATEGORY SUMMARY ===
    function updateCategoryTable(data) {
        const tableBody = document.getElementById('category-table-body');
        tableBody.innerHTML = '';

        const categoryMap = {};

        data.forEach(item => {
            const cat = item.category.toLowerCase();
            const amt = parseFloat(item.amount || 0);

            categoryMap[cat] = (categoryMap[cat] || 0) + amt;
        });

        let i = 1;

        for (let cat in categoryMap) {
            const row = document.createElement('tr');

            row.innerHTML = `
                <td>${i++}</td>
                <td>${cat}</td>
                <td>${categoryMap[cat]}</td>
            `;

            tableBody.appendChild(row);
        }
    }

    // === DELETE ===
    window.deleteExpense = async function (s_no) {

        if (!confirm("Delete this record?")) return;

        try {
            const response = await fetch(`http://localhost:7070/api/budget/${s_no}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert("Deleted ✅");
                fetchData();
            } else {
                alert("Delete failed ❌");
            }

        } catch (err) {
            alert("Server error ❌");
        }
    }

    // === UPDATE FETCH ===
    document.getElementById('search-btn').addEventListener('click', async () => {

        const s_no = document.getElementById('searchReg').value;

        try {
            const response = await fetch(`http://localhost:7070/api/budget/${s_no}`);
            const data = await response.json();

            const item = Array.isArray(data) ? data[0] : data;

            if (!item) {
                alert("Not found ❌");
                return;
            }

            document.getElementById('update-form').style.display = 'block';

            document.getElementById('updateSno').value = item.s_no;
            document.getElementById('updateCategory').value = item.category;
            document.getElementById('updateAmount').value = item.amount;
            document.getElementById('updateDate').value = item.date;

        } catch (err) {
            alert("Error ❌");
        }
    });

    // === UPDATE SUBMIT ===
    document.getElementById('update-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const s_no = document.getElementById('updateSno').value;

        const updatedData = {
            s_no: s_no,
            category: document.getElementById('updateCategory').value,
            amount: document.getElementById('updateAmount').value,
            date: document.getElementById('updateDate').value
        };

        try {
            const response = await fetch(`http://localhost:7070/api/budget/${s_no}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            if (response.ok) {
                alert("Updated ✅");
                fetchData();
                document.getElementById('update-form').style.display = 'none';
            } else {
                alert("Update failed ❌");
            }

        } catch (err) {
            alert("Server error ❌");
        }
    });

    // === DASHBOARD TOTAL ===
    function updateDashboard(data) {
        let total = 0;

        data.forEach(item => {
            total += parseFloat(item.amount || 0);
        });

        document.getElementById('total-count').textContent = total;
    }

    // === INITIAL LOAD ===
    fetchData();
});