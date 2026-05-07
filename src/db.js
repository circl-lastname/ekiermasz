import Database from "better-sqlite3";
import { randomBytes } from "node:crypto";

import { config } from "./index.js";

export let db;
const currentSchemaVersion = 1;

export function initDatabase() {
  db = new Database(config.dbFile);
  
  db.exec(`
    PRAGMA foreign_keys = ON;
    
    CREATE TABLE IF NOT EXISTS state (
      schemaVersion INTEGER NOT NULL,
      password TEXT NOT NULL,
      token TEXT NOT NULL,
      fee INTEGER NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS barcodes (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      confirmed INTEGER NOT NULL CHECK (confirmed in (0, 1))
    );
    
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS sellers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      surname TEXT NOT NULL,
      classId INTEGER NOT NULL,
      FOREIGN KEY (classId) REFERENCES classes(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY,
      isbn INTEGER NOT NULL,
      sellerId INTEGER NOT NULL,
      price INTEGER NOT NULL,
      sold INTEGER NOT NULL CHECK (sold in (0, 1)),
      FOREIGN KEY (sellerId) REFERENCES sellers(id) ON DELETE CASCADE
    );
  `);
  
  let schemaVersion = db.prepare("SELECT schemaVersion FROM state").get()?.schemaVersion;
  
  if (!schemaVersion) {
    db.prepare("INSERT INTO state (schemaVersion, password, token, fee) VALUES (?, ?, ?, ?)").run(currentSchemaVersion, "password", randomBytes(24).toString("base64"), 500);
  } else if (schemaVersion !== currentSchemaVersion) {
    /*
    console.log("Migrating database...");
    
    while (schemaVersion !== currentSchemaVersion) {
      switch (schemaVersion) {
        
      }
    }
    */
  }
  
  console.log("Database initialized");
}
