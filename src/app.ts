import express, { type Express } from "express";
import cors from "cors";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import loginRouter from "./routes/login.js";
import sessionRouter from "./routes/session.js";
import adminRouter from "./routes/admin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", express.static(resolve(__dirname, "../public")));

app.get("/api", (_req, res) => {
  res.redirect("/api/admin");
});

app.get("/api/admin", (_req, res) => {
  res.sendFile(resolve(__dirname, "../public/admin.html"));
});

app.use("/api", loginRouter);
app.use("/api", sessionRouter);
app.use("/api", adminRouter);

export default app;
