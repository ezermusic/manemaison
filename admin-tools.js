/* Management tools: audit log, notifications, printing, CSV export, and the Reports, Customers and Activity pages.
   Loaded on every management page before admin.js. */
let ME = null;
const TOOL_VIEWS = {};
const BIZ = {
  name: "Mane Maison",
  phone: CFG.WA ? "0" + CFG.WA.slice(3) : "",
  email: "orders@manemaisonbeauty.com",
  web: "www.manemaisonbeauty.com",
};
const who = (u) => u.name + " (" + u.role + ")";
const when = (ts) =>
  new Date(ts).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
const ago = (ts) => {
  const m = Math.round((Date.now() - new Date(ts)) / 60000);
  return m < 1
    ? "just now"
    : m < 60
      ? m + " min ago"
      : m < 1440
        ? Math.round(m / 60) + " h ago"
        : when(ts);
};
const shiftDay = (d, n) => {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const weekStart = (d) => shiftDay(d, -((new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7));
const ordNo = (o) => o.ref || "#" + String(o.id).slice(-5);

/* ---------- CSV ---------- */
const csvCell = (v) => {
  v = v == null ? "" : String(v);
  if (/^[=+@-]/.test(v) && isNaN(v)) v = "'" + v;
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
};
function downloadCSV(name, rows) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob(["\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    }),
  );
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (ME) logEvent(who(ME), "Exported", "Report", name, rows.length - 1 + " rows");
}

/* ---------- Audit: every management save is compared with what was stored before ---------- */
const AUDIT = {
  products: ["Product", (o) => o.name, "id"],
  orders: ["Order", (o) => ordNo(o) + " · " + o.name, "id"],
  bookings: ["Booking", (o) => o.name + " · " + o.date + " " + o.time, "id"],
  users: ["User", (o) => o.name, "id"],
  customers: ["Customer", (o) => o.name, "key"],
  promos: ["Discount code", (o) => o.code, "id"],
  giftcards: ["Gift card", (o) => o.code, "id"],
  reviews: ["Review", (o) => o.name + " on product " + o.pid, "id"],
};
const short = (v) => {
  v = v && typeof v == "object" ? JSON.stringify(v) : String(v == null ? "—" : v);
  return v.startsWith("data:") ? "[image]" : v.length > 40 ? v.slice(0, 37) + "…" : v;
};
function changes(o, n) {
  const out = [];
  for (const k of new Set([...Object.keys(o), ...Object.keys(n)])) {
    const a = o[k],
      b = n[k];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    const plain = (x) => x && typeof x == "object" && !Array.isArray(x);
    if (k == "pin") out.push("passcode changed");
    else if (k == "items" || k == "services") out.push(k + " changed");
    else if (plain(a) && plain(b)) {
      for (const s of new Set([...Object.keys(a), ...Object.keys(b)]))
        if (JSON.stringify(a[s]) !== JSON.stringify(b[s]))
          out.push(`${k}.${s}: ${short(a[s])} → ${short(b[s])}`);
    } else out.push(`${k}: ${short(a)} → ${short(b)}`);
  }
  return out;
}
async function record(c, old, nw) {
  const user = who(ME);
  if (c == "settings") {
    const ch = changes(old || {}, nw || {});
    if (ch.length) await logEvent(user, "Updated", "Settings", "", ch.join("; "));
    return;
  }
  const meta = AUDIT[c];
  if (!meta || !Array.isArray(old) || !Array.isArray(nw)) return;
  const [ent, label, idk] = meta,
    om = new Map(old.map((x) => [x[idk], x])),
    nm = new Map(nw.map((x) => [x[idk], x])),
    ev = [];
  nw.forEach((n) => {
    const o = om.get(n[idk]);
    if (!o) ev.push(["Added", n, ""]);
    else {
      const ch = changes(o, n);
      if (ch.length) ev.push(["Updated", n, ch.join("; ")]);
    }
  });
  old.forEach((o) => {
    if (!nm.has(o[idk])) ev.push(["Deleted", o, ""]);
  });
  for (const [a, x, d] of ev.slice(0, 15)) await logEvent(user, a, ent, label(x), d);
  if (ev.length > 15)
    await logEvent(user, "Updated", ent, "", `…and ${ev.length - 15} more changes`);
  if (c == "products")
    for (const n of nw) {
      const o = om.get(n.id),
        thr = n.threshold || 5;
      if (o && n.stock <= thr && o.stock > thr)
        await notify(
          "stock",
          `Low stock: ${n.name} (${n.stock} left)`,
          "admin-inventory.html",
        );
    }
}
const _put = db.put.bind(db);
db.put = async (c, d) => {
  if (!ME || c == "audit" || c == "notifications") return _put(c, d);
  let old = null;
  try {
    old = await db.get(c);
  } catch (e) {}
  await _put(c, d);
  try {
    await record(c, old, d);
  } catch (e) {}
};

/* ---------- Notifications (bell in the management header) ---------- */
const NOTE_LABEL = {
  order: "Order",
  booking: "Booking",
  stock: "Low stock",
  review: "Review",
};
async function setupBell(me) {
  const ab = $(".abadge");
  if (!ab) return;
  ab.insertAdjacentHTML(
    "afterend",
    `<button class="bell" id="bell" aria-label="Notifications"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7"/><path d="M10 20a2 2 0 0 0 4 0"/></svg><b id="bcount" hidden>0</b></button>`,
  );
  let last = null;
  const refresh = async () => {
    const N = await db.get("notifications"),
      un = N.filter((n) => !n.read),
      b = $("#bcount");
    b.hidden = !un.length;
    b.textContent = un.length > 9 ? "9+" : un.length;
    const top = N.reduce((a, n) => Math.max(a, n.id), 0);
    if (last !== null && top > last) {
      const fresh = N.filter((n) => n.id > last && !n.read);
      if (fresh.length) {
        toast(fresh[0].text + (fresh.length > 1 ? ` (+${fresh.length - 1} more)` : ""));
        if (window.Notification && Notification.permission == "granted")
          fresh.forEach((n) => new Notification("Mane Maison", { body: n.text }));
      }
    }
    last = top;
  };
  const panel = async () => {
    const N = await db.get("notifications");
    const d = modal(
      `<h2>Notifications</h2><div class="mbtn" style="justify-content:flex-start"><button type="button" class="ghost" id="nr">Mark all read</button><button type="button" class="ghost" id="nd">Enable desktop alerts</button><button type="button" class="ghost dng" id="nc">Clear all</button></div>` +
        (N.slice(0, 50)
          .map(
            (n) =>
              `<a class="nrow${n.read ? "" : " un"}" href="${esc(n.link || "#")}" data-id="${n.id}"><span class="st st-${n.type}">${NOTE_LABEL[n.type] || "Alert"}</span><span>${esc(n.text)}</span><small>${ago(n.ts)}</small></a>`,
          )
          .join("") || "<p>No notifications yet.</p>"),
    );
    d.onclick = async (e) => {
      if (e.target == d) return d.close();
      const a = e.target.closest(".nrow");
      if (!a) return;
      e.preventDefault();
      const L = await db.get("notifications"),
        n = L.find((x) => x.id == a.dataset.id);
      if (n) n.read = true;
      await db.put("notifications", L);
      location.href = a.getAttribute("href");
    };
    $("#nr", d).onclick = async () => {
      const L = await db.get("notifications");
      L.forEach((n) => (n.read = true));
      await db.put("notifications", L);
      d.close();
      refresh();
    };
    $("#nc", d).onclick = async () => {
      if (!confirm("Clear all notifications?")) return;
      await db.put("notifications", []);
      d.close();
      refresh();
    };
    $("#nd", d).onclick = async () => {
      if (!window.Notification)
        return toast("This browser doesn't support desktop alerts");
      toast(
        (await Notification.requestPermission()) == "granted"
          ? "Desktop alerts enabled"
          : "Alerts not allowed",
      );
    };
  };
  $("#bell").onclick = panel;
  await refresh();
  setInterval(refresh, 15000);
}

/* ---------- Printing: invoice, packing slip, booking receipt ---------- */
const PRINT_CSS = `body{font:14px/1.5 Georgia,serif;color:#222;margin:32px auto;max-width:760px;padding:0 20px}header{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #5e0a2b;padding-bottom:14px;margin-bottom:18px}header img{height:56px;margin-bottom:6px}h1{margin:0;font-size:22px;color:#5e0a2b}h2{margin:0;font-size:26px;letter-spacing:.12em;color:#5e0a2b;text-align:right}p{margin:2px 0}.r{text-align:right}table{width:100%;border-collapse:collapse;margin:14px 0}th,td{padding:7px 8px;border-bottom:1px solid #ddd;text-align:left}th{background:#f6e9ef;font-size:12px;text-transform:uppercase;letter-spacing:.06em}td.r,th.r{text-align:right}tr.cat td{background:#faf4f7;font-weight:bold;color:#5e0a2b}.tot td{font-weight:bold;font-size:16px;border-top:2px solid #5e0a2b}.two{display:flex;gap:30px;justify-content:space-between}.box{width:18px;height:18px;border:1.5px solid #555;display:inline-block}.sig{margin-top:44px;display:flex;gap:40px}.sig div{flex:1;border-top:1px solid #555;padding-top:4px;font-size:12px}.np{text-align:center;margin-top:24px}.np button{padding:10px 26px;font-size:15px}.note{color:#555;font-size:12px;margin-top:20px}@media print{.np{display:none}body{margin:0}}`;
async function printDoc(title, body) {
  const S = await getSettings(),
    w = window.open("", "_blank");
  if (!w) return toast("Allow pop-ups to print");
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body>${body.replace("{{logo}}", esc(S.logo || "logo.jpg"))}<p class="np"><button onclick="print()">Print</button></p><script>setTimeout(function(){print()},600)<\/script></body></html>`,
  );
  w.document.close();
  if (ME) logEvent(who(ME), "Printed", "Document", title, "");
}
const docHead = (title, meta) =>
  `<header><div><img src="{{logo}}" alt=""><h1>${BIZ.name}</h1><p>${esc(BIZ.phone)} · ${esc(BIZ.email)}</p><p>${esc(BIZ.web)}</p></div><div><h2>${title}</h2><p class="r">${meta}</p></div></header>`;
const orderGroups = (o, P) => {
  const by = {};
  (o.items || []).forEach((i) => {
    const p = P.find((x) => x.id == i.id);
    if (p) (by[p.cat] = by[p.cat] || []).push({ p, q: i.q });
  });
  return Object.entries(by);
};
function invoiceHTML(o, P) {
  let n = 0;
  const g = orderGroups(o, P),
    pay = o.pay || { method: "—", status: "Paid" },
    rows =
      g
        .map(
          ([c, l]) =>
            `<tr class="cat"><td colspan="5">${esc(c)}</td></tr>` +
            l
              .map(
                ({ p, q }) =>
                  `<tr><td>${++n}</td><td>${esc(p.name)}</td><td class="r">${q}</td><td class="r">${money(p.price)}</td><td class="r">${money(p.price * q)}</td></tr>`,
              )
              .join(""),
        )
        .join("") || `<tr><td colspan="5">Order total (item detail not stored)</td></tr>`;
  return (
    docHead(
      "INVOICE",
      `No. INV-${o.ref || String(o.id).slice(-5)}<br>Date: ${o.date}<br>Payment: ${esc(pay.status)}`,
    ) +
    `<div class="two"><div><p><b>Bill to</b></p><p>${esc(o.name)}</p><p>${esc(o.phone || "")}</p><p>${esc(o.email || "")}</p><p>${esc(o.address || "")}</p></div><div class="r"><p><b>Order</b> ${ordNo(o)}</p><p>Method: ${esc(pay.method || "—")}</p>${pay.ref ? `<p>Ref: ${esc(pay.ref)}</p>` : ""}</div></div>` +
    `<table><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Amount</th></tr>${rows}${o.discount ? `<tr><td colspan="4" class="r">Subtotal</td><td class="r">${money(o.subtotal || o.total)}</td></tr><tr><td colspan="4" class="r">Discount (${esc(o.discount.code)})</td><td class="r">−${money(o.discount.amount)}</td></tr>` : ""}<tr class="tot"><td colspan="4" class="r">Total</td><td class="r">${money(o.total)}</td></tr></table>${o.gift ? `<p>Paid with gift card ${esc(o.gift.code)}: ${money(o.gift.amount)}</p>` : ""}<p class="note">Thank you for shopping with ${BIZ.name}.</p>`
  );
}
function slipHTML(o, P) {
  let n = 0;
  const g = orderGroups(o, P),
    rows =
      g
        .map(
          ([c, l]) =>
            `<tr class="cat"><td colspan="4">${esc(c)}</td></tr>` +
            l
              .map(
                ({ p, q }) =>
                  `<tr><td>${++n}</td><td>${esc(p.name)}</td><td class="r">${q}</td><td class="r"><span class="box"></span></td></tr>`,
              )
              .join(""),
        )
        .join("") ||
      `<tr><td colspan="4">No item detail stored for this order.</td></tr>`;
  return (
    docHead("PACKING SLIP", `Order ${ordNo(o)}<br>Date: ${o.date}`) +
    `<div class="two"><div><p><b>Ship to</b></p><p>${esc(o.name)}</p><p>${esc(o.phone || "")}</p><p>${esc(o.address || "")}</p></div></div><table><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Packed</th></tr>${rows}</table>${o.note ? `<p><b>Note:</b> ${esc(o.note)}</p>` : ""}<div class="sig"><div>Packed by</div><div>Checked by</div><div>Received by</div></div>`
  );
}
function receiptHTML(b) {
  let n = 0;
  const rows = b.services
    ? Object.entries(b.services)
        .map(
          ([c, l]) =>
            `<tr class="cat"><td colspan="3">${esc(c)}</td></tr>` +
            l
              .map(
                (x) =>
                  `<tr><td>${++n}</td><td>${esc(x.name)}</td><td class="r">${priceTxt(x.price)}</td></tr>`,
              )
              .join(""),
        )
        .join("")
    : `<tr><td>1</td><td>${esc(b.service)}</td><td class="r"></td></tr>`;
  return (
    docHead(
      "RECEIPT",
      `Booking ${b.ref || String(b.id).slice(-5)}<br>${nice(b.date)} at ${b.time}${b.stylist ? " · " + esc(b.stylist) : ""}<br>Status: ${esc(b.status || "Pending")}`,
    ) +
    `<div class="two"><div><p><b>Client</b></p><p>${esc(b.name)}</p><p>${esc(b.phone || "")}</p></div></div><table><tr><th>#</th><th>Service</th><th class="r">Price</th></tr>${rows}<tr class="tot"><td colspan="2" class="r">Total</td><td class="r">${money(b.total || 0)}</td></tr></table>${b.deposit && b.deposit.required ? `<p>Deposit ${money(b.deposit.required)}: ${esc(b.deposit.status)}</p>` : ""}${b.discount ? `<p>Discount (${esc(b.discount.code)}): −${money(b.discount.amount)}</p>` : ""}<p class="note">Thank you for choosing ${BIZ.name} Studio.</p>`
  );
}

/* ---------- Customers (built from orders and bookings, plus saved notes) ---------- */
const digits = (s) => String(s || "").replace(/\D/g, "");
const ckey = (phone, email, name) => {
  const d = digits(phone);
  return d.length >= 7
    ? d.slice(-9)
    : (email || "").trim().toLowerCase() ||
        String(name || "")
          .trim()
          .toLowerCase();
};
function buildCustomers(O, B, C) {
  const M = new Map();
  const get = (k) => {
    if (!M.has(k))
      M.set(k, {
        key: k,
        name: "",
        phone: "",
        email: "",
        tags: "",
        notes: "",
        orders: [],
        bookings: [],
        stored: false,
      });
    return M.get(k);
  };
  C.forEach((c) =>
    Object.assign(get(c.key), c, { stored: true, orders: [], bookings: [] }),
  );
  const fill = (r, x) => {
    r.name = r.name || x.name || "";
    r.phone = r.phone || x.phone || "";
    r.email = r.email || x.email || "";
  };
  O.forEach((o) => {
    const r = get(ckey(o.phone, o.email, o.name));
    fill(r, o);
    r.orders.push(o);
  });
  B.forEach((b) => {
    const r = get(ckey(b.phone, "", b.name));
    fill(r, b);
    r.bookings.push(b);
  });
  return [...M.values()].map((r) => {
    r.spent =
      r.orders.filter((o) => o.status != "Cancelled").reduce((a, o) => a + o.total, 0) +
      r.bookings
        .filter((b) => !["Cancelled", "No-show"].includes(b.status || "Pending"))
        .reduce((a, b) => a + (b.total || 0), 0);
    r.last =
      [...r.orders.map((o) => o.date), ...r.bookings.map((b) => b.date)].sort().pop() ||
      "";
    return r;
  });
}
TOOL_VIEWS.customers = async (me, m) => {
  let [O, B, C] = await Promise.all(
    ["orders", "bookings", "customers"].map((c) => db.get(c)),
  );
  let q = "",
    sort = "Most recent";
  m.innerHTML = `<div class="tool"><input id="q" placeholder="Search name, phone, email or tag"><select id="so" aria-label="Sort">${opts(["Most recent", "Top spenders", "Name"], sort)}</select><button id="add">+ Add customer</button><button class="ghost" id="ex">Export CSV</button></div><p class="meta" id="sum"></p><div class="tbl"><table id="tb"></table></div>`;
  const list = () => buildCustomers(O, B, C);
  const draw = () => {
    const all = list(),
      L = all
        .filter((r) =>
          (r.name + " " + r.phone + " " + r.email + " " + r.tags)
            .toLowerCase()
            .includes(q.toLowerCase()),
        )
        .sort((a, b) =>
          sort == "Top spenders"
            ? b.spent - a.spent
            : sort == "Name"
              ? a.name.localeCompare(b.name)
              : (b.last || "").localeCompare(a.last || ""),
        );
    $("#sum").textContent =
      `${L.length} of ${all.length} customers · ${money(all.reduce((a, r) => a + r.spent, 0))} lifetime value`;
    $("#tb").innerHTML =
      `<tr><th>Customer<th>Contact<th>Orders<th>Bookings<th>Spent<th>Last seen<th></tr>` +
      (L.map(
        (r) =>
          `<tr><td><b>${esc(r.name || "—")}</b>${r.tags ? `<br><small>${esc(r.tags)}</small>` : ""}<td>${esc(r.phone)}<br><small>${esc(r.email)}</small><td>${r.orders.length}<td>${r.bookings.length}<td>${money(r.spent)}<td>${r.last || "—"}<td><button class="ghost" data-k="${esc(r.key)}">Open</button></tr>`,
      ).join("") || `<tr><td colspan="7">No customers match.</tr>`);
  };
  const open = (r) => {
    const isNew = !r;
    r = r || {
      key: "",
      name: "",
      phone: "",
      email: "",
      tags: "",
      notes: "",
      orders: [],
      bookings: [],
      stored: false,
    };
    const hist =
      r.orders
        .map(
          (o) =>
            `<div class="line"><span>${o.date} · Order ${ordNo(o)} · ${esc(o.status)}</span><b>${money(o.total)}</b></div>`,
        )
        .join("") +
      r.bookings
        .map(
          (b) =>
            `<div class="line"><span>${b.date} ${b.time} · ${esc(b.service)} · ${esc(b.status || "Pending")}</span><b>${b.total == null ? "—" : money(b.total)}</b></div>`,
        )
        .join("");
    const d = modal(
      `<form id="cf"><h2>${isNew ? "Add customer" : esc(r.name || "Customer")}</h2><div class="g2"><label>Name<input name="name" required value="${esc(r.name)}"></label><label>Phone<input name="phone" type="tel" value="${esc(r.phone)}"></label></div><div class="g2"><label>Email<input name="email" type="email" value="${esc(r.email)}"></label><label>Tags (comma separated)<input name="tags" placeholder="VIP, wig client" value="${esc(r.tags)}"></label></div><label>Notes<textarea name="notes" rows="3" placeholder="Preferences, hair type, allergies…">${esc(r.notes)}</textarea></label>${hist ? `<h4>History</h4>${hist}` : ""}<div class="mbtn">${!isNew && r.phone ? `<a class="btn ghost" href="https://wa.me/${waPhone(r.phone)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}${r.stored ? `<button type="button" class="ghost dng" id="del">Remove saved notes</button>` : ""}<button type="button" class="ghost" data-close>Close</button><button>Save</button></div></form>`,
    );
    $("#cf", d).onsubmit = async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(e.target)),
        rec = {
          key: r.key || ckey(v.phone, v.email, v.name),
          name: v.name.trim(),
          phone: v.phone.trim(),
          email: v.email.trim(),
          tags: v.tags.trim(),
          notes: v.notes.trim(),
        },
        at = C.findIndex((x) => x.key == rec.key);
      if (at >= 0) C[at] = { ...C[at], ...rec };
      else C.push({ ...rec, created: day(0) });
      await db.put("customers", C);
      d.close();
      draw();
      toast("Customer saved");
    };
    if (r.stored)
      $("#del", d).onclick = async () => {
        if (
          !confirm(
            "Remove the saved notes for this customer? Order and booking history stay.",
          )
        )
          return;
        C = C.filter((x) => x.key != r.key);
        await db.put("customers", C);
        d.close();
        draw();
      };
  };
  $("#q").oninput = (e) => {
    q = e.target.value;
    draw();
  };
  $("#so").onchange = (e) => {
    sort = e.target.value;
    draw();
  };
  $("#add").onclick = () => open();
  $("#tb").onclick = (e) => {
    const b = e.target.closest("[data-k]");
    if (b) open(list().find((r) => r.key == b.dataset.k));
  };
  $("#ex").onclick = () =>
    downloadCSV("mane-maison-customers-" + day(0) + ".csv", [
      [
        "Name",
        "Phone",
        "Email",
        "Tags",
        "Orders",
        "Bookings",
        "Total spent",
        "Last seen",
        "Notes",
      ],
      ...list().map((r) => [
        r.name,
        r.phone,
        r.email,
        r.tags,
        r.orders.length,
        r.bookings.length,
        r.spent,
        r.last,
        r.notes,
      ]),
    ]);
  draw();
};

/* ---------- Reports ---------- */
TOOL_VIEWS.reports = async (me, m) => {
  const [O, B, P] = await Promise.all(
    ["orders", "bookings", "products"].map((c) => db.get(c)),
  );
  const st = {
    from: shiftDay(day(0), -29),
    to: day(0),
    g: "Day",
    bm: "All except cancelled",
  };
  const BM = ["All except cancelled", "Confirmed and completed", "Completed only"];
  m.innerHTML = `<div class="chips" id="rp"></div><div class="tool"><label class="fl">From<input type="date" id="rf"></label><label class="fl">To<input type="date" id="rt"></label><label class="fl">Group by<select id="rg">${opts(["Day", "Week", "Month"], st.g)}</select></label><label class="fl">Count bookings<select id="rb">${opts(BM, st.bm)}</select></label></div><div id="ro"></div>`;
  const ranges = {
    "Last 7 days": () => [shiftDay(day(0), -6), day(0)],
    "Last 30 days": () => [shiftDay(day(0), -29), day(0)],
    "This month": () => [day(0).slice(0, 8) + "01", day(0)],
    "Last month": () => {
      const f = shiftDay(day(0).slice(0, 8) + "01", -1);
      return [f.slice(0, 8) + "01", f];
    },
    "This year": () => [day(0).slice(0, 4) + "-01-01", day(0)],
  };
  $("#rp").innerHTML = Object.keys(ranges)
    .map((k) => `<button data-r="${k}">${k}</button>`)
    .join("");
  const okB = (b) => {
    const s = b.status || "Pending";
    return st.bm == "Completed only"
      ? s == "Completed"
      : st.bm == "Confirmed and completed"
        ? ["Confirmed", "Completed"].includes(s)
        : !["Cancelled", "No-show"].includes(s);
  };
  const keyOf = (d) =>
    st.g == "Day" ? d : st.g == "Week" ? weekStart(d) : d.slice(0, 7);
  const labOf = (k) =>
    st.g == "Month" ? k : st.g == "Week" ? "wk " + k.slice(5) : k.slice(5);
  const draw = () => {
    $("#rf").value = st.from;
    $("#rt").value = st.to;
    const inR = (d) => d >= st.from && d <= st.to,
      ords = O.filter((o) => o.status != "Cancelled" && inR(o.date)),
      bks = B.filter((b) => okB(b) && inR(b.date)),
      buckets = new Map();
    for (let d = st.from, i = 0; d <= st.to && i < 800; d = shiftDay(d, 1), i++)
      if (!buckets.has(keyOf(d))) buckets.set(keyOf(d), { o: 0, s: 0, b: 0, t: 0 });
    ords.forEach((o) => {
      const x = buckets.get(keyOf(o.date));
      if (x) {
        x.o++;
        x.s += o.total;
      }
    });
    bks.forEach((b) => {
      const x = buckets.get(keyOf(b.date));
      if (x) {
        x.b++;
        x.t += b.total || 0;
      }
    });
    const rows = [...buckets.entries()],
      shop = ords.reduce((a, o) => a + o.total, 0),
      studio = bks.reduce((a, b) => a + (b.total || 0), 0),
      mx = Math.max(1, ...rows.map(([, x]) => x.s + x.t));
    const prod = {};
    ords.forEach((o) =>
      (o.items || []).forEach((i) => {
        const p = P.find((x) => x.id == i.id);
        if (!p) return;
        const r = (prod[p.id] = prod[p.id] || {
          name: p.name,
          cat: p.cat,
          units: 0,
          rev: 0,
        });
        r.units += i.q;
        r.rev += i.q * p.price;
      }),
    );
    let pl = Object.values(prod),
      pnote = "";
    if (!pl.length) {
      pl = P.filter((p) => p.sold).map((p) => ({
        name: p.name,
        cat: p.cat,
        units: p.sold,
        rev: p.sold * p.price,
      }));
      pnote =
        "No itemised orders in this period, so lifetime units sold from stock records are shown.";
    }
    pl.sort((a, b) => b.units - a.units);
    const svc = {};
    bks.forEach((b) =>
      Object.entries(b.services || {}).forEach(([c, l]) =>
        l.forEach((x) => {
          const r = (svc[c + "|" + x.name] = svc[c + "|" + x.name] || {
            name: x.name,
            cat: c,
            units: 0,
            rev: 0,
          });
          r.units++;
          r.rev += x.price || 0;
        }),
      ),
    );
    const sl = Object.values(svc).sort((a, b) => b.units - a.units);
    const rank = (l, note) => {
      const top = l.slice(0, 10),
        mu = Math.max(1, ...top.map((r) => r.units));
      return (
        (top.length
          ? `<div class="tbl"><table><tr><th>#<th>Name<th>Units<th>Revenue<th></tr>${top.map((r, i) => `<tr><td>${i + 1}<td>${esc(r.name)}<br><small>${esc(r.cat)}</small><td>${r.units}<td>${money(r.rev)}<td><span class="stk" style="width:${Math.round((r.units / mu) * 90)}px"></span></tr>`).join("")}</table></div>`
          : `<p class="meta">Nothing to show for this period.</p>`) +
        (note ? `<p class="meta">${note}</p>` : "")
      );
    };
    $("#ro").innerHTML =
      `<div class="kpis">${[
        ["Total revenue", money(shop + studio)],
        ["Shop revenue", money(shop)],
        ["Studio revenue", money(studio)],
        ["Orders", ords.length],
        ["Bookings", bks.length],
        ["Average order", money(ords.length ? shop / ords.length : 0)],
      ]
        .map((k) => `<div class="kpi"><b>${k[1]}</b><small>${k[0]}</small></div>`)
        .join("")}</div><br>` +
      `<h3>Sales by ${st.g.toLowerCase()}</h3><p class="meta"><span class="dot a"></span> Shop <span class="dot b"></span> Studio</p><div class="rchart">${rows.map(([k, x]) => `<div class="rcol" title="${labOf(k)}: ${money(x.s + x.t)}"><div class="stack"><i class="sg b" data-h="${(x.t / mx) * 100}"></i><i class="sg a" data-h="${(x.s / mx) * 100}"></i></div><span>${labOf(k)}</span></div>`).join("")}</div><br>` +
      `<div class="tbl tall"><table><tr><th>${st.g}<th>Orders<th>Shop<th>Bookings<th>Studio<th>Total</tr>${rows.map(([k, x]) => `<tr><td>${k}<td>${x.o}<td>${money(x.s)}<td>${x.b}<td>${money(x.t)}<td><b>${money(x.s + x.t)}</b></tr>`).join("")}</table></div><br>` +
      `<div class="two2"><div><h3>Best-selling products</h3>${rank(pl, pnote)}</div><div><h3>Best-selling services</h3>${rank(sl, "Counts bookings made through the booking page.")}</div></div><br>` +
      `<h3>Export for your accountant</h3><div class="tool"><button id="e1">Summary CSV</button><button class="ghost" id="e2">Orders CSV</button><button class="ghost" id="e3">Bookings CSV</button><button class="ghost" id="e4">Best sellers CSV</button></div>`;
    requestAnimationFrame(() =>
      setTimeout(
        () => $$(".sg").forEach((s) => (s.style.height = s.dataset.h + "%")),
        60,
      ),
    );
    const tag = `${st.from}-to-${st.to}`,
      allO = O.filter((o) => inR(o.date)),
      allB = B.filter((b) => inR(b.date));
    $("#e1").onclick = () =>
      downloadCSV(`mane-maison-summary-${tag}.csv`, [
        [st.g, "Orders", "Shop revenue", "Bookings", "Studio revenue", "Total revenue"],
        ...rows.map(([k, x]) => [k, x.o, x.s, x.b, x.t, x.s + x.t]),
        ["Total", ords.length, shop, bks.length, studio, shop + studio],
      ]);
    $("#e2").onclick = () =>
      downloadCSV(`mane-maison-orders-${tag}.csv`, [
        [
          "Order #",
          "Date",
          "Customer",
          "Phone",
          "Email",
          "Items",
          "Total",
          "Payment method",
          "Payment status",
          "Order status",
        ],
        ...allO.map((o) => [
          ordNo(o),
          o.date,
          o.name,
          o.phone,
          o.email,
          (o.items || [])
            .map((i) => {
              const p = P.find((x) => x.id == i.id);
              return i.q + " x " + (p ? p.name : "item " + i.id);
            })
            .join("; "),
          o.total,
          o.pay ? o.pay.method : "",
          o.pay ? o.pay.status : "Paid",
          o.status,
        ]),
      ]);
    $("#e3").onclick = () =>
      downloadCSV(`mane-maison-bookings-${tag}.csv`, [
        ["Date", "Time", "Client", "Phone", "Services", "Total", "Status"],
        ...allB.map((b) => [
          b.date,
          b.time,
          b.name,
          b.phone,
          b.service,
          b.total,
          b.status || "Pending",
        ]),
      ]);
    $("#e4").onclick = () =>
      downloadCSV(`mane-maison-best-sellers-${tag}.csv`, [
        ["Type", "Name", "Category", "Units", "Revenue"],
        ...pl.map((r) => ["Product", r.name, r.cat, r.units, r.rev]),
        ...sl.map((r) => ["Service", r.name, r.cat, r.units, r.rev]),
      ]);
  };
  $("#rp").onclick = (e) => {
    const b = e.target.closest("[data-r]");
    if (b) {
      [st.from, st.to] = ranges[b.dataset.r]();
      draw();
    }
  };
  $("#rf").onchange = (e) => {
    st.from = e.target.value || st.from;
    draw();
  };
  $("#rt").onchange = (e) => {
    st.to = e.target.value || st.to;
    draw();
  };
  $("#rg").onchange = (e) => {
    st.g = e.target.value;
    draw();
  };
  $("#rb").onchange = (e) => {
    st.bm = e.target.value;
    draw();
  };
  draw();
};

/* ---------- Activity log ---------- */
TOOL_VIEWS.activity = async (me, m) => {
  const A = await db.get("audit");
  let q = "",
    u = "All",
    e = "All",
    lim = 100;
  const users = ["All", ...new Set(A.map((a) => a.user))],
    ents = ["All", ...new Set(A.map((a) => a.entity))];
  m.innerHTML = `<div class="tool"><input id="q" placeholder="Search activity"><select id="uf">${opts(users, u)}</select><select id="ef">${opts(ents, e)}</select><button class="ghost" id="ex">Export CSV</button></div><p class="meta" id="sum"></p><div class="tbl"><table id="tb"></table></div><p><button class="ghost" id="more" hidden>Show more</button></p>`;
  const view = () =>
    A.filter(
      (a) =>
        (u == "All" || a.user == u) &&
        (e == "All" || a.entity == e) &&
        [a.user, a.action, a.entity, a.ref, a.detail]
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase()),
    );
  const draw = () => {
    const L = view();
    $("#sum").textContent = `${L.length} entries · newest first`;
    $("#tb").innerHTML =
      `<tr><th>When<th>Who<th>Action<th>Item<th>Details</tr>` +
      (L.slice(0, lim)
        .map(
          (a) =>
            `<tr><td>${when(a.ts)}<td>${esc(a.user)}<td>${pill(a.action)}<td>${esc(a.entity)}${a.ref ? `<br><small>${esc(a.ref)}</small>` : ""}<td class="clip" style="max-width:360px;white-space:normal" title="${esc(a.detail || "")}">${esc(a.detail || "")}</tr>`,
        )
        .join("") || `<tr><td colspan="5">No activity recorded yet.</tr>`);
    $("#more").hidden = L.length <= lim;
  };
  $("#q").oninput = (x) => {
    q = x.target.value;
    draw();
  };
  $("#uf").onchange = (x) => {
    u = x.target.value;
    draw();
  };
  $("#ef").onchange = (x) => {
    e = x.target.value;
    draw();
  };
  $("#more").onclick = () => {
    lim += 100;
    draw();
  };
  $("#ex").onclick = () =>
    downloadCSV("mane-maison-activity-" + day(0) + ".csv", [
      ["When", "Who", "Action", "Item type", "Item", "Details"],
      ...view().map((a) => [a.ts, a.user, a.action, a.entity, a.ref, a.detail]),
    ]);
  draw();
};
