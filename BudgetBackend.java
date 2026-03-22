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

        // Create table
        try (Connection conn = DriverManager.getConnection(DB_URL);
             Statement stmt = conn.createStatement()) {

            stmt.execute("CREATE TABLE IF NOT EXISTS Budget (" +
                    "s_no TEXT PRIMARY KEY," +
                    "category TEXT," +
                    "amount TEXT," +
                    "date TEXT)");
        }

        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);

        server.createContext("/", new StaticHandler());
        server.createContext("/api/budget", new ApiHandler());

        server.setExecutor(null);
        server.start();

        System.out.println("🚀 Server running at http://localhost:" + PORT);
    }

    // ================= STATIC FILES =================
    static class StaticHandler implements HttpHandler {
        public void handle(HttpExchange exchange) throws IOException {

            String path = exchange.getRequestURI().getPath();
            if (path.equals("/")) path = "/index.html";

            File file = new File("public" + path);

            if (file.exists()) {
                byte[] content = Files.readAllBytes(file.toPath());

                exchange.getResponseHeaders().set("Content-Type", getType(path));
                exchange.sendResponseHeaders(200, content.length);

                OutputStream os = exchange.getResponseBody();
                os.write(content);
                os.close();

            } else {
                exchange.sendResponseHeaders(404, -1);
            }
        }

        private String getType(String path) {
            if (path.endsWith(".html")) return "text/html";
            if (path.endsWith(".css")) return "text/css";
            if (path.endsWith(".js")) return "application/javascript";
            return "text/plain";
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

            try {
                switch (exchange.getRequestMethod()) {
                    case "GET":
                        handleGet(exchange);
                        break;
                    case "POST":
                        handlePost(exchange);
                        break;
                    case "PUT":
                        handlePut(exchange);
                        break;
                    case "DELETE":
                        handleDelete(exchange);
                        break;
                    default:
                        exchange.sendResponseHeaders(405, -1);
                }
            } catch (Exception e) {
                e.printStackTrace();
                exchange.sendResponseHeaders(500, -1);
            }
        }

        // ================= GET =================
        private void handleGet(HttpExchange exchange) throws Exception {

            String path = exchange.getRequestURI().getPath();
            System.out.println("PATH: " + path);

            // 👉 GET by s_no
            if (path.split("/").length == 4) {

                String s_no = path.split("/")[3];
                System.out.println("Searching for: " + s_no);

                try (Connection conn = DriverManager.getConnection(DB_URL);
                     PreparedStatement ps = conn.prepareStatement(
                             "SELECT * FROM Budget WHERE s_no=?")) {

                    ps.setString(1, s_no);
                    ResultSet rs = ps.executeQuery();

                    if (rs.next()) {
                        String json = String.format(
                                "{\"s_no\":\"%s\",\"category\":\"%s\",\"amount\":\"%s\",\"date\":\"%s\"}",
                                rs.getString("s_no"),
                                rs.getString("category"),
                                rs.getString("amount"),
                                rs.getString("date"));

                        sendJSON(exchange, json);
                    } else {
                        sendJSON(exchange, "{}");
                    }
                }
                return;
            }

            // 👉 GET ALL
            List<String> list = new ArrayList<>();

            try (Connection conn = DriverManager.getConnection(DB_URL);
                 Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT * FROM Budget")) {

                while (rs.next()) {
                    String json = String.format(
                            "{\"s_no\":\"%s\",\"category\":\"%s\",\"amount\":\"%s\",\"date\":\"%s\"}",
                            rs.getString("s_no"),
                            rs.getString("category"),
                            rs.getString("amount"),
                            rs.getString("date"));
                    list.add(json);
                }
            }

            String response = "[" + String.join(",", list) + "]";
            sendJSON(exchange, response);
        }

        // ================= POST =================
        private void handlePost(HttpExchange exchange) throws Exception {

            String body = read(exchange);

            String s_no = get(body, "s_no");
            String category = get(body, "category");
            String amount = get(body, "amount");
            String date = get(body, "date");

            try (Connection conn = DriverManager.getConnection(DB_URL);
                 PreparedStatement ps = conn.prepareStatement(
                         "INSERT INTO Budget VALUES (?, ?, ?, ?)")) {

                ps.setString(1, s_no);
                ps.setString(2, category);
                ps.setString(3, amount);
                ps.setString(4, date);
                ps.executeUpdate();
            }

            send(exchange, "Added");
        }

        // ================= PUT =================
        private void handlePut(HttpExchange exchange) throws Exception {

            String path = exchange.getRequestURI().getPath();
            String s_no = path.split("/")[3];

            String body = read(exchange);

            String category = get(body, "category");
            String amount = get(body, "amount");
            String date = get(body, "date");

            try (Connection conn = DriverManager.getConnection(DB_URL);
                 PreparedStatement ps = conn.prepareStatement(
                         "UPDATE Budget SET category=?, amount=?, date=? WHERE s_no=?")) {

                ps.setString(1, category);
                ps.setString(2, amount);
                ps.setString(3, date);
                ps.setString(4, s_no);

                int rows = ps.executeUpdate();
                System.out.println("Updated rows: " + rows);
            }

            send(exchange, "Updated");
        }

        // ================= DELETE =================
        private void handleDelete(HttpExchange exchange) throws Exception {

            String path = exchange.getRequestURI().getPath();
            String s_no = path.split("/")[3];

            try (Connection conn = DriverManager.getConnection(DB_URL);
                 PreparedStatement ps = conn.prepareStatement(
                         "DELETE FROM Budget WHERE s_no=?")) {

                ps.setString(1, s_no);
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
            ex.sendResponseHeaders(200, msg.length());
            OutputStream os = ex.getResponseBody();
            os.write(msg.getBytes());
            os.close();
        }

        private void sendJSON(HttpExchange ex, String json) throws IOException {
            ex.getResponseHeaders().set("Content-Type", "application/json");
            ex.sendResponseHeaders(200, json.length());
            OutputStream os = ex.getResponseBody();
            os.write(json.getBytes());
            os.close();
        }

        private String get(String json, String key) {
            String pattern = "\"" + key + "\":\"([^\"]*)\"";
            java.util.regex.Matcher m =
                    java.util.regex.Pattern.compile(pattern).matcher(json);
            return m.find() ? m.group(1) : "";
        }
    }
}