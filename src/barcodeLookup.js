import { config } from "./index.js";
import { db } from "./db.js";

function wait(time) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

let queue = [];
let resumeFunc;

export function startLookupTask() {
  setTimeout(lookupTask, 0);
}

async function lookupTask() {
  console.log("lookupTask: Started barcode lookup task");
  
  while (true) {
    if (queue.length === 0) {
      console.log("lookupTask: Pausing");
      await new Promise((resolve) => {
        resumeFunc = resolve;
      });
      
      resumeFunc = null;
      console.log("lookupTask: Resumed");
    }
    
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].runAt <= new Date().getTime()) {
        console.log(`lookupTask: [${queue[i].isbn}] Starting lookup`);
        let apiRes = await fetch(`https://www.googleapis.com/books/v1/volumes?key=${config.googleApiKey}&q=isbn:${queue[i].isbn}`);
        
        if (!apiRes.ok) {
          console.log(`lookupTask: [${queue[i].isbn}] Response not OK, delaying`);
          queue[i].runAt = new Date().getTime() + 10000;
          break;
        }
        
        let apiData = await apiRes.json();
        let title = "";
        let subtitle = "";
        
        if (apiData.totalItems > 0) {
          if (apiData.items[0].volumeInfo.title) {
            title = apiData.items[0].volumeInfo.title;
          } else {
            console.log(`lookupTask: [${queue[i].isbn}] No title, giving up`);
            queue.splice(i, 1);
            break;
          }
          
          if (apiData.items[0].volumeInfo.subtitle) {
            subtitle = apiData.items[0].volumeInfo.subtitle;
          }
        } else {
          console.log(`lookupTask: [${queue[i].isbn}] No results, giving up`);
          queue.splice(i, 1);
          break;
        }
        
        db.prepare("UPDATE barcodes SET title = ?, subtitle = ? WHERE id = ?").run(title, subtitle, queue[i].isbn);
        
        console.log(`lookupTask: [${queue[i].isbn}] Lookup complete (${title}|${subtitle})`);
        queue.splice(i, 1);
        break;
      }
    }
    
    await wait(600);
  }
}

export function enqueueBarcode(isbn) {
  for (let i = 0; i < queue.length; i++) {
    if (queue[i].isbn === isbn) {
      return;
    }
  }
  
  queue.push({
    isbn: isbn,
    runAt: 0
  });
  
  if (resumeFunc) {
    resumeFunc();
  }
}
