// In file config.js
// const server = "PLACEHOLDER";

let token;

let currentPage;
let loadingCounter = 1;
let init = {};
let lateInit = {};

let classes = [];
let classLookup = {};

async function request(endpoint, body) {
  let url = server+endpoint;
  let options = {};
  
  if (body) {
    options.method = "POST";
    options.body = JSON.stringify(body);
    console.log(`POST ${endpoint}`, body);
  } else {
    console.log(`GET ${endpoint}`);
  }
  
  if (token) {
    options.headers = { Authorization: token };
  }
  
  let response;
  
  try {
    response = await fetch(url, options);
  } catch (e) {
    return { status: 0, data: e };
  }
  
  if (!response.ok) {
    return { status: response.status };
  }
  
  return { status: response.status, data: await response.json() };
}

function make(name, ...childrenOrAttributes) {
  let element = document.createElement(name);
  
  let attributes = childrenOrAttributes[0];
  
  if (attributes && Object.getPrototypeOf(attributes) === Object.prototype) {
    for (let key in attributes) {
      if (key == "classes") {
        for (let item of attributes.classes) {
          element.classList.add(item);
        }
      } else {
        element[key] = attributes[key];
      }
    }
    
    element.append(...childrenOrAttributes.slice(1));
  } else {
    element.append(...childrenOrAttributes);
  }
  
  return element;
}

function makeIconButton(title, icon, callback) {
  return make("button", { classes: [ "icon" ], title: title, onclick: callback }, make("img", { src: icon, height: "24", width: "24", alt: title }));
}

async function loadClasses() {
  let response = await request("/getClasses");
  
  if (response.status === 200) {
    classes = response.data.classes;
    updateClassesDatalist();
  } else {
    alert("Błąd podczas pobierania klas");
  }
  
  classLookup = {};
  for (let _class of classes) {
    classLookup[_class.name] = _class.id;
  }
}

function updateClassesDatalist() {
  idAddBooksClasses.replaceChildren();
  
  for (let _class of classes) {
    idAddBooksClasses.append(make("option", { value: _class.name }));
  }
}

async function loadBookTitles() {
  let response = await request("/getBookTitles");
  
  if (response.status === 200) {
    idBooksTitles.replaceChildren();
    
    for (let title of response.data.titles) {
      idBooksTitles.append(make("option", { value: title }));
    }
  } else {
    alert("Błąd podczas pobierania tytułów książek");
  }
}

function setPage(page, ...initArgs) {
  if (currentPage) {
    document.getElementById(`idPage_${currentPage}`).classList.remove("show");
  }
  
  currentPage = page;
  
  if (init[page]) {
    init[page](...initArgs);
  }
  
  document.getElementById(`idPage_${page}`).classList.add("show");
  
  if (lateInit[page]) {
    lateInit[page](...initArgs);
  }
}

function loading(state) {
  if (state) {
    loadingCounter++;
  } else if (loadingCounter > 0) {
    loadingCounter--;
  }
  
  if (loadingCounter === 0) {
    idLoading.classList.add("hide");
  } else {
    idLoading.classList.remove("hide");
  }
}

function parsePrice(price) {
  let priceParts = price.replace(/[^0-9.,]/g, "").replaceAll(",", ".").split(".");
  
  let sum = 0;
  let part1 = parseInt(priceParts[0]);
  let part2 = priceParts.length >= 2 ? parseInt(priceParts[1].padEnd(2, "0").substring(0, 2)) : NaN;
  
  if (!Number.isNaN(part1)) {
    sum += part1 * 100;
  }
  
  if (!Number.isNaN(part2)) {
    sum += part2
  }
  
  return sum;
}

function toPrice(price) {
  return `${Math.floor(price / 100)},${(price % 100).toString().padStart(2, "0")}`;
}

for (let button of document.querySelectorAll(".goHome")) {
  button.addEventListener("click", () => {
    setPage("main");
  });
}

for (let button of document.querySelectorAll(".goSettings")) {
  button.addEventListener("click", () => {
    setPage("settings");
  });
}

for (let button of document.querySelectorAll(".goPrint")) {
  button.addEventListener("click", () => {
    print();
  });
}

// ---------- logIn
init.logIn = () => {
  idLogInPassword.value = "";
};

idLogInButton.addEventListener("click", async () => {
  loading(true);
  let response = await request("/getToken", { password: idLogInPassword.value });
  
  if (response.status === 400) {
    idLogInPassword.value = "";
    loading(false);
    alert("Złe hasło");
  } else if (response.status === 200) {
    token = response.data.token;
    localStorage.token = response.data.token;
    setPage("main");
    loading(false);
  } else {
    loading(false);
    alert(response.data ? response.data : "Nieznany błąd");
  }
});

// ---------- main
idMainAddBooks.addEventListener("click", () => {
  setPage("addBooks");
});

idMainBooks.addEventListener("click", () => {
  setPage("books");
});

idMainSettings.addEventListener("click", () => {
  setPage("settings");
});

// ---------- addBooks
init.addBooks = async () => {
  idAddBooksTitle.value = "";
  idAddBooksSurname.value = "";
  idAddBooksName.value = "";
  idAddBooksClass.value = "";
  idAddBooksPrice.value = "";
  
  loading(true);
  
  if (classes.length === 0) {
    await loadClasses();
  }
  
  await loadBookTitles();
  
  loading(false);
};

idAddBooksAdd.addEventListener("click", async () => {
  loading(true);
  
  let price = parsePrice(idAddBooksPrice.value);
  
  let response = await request("/addBook", {
    title: idAddBooksTitle.value,
    name: idAddBooksName.value,
    surname: idAddBooksSurname.value,
    class: idAddBooksClass.value.toUpperCase().trim(),
    price: price
  });
  
  if (response.status === 200) {
    setPage("bookAdded", response.data.id.toString().padStart(3, "0"));
  } else {
    alert("Błąd podczas dodawania książki");
  }
  
  loading(false);
});

// ---------- bookAdded
init.bookAdded = (bookId) => {
  idBookAddedId.innerText = bookId;
  idBookAddedAddMore.focus();
};

lateInit.bookAdded = () => {
  idBookAddedAddMore.focus();
};

idBookAddedAddMore.addEventListener("click", () => {
  setPage("addBooks");
});

// ---------- books
init.books = async (dontClear) => {
  loading(true);
  
  idBooksList.replaceChildren();
  
  if (!dontClear) {
    idBooksSearchId.value = "";
    idBooksSearchTitle.value = "";
    idBooksSearchSold.value = "---";
  }
  
  await loadBookTitles();
  
  let response = await request("/getBooks");
  
  if (response.status === 200) {
    for (let book of response.data.books) {
      if (idBooksSearchId.value) {
        if (book.id !== parseInt(idBooksSearchId.value)) {
          continue;
        }
      }
      
      if (idBooksSearchTitle.value) {
        if (book.title !== idBooksSearchTitle.value) {
          continue;
        }
      }
      
      if (idBooksSearchSold.value !== "---") {
        if (!!book.sold !== (idBooksSearchSold.value === "Tak")) {
          continue;
        }
      }
      
      idBooksList.append(make("tr",
        make("td", book.id.toString().padStart(3, "0")),
        make("td", book.title),
        make("td", make("a", { href: "javascript:void(0);" }, `${book.surname}, ${book.name} (${book.className})`)),
        make("td", `${toPrice(book.price)} zł`),
        make("td", book.sold ? "Tak" : "Nie"),
        make("td", { classes: [ "noPrint" ] },
          makeIconButton("Zmień tytuł", "assets/24/edit.svg", async () => {
            
          }),
          makeIconButton("Zmień cenę", "assets/24/price-change.svg", async () => {
            
          }),
          makeIconButton("Usuń", "assets/24/delete.svg", async () => {
            
          }),
        )
      ));
    }
  } else {
    alert("Błąd podczas pobierania książek");
  }
  
  idBooksGenerated.innerText = `Wygenerowano ${new Date()}`;
  
  loading(false);
};

idBooksSearchButton.addEventListener("click", () => {
  init.books(true);
});

// ---------- settings
idSettingsPassword.addEventListener("click", () => {
  setPage("password");
});

idSettingsFee.addEventListener("click", () => {
  setPage("fee");
});

idSettingsClasses.addEventListener("click", () => {
  setPage("classes");
});

// ---------- password
init.password = () => {
  idPasswordOld.value = "";
  idPasswordNew.value = "";
  idPasswordConfirm.value = "";
};

idPasswordSave.addEventListener("click", async () => {
  if (idPasswordNew.value !== idPasswordConfirm.value) {
    alert("Hasła nie pasują");
    return;
  }
  
  loading(true);
  
  let response = await request("/changePassword", {
    oldPassword: idPasswordOld.value,
    newPassword: idPasswordNew.value
  });
  
  if (response.status === 200) {
    token = response.data.token;
    localStorage.token = response.data.token;
    setPage("settings");
    loading(false);
  } else if (response.status === 403) {
    idPasswordOld.value = "";
    loading(false);
    alert("Złe stare hasło");
  } else {
    loading(false);
    alert("Błąd podczas zmiany hasła");
  }
});

// ---------- fee
init.fee = async () => {
  loading(true);
  let response = await request("/getFee");
  loading(false);
  
  if (response.status === 200) {
    idFeeInput.value = toPrice(response.data.fee);
  } else {
    alert("Błąd podczas pobierania opłaty")
  }
};

idFeeSave.addEventListener("click", async () => {
  loading(true);
  
  let fee = parsePrice(idFeeInput.value);
  
  let response = await request("/changeFee", {
    fee: fee
  });
  
  if (response.status === 200) {
    idFeeInput.value = toPrice(response.data.fee);
    loading(false);
  } else {
    loading(false);
    alert("Błąd podczas zmiany opłaty")
  }
});

// ---------- classes
init.classes = async (dontReload, dontFocus) => {
  idClassesNames.value = "";
  
  idClassesList.replaceChildren();
  
  if (!dontReload) {
    loading(true);
    await loadClasses();
    loading(false);
  }
  
  for (let _class of classes) {
    idClassesList.append(make("tr",
      make("td", _class.name),
      make("td",
        makeIconButton("Zmień nazwę", "assets/24/edit.svg", async () => {
          let answer = prompt(`Nowa nazwa klasy ${_class.name}?`, _class.name);
          
          if (answer !== null) {
            loading(true);
            
            let response = await request("/renameClass", { id: _class.id, name: answer });
            
            if (response.status === 200) {
              classes = response.data.classes;
              updateClassesDatalist();
              await init.classes(true, true);
              loading(false);
            } else {
              loading(false);
              alert("Błąd podczas zmiany nazwy klasy");
            }
          }
        }),
        makeIconButton("Usuń", "assets/24/delete.svg", async () => {
          if (confirm(`Na pewno usunąć klasę ${_class.name}? **Wszystkie książki powiązane z nią zostaną również usunięte!**`)) {
            loading(true);
            
            let response = await request("/deleteClass", { id: _class.id });
            
            if (response.status === 200) {
              classes = response.data.classes;
              updateClassesDatalist();
              await init.classes(true, true);
              loading(false);
            } else {
              loading(false);
              alert("Błąd podczas usuwania klasy");
            }
          }
        }),
      )
    ));
  }
  
  if (!dontFocus) {
    idClassesNames.focus();
  }
};

idClassesAdd.addEventListener("click", async () => {
  loading(true);
  
  let names = idClassesNames.value.split("\n").map(x => x.trim()).filter(x => x !== "");
  let response = await request("/addClasses", { names: names });
  
  if (response.status === 200) {
    classes = response.data.classes;
    updateClassesDatalist();
    await init.classes(true, false);
    loading(false);
  } else {
    loading(false);
    alert("Błąd podczas dodawania klasy");
  }
});

async function main() {
  if (localStorage.token) {
    token = localStorage.token;
    
    let response = await request("/verifyToken");
    
    if (response.status === 403) {
      token = undefined;
      setPage("logIn");
      loading(false);
    } else if (response.status === 200 && response.data.verified) {
      setPage("main");
      loading(false);
    } else {
      setPage("logIn");
      loading(false);
      alert(response.data ? response.data : "Nieznany błąd");
    }
  } else {
    setPage("logIn");
    loading(false);
  }
}

main();
