import * as fs from "node:fs";
import * as http from "node:http";
import * as https from "node:https";
import { randomBytes } from "node:crypto";

import { db, initDatabase } from "./db.js";
import { startLookupTask, enqueueBarcode } from "./barcodeLookup.js";

export let config;

function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

const defaultConfig = {
  port: 6257,
  useHttps: false,
  httpsKeyFile: null,
  httpsCertFile: null,
  allowedOrigin: "PLACEHOLDER",
  dbFile: "db.sqlite",
  googleApiKey: "PLACEHOLDER"
};

console.log("eKiermasz Server");

try {
  config = JSON.parse(fs.readFileSync("config.json", "utf8"));
} catch (e) {
  if (e.code === "ENOENT") {
    config = defaultConfig;
    fs.writeFileSync("config.json", JSON.stringify(defaultConfig, null, 2));
    
    console.log("Initial config created");
  } else {
    throw e;
  }
}

initDatabase();
startLookupTask();

function handleRequest(req, res) {
  console.log(`${req.socket.remoteAddress}: ${req.method} ${req.url}`);
  
  res.setHeader("Server", "eKiermasz");
  res.setHeader("Access-Control-Allow-Origin", config.allowedOrigin);
  
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Methods", "GET, POST");
    res.setHeader("Access-Control-Allow-Headers", "Authorization");
    res.end();
    return;
  }
  
  if (req.method === "POST") {
    let data = "";
    let size = 0;
    
    req.on("data", (chunk) => {
      size += chunk.length;
      
      if (size > 20480) {
        req.destroy();
      }
      
      data += chunk.toString();
    });
    
    req.on("end", () => {
      let json;
      
      try {
        json = JSON.parse(data);
      } catch (e) {
        res.statusCode = 400;
        res.end(e.toString());
        return;
      }
      
      processRequest(req, json, res);
    });
    
    req.on("error", (e) => {
      try {
        res.statusCode = 500;
        res.end(e.toString());
      } catch {}
    });
  } else {
    processRequest(req, undefined, res);
  }
}

function processRequest(req, data, res) {
  switch (req.url) {
    case "/getToken": {
      if (req.method !== "POST") {
        res.statusCode = 400;
        res.end();
        return;
      }
      
      let state = db.prepare("SELECT password, token FROM state").get();
      
      if (data.password && data.password === state.password) {
        res.end(JSON.stringify({
          token: state.token
        }));
      } else {
        res.statusCode = 400;
        res.end();
      }
    } break;
    case "/verifyToken": {
      if (!checkAuth(req)) {
        res.statusCode = 403;
        res.end();
        return;
      }
      
      if (req.method !== "GET") {
        res.statusCode = 400;
        res.end();
        return;
      }
      
      res.end(JSON.stringify({
        verified: true
      }));
    } break;
    case "/changePassword": {
      if (!checkAuth(req) || req.method !== "POST") {
        res.statusCode = 400;
        res.end();
        return;
      }
      
      if (typeof data.oldPassword === "string" && typeof data.newPassword === "string") {
        let state = db.prepare("SELECT password FROM state").get();
        
        if (data.oldPassword !== state.password) {
          res.statusCode = 403;
          res.end();
          return;
        }
        
        let newToken = randomBytes(24).toString("base64");
        
        db.prepare("UPDATE state SET password = ?, token = ?").run(data.newPassword, newToken);
        
        res.end(JSON.stringify({
          token: newToken
        }));
      } else {
        res.statusCode = 400;
        res.end();
        return;
      }
    } break;
    case "/getFee": {
      if (!checkAuth(req) || req.method !== "GET") {
        res.statusCode = 400;
        res.end();
        return;
      }
      
      let state = db.prepare("SELECT fee FROM state").get();
      
      res.end(JSON.stringify({
        fee: state.fee
      }));
    } break;
    case "/changeFee": {
      if (!checkAuth(req) || req.method !== "POST") {
        res.statusCode = 400;
        res.end();
        return;
      }
      
      if (typeof data.fee === "number") {
        let newFee = Math.floor(data.fee);
        
        db.prepare("UPDATE state SET fee = ?").run(newFee);
        
        res.end(JSON.stringify({
          fee: newFee
        }));
      } else {
        res.statusCode = 400;
        res.end();
        return;
      }
    } break;
    case "/getClasses": {
      if (!checkAuth(req) || req.method !== "GET") {
        res.statusCode = 400;
        res.end();
        return;
      }
      
      let classes = db.prepare("SELECT id, name FROM classes").all();
      
      res.end(JSON.stringify({
        classes: classes
      }));
    } break;
    case "/addClasses": {
      if (!checkAuth(req) || req.method !== "POST") {
        res.statusCode = 400;
        res.end();
        return;
      }
      
      if (Array.isArray(data.names)) {
        const query = db.prepare("INSERT INTO classes (name) VALUES (?)");
        const check = db.prepare("SELECT 1 FROM classes WHERE name = ?");
        db.transaction((names) => {
          for (let name of names) {
            if (typeof name !== "string" && name.length < 1) {
              continue;
            }
            
            let upperName = name.toUpperCase();
            if (!check.get(upperName)) {
              query.run(upperName);
            }
          }
        })(data.names);
      } else {
        res.statusCode = 400;
        res.end();
        return;
      }
      
      let classes = db.prepare("SELECT id, name FROM classes").all();
      
      res.end(JSON.stringify({
        classes: classes
      }));
    } break;
    case "/deleteClass": {
      if (!checkAuth(req) || req.method !== "POST") {
        res.statusCode = 400;
        res.end();
        return;
      }
      
      if (typeof data.id === "number" && db.prepare("SELECT 1 FROM classes WHERE id = ?").get(data.id)) {
        db.prepare("DELETE FROM classes WHERE id = ?").run(data.id);
      } else {
        res.statusCode = 400;
        res.end();
        return;
      }
      
      let classes = db.prepare("SELECT id, name FROM classes").all();
      
      res.end(JSON.stringify({
        classes: classes
      }));
    } break;
    case "/renameClass": {
      if (!checkAuth(req) || req.method !== "POST") {
        res.statusCode = 400;
        res.end();
        return;
      }
      
      if (typeof data.id === "number" && db.prepare("SELECT 1 FROM classes WHERE id = ?").get(data.id) &&
          typeof data.name === "string" && data.name.length > 0) {
        db.prepare("UPDATE classes SET name = ? WHERE id = ?").run(data.name.toUpperCase(), data.id);
      } else {
        res.statusCode = 400;
        res.end();
        return;
      }
      
      let classes = db.prepare("SELECT id, name FROM classes").all();
      
      res.end(JSON.stringify({
        classes: classes
      }));
    } break;
    case "/addBook": {
      if (!checkAuth(req) || req.method !== "POST") {
        res.statusCode = 400;
        res.end();
        return;
      }
      
      if (typeof data.isbn === "number" &&
          typeof data.name === "string" && data.name.length > 0 &&
          typeof data.surname === "string" && data.surname.length > 0 &&
          typeof data.class === "string" && db.prepare("SELECT 1 FROM classes WHERE name = ?").get(data.class) &&
          typeof data.price === "number") {
        let name = capitalize(data.name.trim());
        let surname = capitalize(data.surname.trim());
        let sellerId;
        let classId = db.prepare("SELECT id FROM classes WHERE name = ?").get(data.class).id;
        
        if (!db.prepare("SELECT 1 FROM sellers WHERE name = ? AND surname = ? AND classId = ?").get(name, surname, classId)) {
          sellerId = db.prepare("INSERT INTO sellers (name, surname, classId) VALUES (?, ?, ?)").run(name, surname, classId).lastInsertRowid;
        } else {
          sellerId = db.prepare("SELECT id FROM sellers WHERE name = ? AND surname = ? AND classId = ?").get(name, surname, classId).id;
        }
        
        if (!db.prepare("SELECT 1 FROM barcodes WHERE id = ?").get(data.isbn)) {
          db.prepare("INSERT INTO barcodes (id, title, subtitle, confirmed) VALUES (?, ?, ?, ?)").run(data.isbn, "Nieznana książka", "", 0);
          enqueueBarcode(data.isbn);
        }
        
        let bookId = db.prepare("INSERT INTO books (isbn, sellerId, price, sold) VALUES (?, ?, ?, ?)").run(data.isbn, sellerId, data.price, 0).lastInsertRowid;
        
        res.end(JSON.stringify({
          id: bookId
        }));
      } else {
        res.statusCode = 400;
        res.end();
        return;
      }
    } break;
    case "/getBarcodes": {
      if (!checkAuth(req) || req.method !== "GET") {
        res.statusCode = 400;
        res.end();
        return;
      }
      
      let barcodes = db.prepare("SELECT id AS isbn, title, subtitle, confirmed FROM barcodes").all();
      
      res.end(JSON.stringify({
        barcodes: barcodes
      }));
    } break;
    default: {
      res.statusCode = 404;
      res.end();
    }
  }
}

function checkAuth(req) {
  let state = db.prepare("SELECT token FROM state").get();
  
  if (req.headers["authorization"] === state.token) {
    return true;
  } else {
    return false;
  }
}

let server;

if (config.useHttps) {
  const options = {
    key: fs.readFileSync(config.httpsKeyFile, "utf8"),
    cert: fs.readFileSync(config.httpsCertFile, "utf8")
  }
  
  server = https.createServer(options, handleRequest);
  
  server.listen(config.port, () => {
    console.log(`Listening on port ${config.port} (HTTPS)`);
  });
} else {
  server = http.createServer(handleRequest);
  
  server.listen(config.port, () => {
    console.log(`Listening on port ${config.port} (HTTP)`);
  });
}
