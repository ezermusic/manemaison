/* Mane Maison — management pages: dashboard hub, inventory, orders, bookings, settings.
   Access control here is a client-side demo. Before going live, move login, roles and passcode checks to your server (hashed passcodes, JWT/session). */
const PAGES = [
  ["dashboard", "Dashboard", "dashboard.html"],
  ["inventory", "Inventory", "admin-inventory.html"],
  ["orders", "Orders", "admin-orders.html"],
  ["bookings", "Bookings", "admin-bookings.html"],
  ["customers", "Customers", "admin-customers.html"],
  ["reports", "Reports", "admin-reports.html"],
  ["marketing", "Marketing", "admin-marketing.html"],
  ["activity", "Activity log", "admin-activity.html"],
  ["settings", "Settings", "admin-settings.html"],
];
const CEO_ONLY = ["settings", "activity"];
const ROLE_PERMS = {
  CEO: PAGES.map((p) => p[0]),
  Manager: [
    "dashboard",
    "inventory",
    "orders",
    "bookings",
    "customers",
    "reports",
    "marketing",
  ],
  Staff: ["orders", "bookings", "customers"],
};
const ORDER_STATUS = ["Pending", "Packed", "Delivered", "Cancelled"];
const PAY_STATUS = [
  "Paid",
  "Paid online",
  "Awaiting confirmation",
  "Pay on delivery",
  "Refunded",
];
const BOOK_STATUS = ["Pending", "Confirmed", "Completed", "Cancelled", "No-show"];
const SLOTS = [9, 10, 11, 12, 13, 14, 15, 16, 17].map(
  (h) => (h < 10 ? "0" : "") + h + ":00",
);
const VIEWS = {};

const isLow = (p, S) => p.stock <= (p.threshold || S.lowStock || 5);
const opts = (list, cur) =>
  list.map((x) => `<option${x == cur ? " selected" : ""}>${esc(x)}</option>`).join("");
const pill = (t) => `<span class="st st-${slug(t)}">${esc(t)}</span>`;
const waPhone = (ph) => {
  const d = String(ph || "").replace(/\D/g, "");
  return d.startsWith("0") ? "233" + d.slice(1) : d;
};

function modal(html) {
  let d = $("#dlg");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "dlg";
    document.body.appendChild(d);
  }
  d.innerHTML = html;
  d.onclick = (e) => {
    if (e.target == d) d.close();
  };
  $$("[data-close]", d).forEach((b) => (b.onclick = () => d.close()));
  d.showModal();
  return d;
}

async function getUsers() {
  let U = await db.get("users");
  if (!U.length) {
    U = [
      {
        id: 1,
        name: "CEO",
        email: CFG.MAIL ? CFG.MAIL.cc : "",
        role: "CEO",
        pin: CFG.PIN,
        active: true,
        perms: ROLE_PERMS.CEO,
      },
    ];
    await db.put("users", U);
  }
  return U;
}

/* ---------- Dashboard (hub + overview) ---------- */
VIEWS.dashboard = async (me, m) => {
  const [P, O, B] = await Promise.all(
    ["products", "orders", "bookings"].map((c) => db.get(c)),
  );
  const S = await getSettings();
  const can = me.perms.includes("dashboard");
  const live = B.filter((b) => b.date >= day(0) && b.status != "Cancelled");
  const info = {
    inventory: `${P.length} products · ${P.filter((p) => isLow(p, S)).length} low on stock`,
    orders: `${O.filter((o) => o.status == "Pending").length} pending`,
    bookings: `${live.length} upcoming${B.filter((b) => b.date == shiftDay(day(0), 1) && !b.reminded && !["Cancelled", "No-show", "Completed"].includes(b.status || "Pending")).length ? " · reminders due" : ""}`,
    marketing: `${(await db.get("reviews")).filter((r) => r.status == "pending").length} reviews to moderate`,
    customers: `${buildCustomers(O, B, await db.get("customers")).length} customers`,
    reports: "Sales, best sellers and CSV export",
    activity: "Who changed what, and when",
    settings: "Logo, preferences and user access",
  };
  const tiles = PAGES.filter((p) => p[0] != "dashboard" && me.perms.includes(p[0]));
  m.innerHTML =
    `<div class="live"><i></i>Signed in as ${esc(me.name)} · ${esc(me.role)}</div>` +
    `<div class="tiles">${tiles
      .map(
        ([k, t, f], i) =>
          `<a class="tile" style="--i:${i}" href="${f}"><div><h3>${t}</h3><small>${info[k]}</small></div><span>→</span></a>`,
      )
      .join("")}</div>` +
    (can
      ? `<br><div class="kpis" id="k"></div><div class="rings" id="r"></div><h3>Revenue, last 7 days</h3><br><div class="bars" id="b"></div>`
      : "");
  const N = (await db.get("notifications")).slice(0, 4);
  if (N.length && $(".tiles"))
    $(".tiles").insertAdjacentHTML(
      "afterend",
      `<h3 style="margin-top:18px">Recent alerts</h3>${N.map((n) => `<a class="nrow${n.read ? "" : " un"}" href="${esc(n.link || "#")}"><span class="st st-${n.type}">${NOTE_LABEL[n.type] || "Alert"}</span><span>${esc(n.text)}</span><small>${ago(n.ts)}</small></a>`).join("")}`,
    );
  if (!can) return;
  const good = O.filter((o) => o.status != "Cancelled");
  const K = [
    ["Revenue", good.reduce((a, o) => a + o.total, 0), 1],
    ["Orders", O.length],
    ["Upcoming bookings", live.length],
    ["Low stock items", P.filter((p) => isLow(p, S)).length],
  ];
  $("#k").innerHTML = K.map(
    (k) =>
      `<div class="kpi"><b data-n="${k[1]}" data-m="${k[2] || ""}">0</b><small>${k[0]}</small></div>`,
  ).join("");
  $$("[data-n]").forEach((el) => {
    const n = +el.dataset.n,
      t0 = performance.now(),
      f = (t) => {
        const x = Math.min(1, (t - t0) / 1400),
          v = Math.round(n * (1 - Math.pow(1 - x, 3)));
        el.textContent = el.dataset.m ? money(v) : v;
        if (x < 1) requestAnimationFrame(f);
      };
    requestAnimationFrame(f);
  });
  const R = [
    ["Stock health", P.filter((p) => !isLow(p, S)).length / (P.length || 1)],
    [
      "Orders delivered",
      O.filter((o) => o.status == "Delivered").length / (O.length || 1),
    ],
    ["Studio utilisation", Math.min(1, live.filter((b) => b.date < day(7)).length / 63)],
    [
      "Orders paid",
      O.filter((o) => !o.pay || /^Paid/.test(o.pay.status)).length / (O.length || 1),
    ],
  ];
  $("#r").innerHTML = R.map(
    (r) =>
      `<div class="ring"><svg viewBox="0 0 80 80"><circle class="bg" cx="40" cy="40" r="30"/><circle class="fg" cx="40" cy="40" r="30" data-p="${r[1]}" style="stroke-dasharray:0 189"/></svg><b>${Math.round(r[1] * 100)}%</b><small>${r[0]}</small></div>`,
  ).join("");
  const D = [...Array(7)].map((_, i) => day(i - 6)),
    V = D.map((d) => good.filter((o) => o.date == d).reduce((a, o) => a + o.total, 0)),
    mx = Math.max(...V, 1);
  $("#b").innerHTML = D.map(
    (d, i) =>
      `<div data-h="${(V[i] / mx) * 100}" title="${money(V[i])}"><span>${d.slice(8)}</span></div>`,
  ).join("");
  requestAnimationFrame(() =>
    setTimeout(() => {
      $$(".fg").forEach((c) => (c.style.strokeDasharray = `${c.dataset.p * 188.5} 189`));
      $$("[data-h]").forEach((b) => (b.style.height = b.dataset.h + "%"));
    }, 60),
  );
};

/* ---------- Inventory ---------- */
VIEWS.inventory = async (me, m) => {
  let P = await db.get("products");
  const S = await getSettings();
  let q = "",
    cat = "All";
  m.innerHTML = `<div class="tool"><input id="q" placeholder="Search name or SKU"><select id="cf" aria-label="Category"></select><button id="add">+ Add product</button></div><p class="meta" id="sum"></p><div class="tbl"><table id="tb"></table></div>`;
  const save = () => db.put("products", P);
  const draw = () => {
    const cats = ["All", ...new Set(P.map((p) => p.cat))];
    if (!cats.includes(cat)) cat = "All";
    $("#cf").innerHTML = opts(cats, cat);
    const L = P.filter(
      (p) =>
        (cat == "All" || p.cat == cat) &&
        (p.name + " " + (p.sku || "")).toLowerCase().includes(q.toLowerCase()),
    );
    $("#sum").textContent =
      `${L.length} of ${P.length} products · Stock value ${money(P.reduce((a, p) => a + p.price * p.stock, 0))} · ${P.filter((p) => isLow(p, S)).length} low on stock`;
    $("#tb").innerHTML =
      `<tr><th><th>Product<th>Category<th>Price<th>Stock<th>Status<th></tr>` +
      (L.map(
        (p) =>
          `<tr><td><span class="th"><img src="${esc(imgSrc(p.name, p.img))}" alt="" onerror="imgNext(this)"></span><td><b>${esc(p.name)}</b><br><small>${esc(p.sku || "")}</small><td>${esc(p.cat)}<td>${money(p.price)}<td class="${isLow(p, S) ? "low" : ""}"><button data-s="${p.id}:-1" aria-label="Less">−</button> ${p.stock} <button data-s="${p.id}:1" aria-label="More">+</button><td>${pill(p.active === false ? "Hidden" : "Active")}<td><button class="ghost" data-e="${p.id}">Edit</button> <button class="ghost dng" data-d="${p.id}">Delete</button></tr>`,
      ).join("") || `<tr><td colspan="7">No products match.</tr>`);
  };
  const form = (p) => {
    const d = modal(
      `<form id="pf"><h2>${p ? "Edit" : "Add"} product</h2>` +
        `<label>Name<input name="name" required value="${esc(p ? p.name : "")}"></label>` +
        `<div class="g2"><label>SKU<input name="sku" value="${esc(p ? p.sku || "" : "")}"></label><label>Category<input name="cat" list="cl" required value="${esc(p ? p.cat : "")}"><datalist id="cl">${[...new Set(P.map((x) => x.cat))].map((c) => `<option>${esc(c)}</option>`).join("")}</datalist></label></div>` +
        `<div class="g3"><label>Price (GH₵)<input name="price" type="number" min="0" step="0.01" required value="${p ? p.price : ""}"></label><label>Cost price<input name="cost" type="number" min="0" step="0.01" value="${p && p.cost != null ? p.cost : ""}"></label><label>Stock<input name="stock" type="number" min="0" required value="${p ? p.stock : ""}"></label></div>` +
        `<div class="g2"><label>Low-stock alert at<input name="threshold" type="number" min="0" placeholder="${S.lowStock || 5}" value="${p && p.threshold != null ? p.threshold : ""}"></label><label>Image file (in images/)<input name="img" placeholder="auto from name" value="${esc(p ? p.img || "" : "")}"></label></div>` +
        `<label>More photos (file names in images/, comma separated)<input name="imgs" placeholder="auto: name-2.jpg, name-3.jpg" value="${esc(p ? (p.imgs || []).join(", ") : "")}"></label>` +
        `<label>Description<textarea name="desc" rows="3">${esc(p ? p.desc || "" : "")}</textarea></label>` +
        `<label class="sw"><input type="checkbox" name="active" ${p && p.active === false ? "" : "checked"}> Show in shop</label>` +
        `<div class="mbtn"><button type="button" class="ghost" data-close>Cancel</button><button>Save product</button></div></form>`,
    );
    $("#pf", d).onsubmit = async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(e.target));
      const rec = {
        name: v.name.trim(),
        sku: v.sku.trim(),
        cat: v.cat.trim(),
        price: +v.price,
        cost: v.cost === "" ? null : +v.cost,
        stock: +v.stock,
        threshold: v.threshold === "" ? null : +v.threshold,
        img: v.img.trim(),
        imgs: v.imgs
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        desc: v.desc.trim(),
        active: !!v.active,
      };
      if (p) Object.assign(p, rec);
      else P.push({ id: Math.max(0, ...P.map((x) => x.id)) + 1, sold: 0, ...rec });
      await save();
      d.close();
      draw();
      toast(p ? "Product updated" : "Product added");
    };
  };
  $("#q").oninput = (e) => {
    q = e.target.value;
    draw();
  };
  $("#cf").onchange = (e) => {
    cat = e.target.value;
    draw();
  };
  $("#add").onclick = () => form();
  $("#tb").onclick = async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.s) {
      const [id, n] = b.dataset.s.split(":"),
        p = P.find((x) => x.id == id);
      p.stock = Math.max(0, p.stock + +n);
      await save();
      draw();
    }
    if (b.dataset.e) form(P.find((x) => x.id == b.dataset.e));
    if (b.dataset.d) {
      const p = P.find((x) => x.id == b.dataset.d);
      if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
      P = P.filter((x) => x !== p);
      await save();
      draw();
      toast("Product deleted");
    }
  };
  draw();
};

/* ---------- Orders ---------- */
VIEWS.orders = async (me, m) => {
  let O = await db.get("orders");
  let st = "All",
    q = "";
  const no = (o) => o.ref || "#" + String(o.id).slice(-5);
  m.innerHTML = `<div class="chips" id="oc"></div><div class="tool"><input id="q" placeholder="Search client, phone or order #"></div><p class="meta" id="sum"></p><div class="tbl"><table id="tb"></table></div>`;
  const setStatus = async (o, s) => {
    const was = o.status == "Cancelled",
      now = s == "Cancelled";
    if (was != now && o.items) {
      const P = await db.get("products");
      o.items.forEach((i) => {
        const p = P.find((x) => x.id == i.id);
        if (p) p.stock = Math.max(0, p.stock + (now ? i.q : -i.q));
      });
      await db.put("products", P);
    }
    o.status = s;
    (o.history = o.history || []).push({ ts: new Date().toISOString(), status: s });
    await db.put("orders", O);
  };
  const draw = () => {
    $("#oc").innerHTML = ["All", ...ORDER_STATUS]
      .map(
        (s) =>
          `<button data-c="${s}" class="${s == st ? "on" : ""}">${s} ${s == "All" ? O.length : O.filter((o) => o.status == s).length}</button>`,
      )
      .join("");
    const L = O.filter(
      (o) =>
        (st == "All" || o.status == st) &&
        (no(o) + " " + o.name + " " + (o.phone || ""))
          .toLowerCase()
          .includes(q.toLowerCase()),
    )
      .slice()
      .reverse();
    $("#sum").textContent =
      `${L.length} orders · ${money(L.filter((o) => o.status != "Cancelled").reduce((a, o) => a + o.total, 0))} excluding cancelled`;
    $("#tb").innerHTML =
      `<tr><th>Order<th>Date<th>Client<th>Total<th>Payment<th>Status<th></tr>` +
      (L.map(
        (o) =>
          `<tr><td>${no(o)}<td>${o.date}<td>${esc(o.name)}<br><small>${esc(o.phone || "")}</small><td>${money(o.total)}<td>${pill(o.pay ? o.pay.status : "Paid")}<td><select data-st="${o.id}" aria-label="Order status">${opts(ORDER_STATUS, o.status)}</select><td><button class="ghost" data-v="${o.id}">View</button> <button class="ghost dng" data-d="${o.id}">Delete</button></tr>`,
      ).join("") || `<tr><td colspan="7">No orders match.</tr>`);
  };
  const view = async (o) => {
    const P = await db.get("products"),
      by = {};
    (o.items || []).forEach((i) => {
      const p = P.find((x) => x.id == i.id);
      if (p) (by[p.cat] = by[p.cat] || []).push({ p, q: i.q });
    });
    let n = 0;
    const lines =
      Object.entries(by)
        .map(
          ([c, l]) =>
            `<h4>${esc(c)}</h4>` +
            l
              .map(
                ({ p, q }) =>
                  `<div class="line"><span>${++n}. ${esc(p.name)} × ${q}</span><b>${money(p.price * q)}</b></div>`,
              )
              .join(""),
        )
        .join("") || `<p><small>No item detail stored for this order.</small></p>`;
    const pay = o.pay || { method: "—", status: "Paid", ref: "" };
    const wa = `https://wa.me/${waPhone(o.phone)}?text=${encodeURIComponent(`Hello ${o.name}, an update on your Mane Maison order ${no(o)}: ${o.status}. Track it: ${new URL("track.html", location.href).href}`)}`;
    const d = modal(
      `<h2>Order ${no(o)}</h2><p class="meta">${o.date} · ${esc(pay.method || "—")}</p><div class="two2"><div>${lines}<div class="line"><b>Total</b><b>${money(o.total)}</b></div></div><div><p><b>${esc(o.name)}</b><br>${esc(o.phone || "")}<br>${esc(o.email || "")}<br>${esc(o.address || "")}</p><label>Order status<select id="os">${opts(ORDER_STATUS, o.status)}</select></label><label>Payment status<select id="ps">${opts(PAY_STATUS, pay.status)}</select></label><label>Payment reference<input id="pr" value="${esc(pay.ref || "")}"></label><label>Internal note<textarea id="nt" rows="2">${esc(o.note || "")}</textarea></label></div></div><div class="mbtn"><a class="btn ghost" href="${wa}" target="_blank" rel="noopener">WhatsApp client</a><button type="button" class="ghost" id="inv">Invoice</button><button type="button" class="ghost" id="slip">Packing slip</button><button type="button" class="ghost" data-close>Close</button><button id="sv">Save</button></div>`,
    );
    $("#inv", d).onclick = () => printDoc("Invoice " + no(o), invoiceHTML(o, P));
    $("#slip", d).onclick = () => printDoc("Packing slip " + no(o), slipHTML(o, P));
    $("#sv", d).onclick = async () => {
      o.pay = { ...pay, status: $("#ps", d).value, ref: $("#pr", d).value.trim() };
      o.note = $("#nt", d).value.trim();
      await setStatus(o, $("#os", d).value);
      d.close();
      draw();
      toast("Order updated");
    };
  };
  $("#oc").onclick = (e) => {
    const b = e.target.closest("[data-c]");
    if (b) {
      st = b.dataset.c;
      draw();
    }
  };
  $("#q").oninput = (e) => {
    q = e.target.value;
    draw();
  };
  $("#tb").onclick = async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.v) view(O.find((x) => x.id == b.dataset.v));
    if (b.dataset.d) {
      const o = O.find((x) => x.id == b.dataset.d);
      if (!confirm(`Delete order ${no(o)} from ${o.name}? This cannot be undone.`))
        return;
      O = O.filter((x) => x !== o);
      await db.put("orders", O);
      draw();
      toast("Order deleted");
    }
  };
  $("#tb").onchange = async (e) => {
    const s = e.target.closest("[data-st]");
    if (s) {
      await setStatus(
        O.find((x) => x.id == s.dataset.st),
        s.value,
      );
      draw();
      toast("Status updated");
    }
  };
  draw();
};

/* ---------- Settings (logo, preferences, user access, data) ---------- */
VIEWS.settings = async (me, m) => {
  let U = await getUsers();
  const S = await getSettings();
  m.innerHTML =
    `<h3>Brand logo</h3><div class="logo-tool"><img id="lp" alt="Current logo"><div class="lt"><input id="lf" type="file" accept="image/*" aria-label="Upload logo"><div class="lrow"><input id="lu" placeholder="Logo link, e.g. logo.jpg"><button type="button" id="ls">Use link</button><button type="button" class="ghost" id="lr">Reset to logo.jpg</button></div><small>Uploads are resized automatically (max 800 px) and applied across the site.</small></div></div><br>` +
    `<div id="studio"></div><br><h3>Preferences</h3><form id="pf2" class="tool"><label class="fl">Default low-stock alert (units)<input id="ls2" type="number" min="0" value="${S.lowStock || 5}"></label><button>Save</button></form><br>` +
    `<h3>User access</h3><div class="tool"><button id="au">+ Add user</button></div><div class="tbl"><table id="ut"></table></div><br>` +
    `<h3>Data</h3><div class="tool"><button class="ghost" id="ex">Download backup (JSON)</button><button class="ghost dng" id="rs">Reset sample data</button></div>`;
  logoTools();
  studioPanel($("#studio"));
  $("#pf2").onsubmit = async (e) => {
    e.preventDefault();
    S.lowStock = +$("#ls2").value;
    await db.put("settings", S);
    toast("Preferences saved");
  };
  const lastCeo = (u) =>
    u.role == "CEO" &&
    u.active &&
    U.filter((x) => x.role == "CEO" && x.active).length < 2;
  const draw = () => {
    $("#ut").innerHTML =
      `<tr><th>Name<th>Role<th>Access<th>Status<th></tr>` +
      U.map(
        (u) =>
          `<tr><td><b>${esc(u.name)}</b>${u.id == me.id ? " (you)" : ""}<br><small>${esc(u.email || "")}</small><td>${esc(u.role)}<td>${u.perms.map((k) => `<span class="st">${PAGES.find((p) => p[0] == k)[1]}</span>`).join(" ")}<td>${pill(u.active ? "Active" : "Disabled")}<td><button class="ghost" data-e="${u.id}">Edit</button> <button class="ghost dng" data-d="${u.id}">Delete</button></tr>`,
      ).join("");
  };
  const form = (u) => {
    const r = u || {
      name: "",
      email: "",
      role: "Staff",
      pin: "",
      active: true,
      perms: ROLE_PERMS.Staff,
    };
    const d = modal(
      `<form id="uf"><h2>${u ? "Edit" : "Add"} user</h2>` +
        `<div class="g2"><label>Name<input name="name" required value="${esc(r.name)}"></label><label>Email<input name="email" type="email" value="${esc(r.email || "")}"></label></div>` +
        `<div class="g2"><label>Role<select name="role">${opts(Object.keys(ROLE_PERMS), r.role)}</select></label><label>Passcode (min 4, unique)<input name="pin" required minlength="4" value="${esc(r.pin)}"></label></div>` +
        `<fieldset class="perm"><legend>Page access</legend>${PAGES.map(([k, t]) => `<label class="sw"><input type="checkbox" name="perm" value="${k}" ${r.perms.includes(k) ? "checked" : ""}> ${t}</label>`).join("")}</fieldset>` +
        `<label class="sw"><input type="checkbox" name="active" ${r.active ? "checked" : ""}> Account active</label>` +
        `<div class="mbtn"><button type="button" class="ghost" data-close>Cancel</button><button>Save user</button></div></form>`,
    );
    const role = $("[name=role]", d),
      sync = () => {
        CEO_ONLY.forEach((k) => {
          const c = $(`[name=perm][value=${k}]`, d);
          c.disabled = role.value != "CEO";
          if (c.disabled) c.checked = false;
        });
      };
    role.onchange = () => {
      $$("[name=perm]", d).forEach(
        (c) => (c.checked = ROLE_PERMS[role.value].includes(c.value)),
      );
      sync();
    };
    sync();
    $("#uf", d).onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target),
        v = Object.fromEntries(f);
      if (U.find((x) => x !== u && x.pin == v.pin.trim()))
        return toast("That passcode is already in use");
      const rec = {
        name: v.name.trim(),
        email: v.email.trim(),
        role: v.role,
        pin: v.pin.trim(),
        active: !!v.active,
        perms: v.role == "CEO" ? ROLE_PERMS.CEO : f.getAll("perm"),
      };
      const next = u
        ? { ...u, ...rec }
        : { id: Math.max(0, ...U.map((x) => x.id)) + 1, ...rec };
      const all = u ? U.map((x) => (x === u ? next : x)) : [...U, next];
      if (!all.some((x) => x.role == "CEO" && x.active))
        return toast("At least one active CEO is required");
      if (u && u.id == me.id && !next.active)
        return toast("You can't deactivate your own account");
      U = all;
      await db.put("users", U);
      d.close();
      draw();
      toast(u ? "User updated" : "User added");
    };
  };
  $("#au").onclick = () => form();
  $("#ut").onclick = async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.e) form(U.find((x) => x.id == b.dataset.e));
    if (b.dataset.d) {
      const u = U.find((x) => x.id == b.dataset.d);
      if (u.id == me.id) return toast("You can't delete your own account");
      if (lastCeo(u)) return toast("At least one active CEO is required");
      if (!confirm(`Delete user ${u.name}?`)) return;
      U = U.filter((x) => x !== u);
      await db.put("users", U);
      draw();
      toast("User deleted");
    }
  };
  $("#ex").onclick = async () => {
    logEvent(who(me), "Downloaded", "Backup", "", "");
    const out = {};
    for (const c of ["products", "orders", "bookings", "settings", "messages", "users"])
      out[c] = await db.get(c);
    out.users = out.users.map(({ pin, ...u }) => u);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }),
    );
    a.download = "mane-maison-backup-" + day(0) + ".json";
    a.click();
  };
  $("#rs").onclick = () => {
    if (CFG.API) return toast("Not available while connected to a server");
    if (
      !confirm(
        "Reset products, orders and bookings to the sample data? This cannot be undone.",
      )
    )
      return;
    ["products", "orders", "bookings"].forEach((c) => localStorage.removeItem("mm:" + c));
    logEvent(who(me), "Reset", "Sample data", "", "Products, orders and bookings");
    toast("Sample data restored");
  };
  draw();
};

/* Management navigation: same floating pill as the public pages, scrollable on small screens, only showing pages this user may open. */
function adminNav(me, key) {
  const L = PAGES.filter((p) => p[0] == "dashboard" || me.perms.includes(p[0]));
  document.body.insertAdjacentHTML(
    "beforeend",
    `<nav id="nav" class="anav" aria-label="Management"><i class="pill"></i>${L.map(([k, t, f]) => `<a href="${f}"${k == key ? ' class="on" aria-current="page"' : ""}>${k == "activity" ? "Activity" : t}</a>`).join("")}</nav>`,
  );
  const nv = $("#nav"),
    pl = $(".pill", nv),
    on = $("a.on", nv),
    set = (x, w) => {
      pl.style.setProperty("--x", x + "px");
      pl.style.setProperty("--w", w + "px");
    },
    go = () => {
      if (!on) return;
      set(on.offsetLeft, on.offsetWidth);
      sessionStorage.apill = JSON.stringify([on.offsetLeft, on.offsetWidth]);
      nv.scrollLeft = Math.max(0, on.offsetLeft - (nv.clientWidth - on.offsetWidth) / 2);
    },
    p = JSON.parse(sessionStorage.apill || "null");
  if (p && on) {
    pl.style.transition = "none";
    set(...p);
    pl.offsetWidth;
    pl.style.transition = "";
  }
  requestAnimationFrame(go);
  addEventListener("load", go);
  addEventListener("resize", go);
}

/* ---------- Boot: sign-in, access check, render ---------- */
(async () => {
  const key = document.body.dataset.admin,
    main = $("#main"),
    lock = $("#lock"),
    me = await (async () =>
      (await getUsers()).find((u) => u.id == sessionStorage.mm_user && u.active))();
  if (me && me.role == "CEO") me.perms = ROLE_PERMS.CEO;
  ME = me;
  if (key == "dashboard") {
    const g = $("#gate"),
      pin = $("#pin");
    pin.hidden = !!me;
    lock.textContent = me ? "Lock Dashboard" : "Unlock";
    g.classList.toggle("open", !!me);
    g.onsubmit = async (e) => {
      e.preventDefault();
      if (me) {
        await logEvent(who(me), "Signed out", "Session", "", "");
        sessionStorage.removeItem("mm_user");
        return location.reload();
      }
      const u = (await getUsers()).find(
        (x) => x.active && pin.value && x.pin == pin.value,
      );
      if (u) {
        await logEvent(who(u), "Signed in", "Session", "", "");
        sessionStorage.mm_user = u.id;
        return location.reload();
      }
      await logEvent("Unknown", "Failed sign-in", "Session", "", "Wrong passcode");
      toast("Incorrect passcode");
      g.classList.remove("shake");
      void g.offsetWidth;
      g.classList.add("shake");
    };
  } else {
    if (!me) return location.replace("dashboard.html");
    lock.onclick = async () => {
      await logEvent(who(me), "Signed out", "Session", "", "");
      sessionStorage.removeItem("mm_user");
      location.href = "dashboard.html";
    };
  }
  if (!me) return;
  setupBell(me);
  adminNav(me, key);
  main.hidden = false;
  if (key != "dashboard" && !me.perms.includes(key)) {
    main.innerHTML = `<p>Your account doesn't have access to this page.</p><br><a class="btn" href="dashboard.html">Back to dashboard</a>`;
    return;
  }
  await (VIEWS[key] || TOOL_VIEWS[key])(me, main);
})();
