import com.sun.net.httpserver.*;
import java.io.*;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.sql.*;
import java.util.*;
import java.util.stream.Collectors;

public class BudgetBackend {

    private static final String DB_URL = "jdbc:sqlite:budget.db";
    private static final int PORT = 7070;

    public static void main(String[] args) throws Exception {
        Class.forName("org.sqlite.JDBC");
        createTable();

        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);

        server.createContext("/", new StaticHandler());
        server.createContext("/api/budget", new ApiHandler());
        server.createContext("/api/categories", new ApiHandler());
        server.createContext("/api/goals", new ApiHandler()); // ✅ IMPORTANT

        server.setExecutor(null);
        server.start();

        System.out.println("Server running at http://localhost:" + PORT);
    }

    // ================= DATABASE =================
    private static void createTable() throws Exception {
        try (Connection conn = DriverManager.getConnection(DB_URL);
             Statement stmt = conn.createStatement()) {

            stmt.execute("CREATE TABLE IF NOT EXISTS Categories (" +
                    "category_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                    "name TEXT, type TEXT)");

            stmt.execute("CREATE TABLE IF NOT EXISTS Transactions (" +
                    "transaction_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                    "category_id INTEGER, amount REAL, transaction_date TEXT)");

            stmt.execute("CREATE TABLE IF NOT EXISTS Goals (" +
                    "goal_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                    "category_id INTEGER," +
                    "limit_amount REAL," +
                    "month TEXT)");
        }
    }

    // ================= STATIC =================
    static class StaticHandler implements HttpHandler {
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            if (path.equals("/")) path = "/index.html";

            File file = new File("public" + path);

            if (file.exists()) {
                byte[] content = Files.readAllBytes(file.toPath());
                exchange.sendResponseHeaders(200, content.length);
                exchange.getResponseBody().write(content);
                exchange.close();
            } else {
                exchange.sendResponseHeaders(404, -1);
            }
        }
    }

    // ================= API =================
    static class ApiHandler implements HttpHandler {

        public void handle(HttpExchange exchange) throws IOException {

            // ✅ CORS
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");

            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod();

            try {

                // 🔥 VERY IMPORTANT: EXACT MATCH FIX
                if (path.equals("/api/goals")) {
    if (method.equals("POST")) handleAddGoal(exchange);
    else if (method.equals("GET")) handleGetGoals(exchange);
    else if (method.equals("DELETE")) handleDeleteGoal(exchange);
    else exchange.sendResponseHeaders(405, -1);
    return;
}

                if (path.equals("/api/categories")) {
                    if (method.equals("POST")) handleAddCategory(exchange);
                    else if (method.equals("GET")) handleCategories(exchange);
                    return;
                }

                if (path.startsWith("/api/budget")) {
                    switch (method) {
                        case "GET": handleGet(exchange); break;
                        case "POST": handlePost(exchange); break;
                        case "PUT": handlePut(exchange); break;
                        case "DELETE": handleDelete(exchange); break;
                    }
                    return;
                }

                // ❌ If nothing matched → return 404 properly
                exchange.sendResponseHeaders(404, -1);

            } catch (Exception e) {
                e.printStackTrace();
                exchange.sendResponseHeaders(500, -1);
            }
        }
        private void handleDeleteGoal(HttpExchange exchange) throws Exception {
    String body = read(exchange);
    String category_id = get(body, "category_id");
    String month = get(body, "month");

    try (Connection conn = DriverManager.getConnection(DB_URL);
         PreparedStatement ps = conn.prepareStatement(
             "DELETE FROM Goals WHERE category_id=? AND month=?")) {

        ps.setInt(1, Integer.parseInt(category_id));
        ps.setString(2, month);
        ps.executeUpdate();
    }

    send(exchange, "Goal Deleted");
}

        // ================= GOALS =================
        private void handleAddGoal(HttpExchange exchange) throws Exception {
    String body = read(exchange);

    String category_id = get(body, "category_id");
    String limit = get(body, "limit");
    String month = get(body, "month");

    try (Connection conn = DriverManager.getConnection(DB_URL)) {

        // 🔍 Check if goal already exists
        PreparedStatement check = conn.prepareStatement(
            "SELECT * FROM Goals WHERE category_id=? AND month=?");
        check.setInt(1, Integer.parseInt(category_id));
        check.setString(2, month);

        ResultSet rs = check.executeQuery();

        if (rs.next()) {
            // 🔄 UPDATE
            PreparedStatement update = conn.prepareStatement(
                "UPDATE Goals SET limit_amount=? WHERE category_id=? AND month=?");
            update.setDouble(1, Double.parseDouble(limit));
            update.setInt(2, Integer.parseInt(category_id));
            update.setString(3, month);
            update.executeUpdate();

            send(exchange, "Goal Updated");
        } else {
            // ➕ INSERT
            PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO Goals (category_id, limit_amount, month) VALUES (?, ?, ?)");
            insert.setInt(1, Integer.parseInt(category_id));
            insert.setDouble(2, Double.parseDouble(limit));
            insert.setString(3, month);
            insert.executeUpdate();

            send(exchange, "Goal Added");
        }
    }
}

        private void handleGetGoals(HttpExchange exchange) throws Exception {
            List<String> list = new ArrayList<>();

            try (Connection conn = DriverManager.getConnection(DB_URL);
                 Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT * FROM Goals")) {

                while (rs.next()) {
                    list.add(String.format(
                            "{\"category_id\":%d,\"limit\":%.2f,\"month\":\"%s\"}",
                            rs.getInt("category_id"),
                            rs.getDouble("limit_amount"),
                            rs.getString("month")));
                }
            }

            sendJSON(exchange, "[" + String.join(",", list) + "]");
        }

        // ================= CATEGORIES =================
        private void handleAddCategory(HttpExchange exchange) throws Exception {
            String body = read(exchange);
            String name = get(body, "name");
            String type = get(body, "type");

            try (Connection conn = DriverManager.getConnection(DB_URL);
                 PreparedStatement ps = conn.prepareStatement(
                         "INSERT INTO Categories (name, type) VALUES (?, ?)")) {

                ps.setString(1, name);
                ps.setString(2, type);
                ps.executeUpdate();
            }

            send(exchange, "Category Added");
        }

        private void handleCategories(HttpExchange exchange) throws Exception {
            List<String> list = new ArrayList<>();

            try (Connection conn = DriverManager.getConnection(DB_URL);
                 Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT * FROM Categories")) {

                while (rs.next()) {
                    list.add(String.format(
                            "{\"category_id\":%d,\"name\":\"%s\",\"type\":\"%s\"}",
                            rs.getInt("category_id"),
                            rs.getString("name"),
                            rs.getString("type")));
                }
            }

            sendJSON(exchange, "[" + String.join(",", list) + "]");
        }

        // ================= TRANSACTIONS =================
        private void handleGet(HttpExchange exchange) throws Exception {
            List<String> list = new ArrayList<>();

            try (Connection conn = DriverManager.getConnection(DB_URL);
                 Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT * FROM Transactions")) {

                while (rs.next()) {
                    list.add(String.format(
                            "{\"s_no\":%d,\"category_id\":%d,\"amount\":%.2f,\"date\":\"%s\"}",
                            rs.getInt("transaction_id"),
                            rs.getInt("category_id"),
                            rs.getDouble("amount"),
                            rs.getString("transaction_date")));
                }
            }

            sendJSON(exchange, "[" + String.join(",", list) + "]");
        }

        private void handlePost(HttpExchange exchange) throws Exception {
            String body = read(exchange);
            String category_id = get(body, "category_id");
            String amount = get(body, "amount");
            String date = get(body, "date");

            try (Connection conn = DriverManager.getConnection(DB_URL);
                 PreparedStatement ps = conn.prepareStatement(
                         "INSERT INTO Transactions (category_id, amount, transaction_date) VALUES (?, ?, ?)")) {

                ps.setInt(1, Integer.parseInt(category_id));
                ps.setDouble(2, Double.parseDouble(amount));
                ps.setString(3, date);
                ps.executeUpdate();
            }

            send(exchange, "Added");
        }

        private void handlePut(HttpExchange exchange) throws Exception {
            String body = read(exchange);
            String id = get(body, "s_no");
            String category_id = get(body, "category_id");
            String amount = get(body, "amount");
            String date = get(body, "date");

            try (Connection conn = DriverManager.getConnection(DB_URL);
                 PreparedStatement ps = conn.prepareStatement(
                         "UPDATE Transactions SET category_id=?, amount=?, transaction_date=? WHERE transaction_id=?")) {

                ps.setInt(1, Integer.parseInt(category_id));
                ps.setDouble(2, Double.parseDouble(amount));
                ps.setString(3, date);
                ps.setInt(4, Integer.parseInt(id));
                ps.executeUpdate();
            }

            send(exchange, "Updated");
        }

        private void handleDelete(HttpExchange exchange) throws Exception {
            String path = exchange.getRequestURI().getPath();
            String id = path.substring(path.lastIndexOf("/") + 1);

            try (Connection conn = DriverManager.getConnection(DB_URL);
                 PreparedStatement ps = conn.prepareStatement(
                         "DELETE FROM Transactions WHERE transaction_id=?")) {

                ps.setInt(1, Integer.parseInt(id));
                ps.executeUpdate();
            }

            send(exchange, "Deleted");
        }

        // ================= HELPERS =================
        private String read(HttpExchange ex) throws IOException {
            return new BufferedReader(new InputStreamReader(ex.getRequestBody()))
                    .lines().collect(Collectors.joining());
        }

        private void send(HttpExchange ex, String msg) throws IOException {
            byte[] bytes = msg.getBytes();
            ex.sendResponseHeaders(200, bytes.length);
            ex.getResponseBody().write(bytes);
            ex.close();
        }

        private void sendJSON(HttpExchange ex, String json) throws IOException {
            byte[] bytes = json.getBytes();
            ex.getResponseHeaders().set("Content-Type", "application/json");
            ex.sendResponseHeaders(200, bytes.length);
            ex.getResponseBody().write(bytes);
            ex.close();
        }

        private String get(String json, String key) {
            java.util.regex.Matcher m = java.util.regex.Pattern
                    .compile("\"" + key + "\"\\s*:\\s*\"?([^\",}]*)\"?")
                    .matcher(json);
            return m.find() ? m.group(1) : "";
        }
    }
}