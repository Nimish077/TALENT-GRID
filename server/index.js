import express from "express";
import "dotenv/config";
import pool from "./db/db.js";

const connectDB = async () => {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("PostgreSQL connected:", result.rows[0]);
  } catch (error) {
    console.error("PostgreSQL connection failed:", error.message);
    process.exit(1);
  }
};

connectDB();

const app = express();

app.get("/", (req, res) => {
  res.send(`Hello world !`);
});

app.listen(3000, () =>{
  console.log(`App is listening on https://localhost:3000`);
});
