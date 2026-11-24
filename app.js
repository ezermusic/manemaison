/* Mane Maison — shared client. Set CFG.API to your REST base (e.g. https://api.manemaisonbeauty.com/v1) and every
   db.get/db.put call below switches from localStorage to GET/PUT /{collection}. CEO auth must move server-side (JWT). */
const CFG = {
  API: null,
  MAIL: { to: "bookings@manemaisonbeauty.com", cc: "office@manemaisonbeauty.com" },
  PAYSTACK_KEY: "",
  SOCIAL: {
    ig: "https://instagram.com/manemaisonbeauty",
    fb: "https://facebook.com/manemaisonbeauty",
    tt: "https://tiktok.com/@manemaisonbeauty",
  },
  MOMO: "0537751108",
  PIN: "maison2026",
  WA: "233544742782",
  CUR: "GH₵",
};
const $ = (s, r = document) => r.querySelector(s),
  $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";"),
  day = (o) => new Date(Date.now() + o * 864e5).toISOString().slice(0, 10),
  money = (n) => CFG.CUR + Number(n).toLocaleString();
const mk = (c) =>
  ({
    products: [
      [1, "Silk Bone-Straight Wig", "Wigs", 1850, 12, 34],
      [2, "Deep Wave Lace Frontal", "Wigs", 2400, 7, 21],
      [3, "Honey Blonde Bob", "Wigs", 1450, 3, 18],
      [4, "Satin Bonnet", "Accessories", 85, 40, 96],
      [5, "Pearl Claw Clip Set", "Accessories", 60, 55, 73],
      [6, "Edge Control Balm", "Care", 70, 4, 88],
      [7, "Argan Repair Mask", "Care", 120, 26, 41],
      [8, "Wide-Tooth Detangler", "Accessories", 45, 30, 52],
    ].map((p) => ({
      id: p[0],
      name: p[1],
      cat: p[2],
      price: p[3],
      stock: p[4],
      sold: p[5],
    })),
    orders: [1850, 2400, 1620, 3100, 980, 2750, 1900].map((t, i) => ({
      id: 100 + i,
      date: day(i - 6),
      name: "Client " + (i + 1),
      total: t,
      status: "Delivered",
    })),
    bookings: [
      ["Silk Press", "10:00"],
      ["Wig Install", "12:00"],
      ["Deep Conditioning", "14:00"],
    ].map((b, i) => ({
      id: i + 1,
      date: day(i),
      service: b[0],
      time: b[1],
      name: "Client",
      phone: "",
    })),
  })[c] || [];
const db = {
  async get(c) {
    if (CFG.API) return (await fetch(`${CFG.API}/${c}`)).json();
    let v = localStorage["mm:" + c];
    if (!v) {
      v = JSON.stringify(mk(c));
      localStorage["mm:" + c] = v;
    }
    return JSON.parse(v);
  },
  async put(c, d) {
    if (CFG.API)
      return fetch(`${CFG.API}/${c}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      });
    localStorage["mm:" + c] = JSON.stringify(d);
  },
};
const toast = (m) => {
  const t = $("#toast");
  t.textContent = m;
  t.classList.add("o");
  setTimeout(() => t.classList.remove("o"), 2600);
};
const wa = (m) =>
  window.open(`https://wa.me/${CFG.WA}?text=${encodeURIComponent(m)}`, "_blank");
const mono =
  '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="none" stroke="currentColor"/><text x="20" y="27" text-anchor="middle" font-family="Cormorant Garamond,serif" font-size="20" fill="currentColor">MM</text></svg>';
const cart = {
  get: () => JSON.parse(localStorage["mm:cart"] || "[]"),
  set(c) {
    localStorage["mm:cart"] = JSON.stringify(c);
    $("#cc").textContent = c.reduce((a, b) => a + b.q, 0);
  },
};
/* SERVICE PRICES (GH₵) are PLACEHOLDERS: edit the numbers below. Format: [service name, price]. 0 shows "Free"; null shows "On request" and is left out of the total. */
/* Product ids may be numbers (sample data) or text (a database), so keep them as they are. */
const pid = (v) => (v !== "" && !isNaN(v) ? +v : v);
const money2 = (n) => Math.round(n * 100) / 100;
const toMin = (t) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const fmtMin = (m) =>
  String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const durTxt = (m) =>
  (
    (m >= 60 ? Math.floor(m / 60) + " h " : "") + (m % 60 ? (m % 60) + " min" : "")
  ).trim() || "0 min";
const stars = (n) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
const nextRef = (list, prefix) =>
  prefix +
  (Math.max(
    1000,
    ...list.map((x) => parseInt(String(x.ref || "").replace(/\D/g, "")) || 0),
  ) +
    1);
const trackUrl = () => new URL("track.html", location.href).href;
/* Studio settings with defaults (edited in Management > Settings). */
const studioCfg = (S) => ({
  open: S.open || "09:00",
  close: S.close || "18:00",
  slot: S.slot || 60,
  closedDays: S.closedDays || [0],
  closedDates: S.closedDates || [],
  stylists:
    S.stylists && S.stylists.length
      ? S.stylists
      : [{ id: 1, name: "Studio stylist", active: true }],
  deposit: Object.assign({ on: false, type: "percent", value: 20, note: "" }, S.deposit),
  msgs: Object.assign(
    {
      reminder:
        "Hello {name}, a reminder of your appointment at Mane Maison Studio tomorrow, {date} at {time} with {stylist}. Services: {services}. Please reply to confirm or to reschedule. See you soon!",
      confirm:
        "Hello {name}, your booking {ref} at Mane Maison Studio is confirmed for {date} at {time} with {stylist}. Services: {services}. We look forward to seeing you!",
    },
    S.msgs,
  ),
  confirmPrompt: S.confirmPrompt !== false,
});
/* Discount codes and gift cards (collections: promos, giftcards). */
async function checkPromo(code, subtotal, scope) {
  code = (code || "").trim().toUpperCase();
  if (!code) return { amount: 0 };
  const p = (await db.get("promos")).find((x) => x.code == code);
  if (!p || p.active === false) return { error: "Discount code not recognised" };
  if (p.expires && p.expires < day(0)) return { error: "That discount code has expired" };
  if (p.maxUses && (p.used || 0) >= p.maxUses)
    return { error: "That discount code has reached its limit" };
  if (p.scope && p.scope != "all" && p.scope != scope)
    return { error: "That code is for " + p.scope + " purchases only" };
  if (p.minSpend && subtotal < p.minSpend)
    return { error: "Minimum spend for that code is " + money(p.minSpend) };
  return {
    amount: money2(
      p.type == "percent" ? (subtotal * p.value) / 100 : Math.min(p.value, subtotal),
    ),
    promo: p,
  };
}
async function checkGift(code, due) {
  code = (code || "").trim().toUpperCase();
  if (!code) return { amount: 0 };
  const g = (await db.get("giftcards")).find((x) => x.code == code);
  if (!g || g.active === false) return { error: "Gift card not recognised" };
  if (g.expires && g.expires < day(0)) return { error: "That gift card has expired" };
  if (!(g.balance > 0)) return { error: "That gift card has no balance left" };
  return { amount: money2(Math.min(g.balance, due)), card: g };
}
async function useCodes(promo, card, giftAmt, ref) {
  if (promo) {
    const L = await db.get("promos"),
      x = L.find((y) => y.id == promo.id);
    if (x) x.used = (x.used || 0) + 1;
    await db.put("promos", L);
  }
  if (card && giftAmt > 0) {
    const L = await db.get("giftcards"),
      x = L.find((y) => y.id == card.id);
    if (x) {
      x.balance = money2(x.balance - giftAmt);
      (x.history = x.history || []).push({ date: day(0), amount: -giftAmt, ref });
    }
    await db.put("giftcards", L);
  }
}
const wish = {
  get: () => JSON.parse(localStorage["mm:wish"] || "[]"),
  set(w) {
    localStorage["mm:wish"] = JSON.stringify(w);
    const c = $("#wc");
    if (c) c.textContent = w.length;
    $$("[data-wish]").forEach((b) => {
      const on = w.map(String).includes(b.dataset.wish);
      b.classList.toggle("on", on);
      b.textContent = on ? "♥" : "♡";
    });
  },
};
/* SERVICES: [name, price (GH₵, null = on request), duration in minutes]. Prices and durations are PLACEHOLDERS: edit them here. */
const SERVICES = [
  [
    "Hair Styling",
    [
      ["Wash and blow-dry", 80, 45],
      ["Silk press and flat ironing", 250, 90],
      ["Curls, waves and heat styling", 150, 60],
      ["Updos, bridal and event styling", 300, 90],
      ["Braids and plaits (cornrows, box braids, knotless braids, twists)", 400, 240],
      ["Ponytails, buns and sleek styles", 120, 60],
      ["Extension styling and installs (sew-in, clip-in, tape-in)", 350, 150],
    ],
  ],
  [
    "Hair Color",
    [
      ["Full color and root touch-up", 450, 150],
      ["Highlights, lowlights and balayage", 700, 210],
      ["Ombré and fashion colors", 600, 180],
      ["Gray coverage", 350, 120],
      ["Toning and color correction", 400, 90],
    ],
  ],
  [
    "Hair Treatments & Care",
    [
      ["Deep conditioning", 180, 60],
      ["Protein and moisture treatments", 200, 60],
      ["Scalp treatment and scalp massage", 150, 45],
      ["Hair steaming", 120, 30],
      ["Keratin and smoothing treatments", 600, 180],
      ["Dandruff and hair-loss care", 250, 60],
      ["Trim and split-end removal", 80, 30],
    ],
  ],
  [
    "Cutting & Shaping",
    [
      ["Women's and men's cuts", 100, 45],
      ["Children's cuts", 60, 30],
      ["Fringe/bang trims", 40, 15],
      ["Beard trim and shaping", 50, 30],
    ],
  ],
  [
    "Wig Services",
    [
      ["Wig installation (lace front, closure, full lace)", 350, 90],
      ["Custom wig making", 800, 240],
      ["Wig revamping and restoration", 300, 120],
      ["Professional wig coloring and toning", 500, 150],
      ["Wig styling (curl, straighten, cut, bleach knots, pluck hairline)", 250, 90],
      ["Wig washing and maintenance", 120, 60],
      ["Wig consultation and fitting", 50, 30],
    ],
  ],
  [
    "Hair Removal",
    [
      ["Waxing (brows, lip, face, underarms, legs, bikini)", 120, 45],
      ["Threading", 60, 30],
      ["Sugaring", 130, 45],
    ],
  ],
  [
    "Nails",
    [
      ["Manicure and pedicure", 180, 75],
      ["Gel polish and acrylics", 250, 90],
      ["Nail extensions and nail art", 300, 120],
      ["Nail repair and removal", 80, 30],
    ],
  ],
  [
    "Skin Care",
    [
      ["Facials (cleansing, hydrating, anti-aging, acne)", 300, 60],
      ["Exfoliation and deep-cleansing treatments", 250, 60],
      ["Chemical peels and dermaplaning", 400, 60],
      ["Back and body facials", 350, 75],
    ],
  ],
  [
    "Brows & Lashes",
    [
      ["Eyebrow shaping, tinting and lamination", 100, 30],
      ["Microblading", 800, 150],
      ["Lash lifts and tints", 250, 60],
      ["Eyelash extensions (classic, hybrid, volume)", 350, 120],
    ],
  ],
  [
    "Makeup",
    [
      ["Everyday and event makeup", 250, 60],
      ["Bridal makeup and trials", 800, 120],
      ["Makeup lessons", 400, 90],
      ["Airbrush makeup", 500, 75],
    ],
  ],
  [
    "Body & Wellness",
    [
      ["Massage (relaxation, deep tissue)", 300, 60],
      ["Body scrubs and wraps", 350, 75],
      ["Spray tanning", 200, 30],
      ["Aromatherapy", 250, 60],
    ],
  ],
  [
    "Bridal & Event Packages",
    [
      ["Bridal hair and makeup", 1500, 300],
      ["Bridesmaid and mother-of-the-bride packages", 700, 180],
      ["Prom, graduation and photoshoot styling", 500, 150],
      ["On-location or mobile services", 400, 60],
    ],
  ],
  [
    "Men's Grooming",
    [
      ["Haircuts and fades", 60, 30],
      ["Hot-towel shave", 70, 30],
      ["Beard treatments", 90, 30],
      ["Facials for men", 200, 45],
    ],
  ],
  [
    "Consultations & Add-ons",
    [
      ["Hair or beauty consultation", 0, 30],
      ["Aftercare advice", 0, 15],
      ["Gift card or membership enquiry", null, 15],
    ],
  ],
];
const priceTxt = (p) => (p == null ? "On request" : p == 0 ? "Free" : money(p));
const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const IMG_DIR = "images/";
/* Image links: product photo = images/<product-name-slug>.jpg (or the product's own img file); category photo = images/cat-<category-slug>.jpg. .jpg, .png, .webp and .jpeg are tried automatically. */
const imgSrc = (name, file) => {
  const f = file || slug(name) + ".jpg";
  return f.includes("/") ? f : IMG_DIR + f;
};
window.imgNext = (i) => {
  const t = (i.dataset.t || "") + " " + i.src.split(".").pop().split("?")[0];
  i.dataset.t = t;
  const n = ["jpg", "png", "webp", "jpeg"].find((e) => !t.includes(e));
  n ? (i.src = i.src.replace(/\.\w+(\?.*)?$/, "." + n)) : i.remove();
};
const art = (p) =>
  `<div class="art has" style="--h:${(p.id * 47) % 360}">${esc(
    p.name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join(""),
  )}<em>${esc(p.cat)}</em><img src="${esc(imgSrc(p.name, p.img))}" alt="${esc(p.name)}" loading="lazy" onerror="imgNext(this)"></div>`;
const card = (p) => {
  const w = wish.get().map(String).includes(String(p.id)),
    link = "product.html?id=" + p.id;
  return `<div class="prod"><div class="aw"><a href="${link}" aria-label="${esc(p.name)}">${art(p)}</a><button class="heart${w ? " on" : ""}" data-wish="${p.id}" aria-label="Save to wishlist">${w ? "♥" : "♡"}</button></div><a class="pn" href="${link}"><b>${esc(p.name)}</b></a><div class="row"><span>${money(p.price)}</span><button data-add="${p.id}" ${p.stock < 1 ? "disabled" : ""}>${p.stock < 1 ? "Sold out" : "Add"}</button></div><small>${p.stock < 1 ? "" : p.stock <= (p.threshold || 5) ? "Only " + p.stock + " left" : "In stock"}</small></div>`;
};
const ICON = {
  wa: '<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z"/><path d="M9 8c0 4 3 7 7 7l1-2-2.5-1-1 1c-1-.4-2-1.4-2.4-2.4l1-1L11 8z"/>',
  ig: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r=".6"/>',
  fb: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v7h4v-7h3l1-4h-4V8z"/>',
  tt: '<path d="M16 3a5 5 0 0 0 4 4v3a8 8 0 0 1-4-1.2V15a6 6 0 1 1-6-6v3.2a2.8 2.8 0 1 0 3 2.8V3z"/>',
};
function loadPaystack() {
  return new Promise((r) => {
    if (window.PaystackPop) return r();
    const t = document.createElement("script");
    t.src = "https://js.paystack.co/v1/inline.js";
    t.onload = r;
    document.head.appendChild(t);
  });
}
async function notify(type, text, link) {
  const N = await db.get("notifications");
  N.unshift({
    id: Date.now() + Math.random(),
    ts: new Date().toISOString(),
    type,
    text,
    link,
    read: false,
  });
  await db.put("notifications", N.slice(0, 200));
}
async function logEvent(user, action, entity, ref, detail) {
  const A = await db.get("audit");
  A.unshift({
    id: Date.now() + Math.random(),
    ts: new Date().toISOString(),
    user,
    action,
    entity,
    ref,
    detail,
  });
  await db.put("audit", A.slice(0, 1000));
}
function shell() {
  if (document.body.dataset.admin) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<header class="top"><a class="brand" href="index.html">${mono}<span class="serif">Mane Maison</span></a><span class="abadge">Management</span></header><div id="toast" role="status"></div>`,
    );
    return;
  }
  const cur = document.body.dataset.page,
    L = [
      ["index", "Home"],
      ["shop", "Shop"],
      ["bookings", "Book"],
      ["about", "About"],
      ["contact", "Contact"],
    ];
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<header class="top"><a class="brand" href="index.html">${mono}<span class="serif">Mane Maison</span></a><div class="hr"><a class="cartbtn" href="wishlist.html" aria-label="Wishlist">♡ <b id="wc">0</b></a><button class="cartbtn" id="cb">Bag <b id="cc">0</b></button></div></header><nav id="nav" aria-label="Main"><i class="pill"></i>${L.map(([h, t]) => `<a href="${h}.html"${h == cur ? ' class="on" aria-current="page"' : ""}>${t}</a>`).join("")}</nav><div id="ov"></div><aside id="drawer" aria-label="Bag"></aside><div id="toast" role="status"></div>`,
  );
  const soc = [
    ["wa", "WhatsApp", "https://wa.me/" + CFG.WA],
    ["ig", "Instagram", CFG.SOCIAL.ig],
    ["fb", "Facebook", CFG.SOCIAL.fb],
    ["tt", "TikTok", CFG.SOCIAL.tt],
  ];
  document.body.insertAdjacentHTML(
    "beforeend",
    `<footer><div class="wrap"><div class="serif" style="font-size:2rem">for the love of beauty</div><p><a href="track.html">Track your order or booking</a></p><div class="soc">${soc.map((x) => `<a href="${x[2]}" target="_blank" rel="noopener" aria-label="${x[1]}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${ICON[x[0]]}</svg></a>`).join("")}</div><div><a href="tel:0537751108">Call / WhatsApp 0537751108</a><a href="mailto:orders@manemaisonbeauty.com">Wig store · orders@manemaisonbeauty.com</a><a href="mailto:bookings@manemaisonbeauty.com">Hair studio · bookings@manemaisonbeauty.com</a><a href="mailto:office@manemaisonbeauty.com">Accounts & CEO · office@manemaisonbeauty.com</a></div><small>www.manemaisonbeauty.com</small></div></footer>`,
  );
  const nv = $("#nav"),
    pl = $(".pill", nv),
    on = $("a.on", nv),
    set = (x, w) => {
      pl.style.setProperty("--x", x + "px");
      pl.style.setProperty("--w", w + "px");
    },
    go = () => {
      if (on) {
        set(on.offsetLeft, on.offsetWidth);
        sessionStorage.pill = JSON.stringify([on.offsetLeft, on.offsetWidth]);
      }
    };
  const p = JSON.parse(sessionStorage.pill || "null");
  if (p) {
    pl.style.transition = "none";
    set(...p);
    pl.offsetWidth;
    pl.style.transition = "";
  }
  requestAnimationFrame(go);
  addEventListener("load", go);
  addEventListener("resize", go);
  cart.set(cart.get());
  wish.set(wish.get());
  $("#cb").onclick = () => drawer(1);
  $("#ov").onclick = () => drawer(0);
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-add]");
    if (a) {
      const c = cart.get(),
        i = c.find((x) => x.id == a.dataset.add);
      i ? i.q++ : c.push({ id: pid(a.dataset.add), q: 1 });
      cart.set(c);
      toast("Added to your bag");
    }
    const h = e.target.closest("[data-wish]");
    if (h) {
      const id = pid(h.dataset.wish),
        w = wish.get(),
        i = w.map(String).indexOf(String(id));
      i < 0 ? w.push(id) : w.splice(i, 1);
      wish.set(w);
      toast(i < 0 ? "Saved to your wishlist" : "Removed from your wishlist");
    }
  });
}
async function drawer(o) {
  const d = $("#drawer");
  d.classList.toggle("o", !!o);
  $("#ov").classList.toggle("o", !!o);
  if (!o) return;
  const P = await db.get("products"),
    c = cart.get().filter((i) => P.find((p) => p.id == i.id)),
    pr = (i) => P.find((p) => p.id == i.id),
    sub = c.reduce((a, i) => a + i.q * pr(i).price, 0);
  let adj = { disc: 0, promo: null, gift: 0, card: null, total: sub, due: sub };
  d.innerHTML = `<div class="dh"><h2>Your bag</h2><button class="ghost" id="x">Close</button></div>${
    c
      .map(
        (i) =>
          `<div class="line"><span>${esc(pr(i).name)}<br><small>${money(pr(i).price)}</small></span><div><button data-q="${i.id}:-1" aria-label="Fewer">−</button> ${i.q} <button data-q="${i.id}:1" aria-label="More">+</button> <button class="ghost" data-rm="${i.id}">Remove</button></div></div>`,
      )
      .join("") || "<p>Your bag is empty. Browse the shop to add something.</p>"
  }${
    c.length
      ? `<p><button class="ghost" id="clr">Clear bag</button></p><div class="g2 codes"><input id="dc" placeholder="Discount code" autocomplete="off"><input id="gc" placeholder="Gift card code" autocomplete="off"></div><p><button type="button" class="ghost" id="ap">Apply codes</button></p><div class="sumbox" id="sumbox"></div><form id="co"><input name="n" placeholder="Full name" required><input name="p" type="tel" placeholder="Phone" required><input name="e" type="email" placeholder="Email" required><textarea name="a" placeholder="Delivery address" required></textarea><fieldset class="pay"><legend>Payment method</legend><label><input type="radio" name="m" value="online" checked> Card or Mobile Money (online)</label><label><input type="radio" name="m" value="momo"> Send Mobile Money to ${CFG.MOMO}</label><label><input type="radio" name="m" value="cod"> Pay on delivery</label></fieldset><input name="t" id="txn" placeholder="Mobile Money transaction ID" hidden><button>Place order</button></form>`
      : ""
  }`;
  $("#x").onclick = () => drawer(0);
  $$("[data-q]", d).forEach(
    (b) =>
      (b.onclick = () => {
        const [id, n] = b.dataset.q.split(":"),
          k = cart.get(),
          i = k.find((x) => x.id == id);
        i.q += +n;
        cart.set(k.filter((x) => x.q > 0));
        drawer(1);
      }),
  );
  $$("[data-rm]", d).forEach(
    (b) =>
      (b.onclick = () => {
        cart.set(cart.get().filter((x) => x.id != b.dataset.rm));
        toast("Item removed");
        drawer(1);
      }),
  );
  const cl = $("#clr");
  if (cl)
    cl.onclick = () => {
      cart.set([]);
      toast("Bag cleared");
      drawer(1);
    };
  const f = $("#co");
  if (!f) return;
  const row = (l, v, cls) =>
      `<div class="line${cls ? " " + cls : ""}"><span>${l}</span><b>${v}</b></div>`,
    show = () => {
      $("#sumbox").innerHTML =
        row("Subtotal", money(sub)) +
        (adj.promo
          ? row("Discount (" + adj.promo.code + ")", "−" + money(adj.disc))
          : "") +
        (adj.card
          ? row("Gift card (" + adj.card.code + ")", "−" + money(adj.gift))
          : "") +
        row("To pay", money(adj.due), "big");
    },
    calc = async () => {
      const a = await checkPromo($("#dc").value, sub, "shop");
      if (a.error) return (toast(a.error), null);
      const total = money2(sub - a.amount),
        g = await checkGift($("#gc").value, total);
      if (g.error) return (toast(g.error), null);
      adj = {
        disc: a.amount,
        promo: a.promo || null,
        gift: g.amount,
        card: g.card || null,
        total,
        due: money2(total - g.amount),
      };
      show();
      return adj;
    };
  show();
  $("#ap").onclick = async () => {
    if (await calc()) toast("Codes applied");
  };
  $$("[name=m]", f).forEach(
    (r) =>
      (r.onchange = () => {
        $("#txn").hidden = f.elements.m.value != "momo";
      }),
  );
  f.onsubmit = async (e) => {
    e.preventDefault();
    const a = await calc();
    if (!a) return;
    const v = Object.fromEntries(new FormData(f));
    const finish = async (method, status, ref) => {
      const O = await db.get("orders"),
        no = nextRef(O, "MM-");
      c.forEach((i) => {
        const p = pr(i);
        p.stock = Math.max(0, p.stock - i.q);
      });
      const now = new Date().toISOString();
      O.push({
        id: Date.now(),
        ref: no,
        date: day(0),
        name: v.n,
        phone: v.p,
        email: v.e,
        address: v.a,
        subtotal: sub,
        discount: a.promo ? { code: a.promo.code, amount: a.disc } : null,
        gift: a.card ? { code: a.card.code, amount: a.gift } : null,
        total: a.total,
        payable: a.due,
        status: "Pending",
        history: [{ ts: now, status: "Pending" }],
        items: c,
        pay: { method, status, ref },
      });
      await db.put("orders", O);
      await db.put("products", P);
      await useCodes(a.promo, a.card, a.gift, no);
      const units = c.reduce((x, i) => x + i.q, 0);
      await logEvent(
        "Customer",
        "Placed",
        "Order",
        no + " · " + v.n,
        `${money(a.total)} · ${units} items`,
      );
      await notify(
        "order",
        `New order ${no} from ${v.n} · ${money(a.total)}`,
        "admin-orders.html",
      );
      for (const p of P.filter(
        (p) => c.some((i) => i.id == p.id) && p.stock <= (p.threshold || 5),
      ))
        await notify(
          "stock",
          `Low stock: ${p.name} (${p.stock} left)`,
          "admin-inventory.html",
        );
      const byCat = {};
      c.forEach((i) => {
        const p = pr(i);
        (byCat[p.cat] = byCat[p.cat] || []).push({ p, q: i.q });
      });
      let n = 0;
      const lines = Object.entries(byCat)
        .map(
          ([k, list]) =>
            `*${k}*\n${list.map(({ p, q }) => `${++n}. ${p.name} × ${q} — ${money(p.price * q)}`).join("\n")}`,
        )
        .join("\n\n");
      const pm = {
        online: "Card / Mobile Money (online)",
        momo: "Mobile Money transfer",
        cod: "Pay on delivery",
        gift: "Gift card",
      }[method];
      const msg = `*Mane Maison Store*\n*New Order* ${no}\n\n${lines}\n\n*Total items: ${units}*\nSubtotal: ${money(sub)}\n${a.promo ? `Discount (${a.promo.code}): -${money(a.disc)}\n` : ""}${a.card ? `Gift card (${a.card.code}): -${money(a.gift)}\n` : ""}*Total: ${money(a.total)}*\n*To pay: ${money(a.due)}*\nPayment: ${pm} (${status}${ref ? ", ref " + ref : ""})\nName: ${v.n}\nPhone: ${v.p}\nAddress: ${v.a}\nTrack: ${trackUrl()}`;
      wa(msg);
      cart.set([]);
      d.innerHTML = `<div class="dh"><h2>Thank you!</h2><button class="ghost" id="x2">Close</button></div><div class="sumbox"><p>Your order number is</p><p class="serif" style="font-size:2.4rem">${esc(no)}</p><p>Keep it to check your order status any time.</p></div><p><a class="btn" href="track.html">Track my order</a></p><p><button class="ghost" id="ws">Send details on WhatsApp</button></p>`;
      $("#x2").onclick = () => drawer(0);
      $("#ws").onclick = () => wa(msg);
    };
    if (a.due == 0) return finish("gift", "Paid by gift card", a.card ? a.card.code : "");
    if (v.m == "online") {
      if (!CFG.PAYSTACK_KEY)
        return toast(
          "Online payment is not connected yet. Choose Mobile Money or Pay on delivery.",
        );
      await loadPaystack();
      PaystackPop.setup({
        key: CFG.PAYSTACK_KEY,
        email: v.e,
        amount: Math.round(a.due * 100),
        currency: "GHS",
        callback: (r) => {
          finish("online", "Paid online", r.reference);
        },
        onClose: () => toast("Payment cancelled"),
      }).openIframe();
      return;
    }
    if (v.m == "momo") {
      if (!v.t) {
        $("#txn").hidden = false;
        return toast("Enter your Mobile Money transaction ID");
      }
      return finish("momo", "Awaiting confirmation", v.t);
    }
    finish("cod", "Pay on delivery", "");
  };
}
const nice = (s) => {
  const d = new Date(s + "T12:00"),
    n = d.getDate(),
    x =
      n % 10 == 1 && n != 11
        ? "st"
        : n % 10 == 2 && n != 12
          ? "nd"
          : n % 10 == 3 && n != 13
            ? "rd"
            : "th";
  return (
    n + x + " " + d.toLocaleString("en-GB", { month: "long" }) + ", " + d.getFullYear()
  );
};
/* One tap: WhatsApp chat + email to bookings@ (cc office@). With CFG.API set, your server sends the email instead (POST /notify). */
function notifyBooking(msg) {
  wa(msg);
  if (CFG.API) {
    fetch(CFG.API + "/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "booking",
        to: [CFG.MAIL.to, CFG.MAIL.cc],
        subject: "Booking request: Mane Maison Studio",
        message: msg,
      }),
    });
    return;
  }
  const a = document.createElement("a");
  a.href =
    "mailto:" +
    CFG.MAIL.to +
    "?cc=" +
    CFG.MAIL.cc +
    "&subject=" +
    encodeURIComponent("Booking request: Mane Maison Studio") +
    "&body=" +
    encodeURIComponent(msg.replace(/\*/g, ""));
  document.body.appendChild(a);
  a.click();
  a.remove();
}
async function getSettings() {
  let S = await db.get("settings");
  return Array.isArray(S) ? {} : S;
}
async function applyLogo() {
  const S = await getSettings(),
    u = S.logo || "logo.jpg";
  $$("img[data-logo]").forEach((i) => {
    i.src = u;
  });
  const f = $("link[rel=icon]");
  if (f) f.href = u;
}
async function logoTools() {
  const S = await getSettings();
  const save = async (u) => {
    S.logo = u;
    await db.put("settings", S);
    applyLogo();
    $("#lp").src = u;
    toast("Logo updated");
  };
  $("#lp").src = S.logo || "logo.jpg";
  $("#lu").value = S.logo && !S.logo.startsWith("data:") ? S.logo : "logo.jpg";
  $("#lf").onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 800 / Math.max(img.width, img.height)),
        c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      save(c.toDataURL(f.type == "image/png" ? "image/png" : "image/jpeg", 0.88));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(f);
  };
  $("#ls").onclick = () => save($("#lu").value.trim() || "logo.jpg");
  $("#lr").onclick = () => save("logo.jpg");
}
const pages = {
  async index() {
    const g = $("#svcgrid");
    if (g)
      g.innerHTML = SERVICES.map(
        ([c, items], ci) =>
          `<a class="prod" href="bookings.html"><div class="art has" style="--h:${(ci * 53) % 360}">${esc(c[0])}<em>${items.length} services</em><img src="${esc(imgSrc(c, "cat-" + slug(c) + ".jpg"))}" alt="${esc(c)}" loading="lazy" onerror="imgNext(this)"></div><b>${esc(c)}</b></a>`,
      ).join("");
    const P = (await db.get("products"))
      .filter((p) => p.active !== false)
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 4);
    $("#feat").innerHTML = P.map(card).join("");
  },
  async shop() {
    const P = (await db.get("products")).filter((p) => p.active !== false),
      cats = ["All", ...new Set(P.map((p) => p.cat))],
      r = (c) => {
        $("#grid").innerHTML = P.filter((p) => c == "All" || p.cat == c)
          .map(card)
          .join("");
        $$(".chips button").forEach((b) => b.classList.toggle("on", b.textContent == c));
      };
    $(".chips").innerHTML = cats.map((c) => `<button>${c}</button>`).join("");
    $$(".chips button").forEach((b) => (b.onclick = () => r(b.textContent)));
    r("All");
  },
  async bookings() {
    const [B, S0] = await Promise.all([db.get("bookings"), getSettings()]),
      S = studioCfg(S0),
      sty = S.stylists.filter((x) => x.active !== false),
      dt = $("#dt");
    let pick = null,
      adj = null;
    $("#sty").innerHTML =
      `<option value="any">Any available stylist</option>` +
      sty.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("");
    $("#svc").innerHTML = SERVICES.map(
      ([c, items], ci) =>
        `<details class="cat"${ci == 0 ? " open" : ""}><summary><span class="ci">${esc(c[0])}<img src="${esc(imgSrc(c, "cat-" + slug(c) + ".jpg"))}" alt="" loading="lazy" onerror="imgNext(this)"></span><b>${esc(c)}</b><em class="cnt"></em></summary><div class="opts"><label class="all"><input type="checkbox" data-all="${ci}"> <span>Select all</span></label>${items.map(([x, pr, mn]) => `<label><input type="checkbox" data-cat="${ci}" data-p="${pr == null ? "" : pr}" data-m="${mn}" value="${esc(x)}"> <span>${esc(x)}<small> · ${durTxt(mn)}</small></span><b class="pr">${priceTxt(pr)}</b></label>`).join("")}</div></details>`,
    ).join("");
    const sum = () => {
      const all = $$("#svc input[data-cat]:checked");
      let tot = 0,
        ask = 0,
        mins = 0;
      all.forEach((i) => {
        mins += +i.dataset.m;
        i.dataset.p === "" ? ask++ : (tot += +i.dataset.p);
      });
      return { n: all.length, tot, ask, mins };
    };
    const slots = () => {
      const date = dt.value,
        mins = sum().mins || S.slot,
        out = [];
      if (
        S.closedDays.includes(new Date(date + "T12:00").getDay()) ||
        S.closedDates.includes(date)
      )
        return { closed: true, out };
      const want =
          $("#sty").value == "any" ? sty : sty.filter((x) => x.id == $("#sty").value),
        now = new Date(),
        nowM = now.getHours() * 60 + now.getMinutes();
      for (let m = toMin(S.open); m + mins <= toMin(S.close); m += S.slot) {
        if (date == day(0) && m <= nowM) continue;
        const free = want.filter(
          (x) =>
            !B.some(
              (b) =>
                (b.status || "Pending") != "Cancelled" &&
                b.date == date &&
                String(b.stylistId || sty[0].id) == String(x.id) &&
                m < toMin(b.time) + (b.mins || S.slot) &&
                toMin(b.time) < m + mins,
            ),
        );
        out.push({ time: fmtMin(m), free });
      }
      return { out };
    };
    const draw = () => {
      const prev = pick && pick.time,
        r = slots();
      pick = null;
      $("#sl").innerHTML = r.closed
        ? `<p class="meta full">The studio is closed on this day. Please choose another date.</p>`
        : r.out.length
          ? r.out
              .map(
                (x, i) =>
                  `<button type="button" data-i="${i}" ${x.free.length ? "" : "disabled"}>${x.time}</button>`,
              )
              .join("")
          : `<p class="meta full">No time is long enough for these services on this day. Try another date or fewer services.</p>`;
      $$("#sl button").forEach(
        (b) =>
          (b.onclick = () => {
            pick = r.out[+b.dataset.i];
            $$("#sl button").forEach((x) => x.classList.toggle("on", x == b));
          }),
      );
      if (prev) {
        const again = $$("#sl button").find((b) => b.textContent == prev && !b.disabled);
        if (again) again.click();
      }
    };
    const calc = async () => {
      const s = sum(),
        a = await checkPromo($("#dc").value, s.tot, "studio");
      if (a.error) return { error: a.error };
      const total = money2(s.tot - a.amount),
        g = await checkGift($("#gc").value, total);
      if (g.error) return { error: g.error };
      const full = S.deposit.on
          ? money2(
              S.deposit.type == "percent"
                ? (total * S.deposit.value) / 100
                : Math.min(S.deposit.value, total),
            )
          : 0,
        dep = Math.max(0, money2(full - g.amount));
      return {
        s,
        sub: s.tot,
        disc: a.amount,
        promo: a.promo || null,
        total,
        gift: g.amount,
        card: g.card || null,
        full,
        dep,
        balance: money2(total - g.amount - dep),
      };
    };
    const bill = async () => {
      adj = await calc();
      const box = $("#bill"),
        fs = $("#depay");
      if (adj.error) {
        box.innerHTML = `<p class="meta">${esc(adj.error)}</p>`;
        fs.hidden = true;
        return;
      }
      const row = (l, v, cls) =>
        `<div class="line${cls ? " " + cls : ""}"><span>${l}</span><b>${v}</b></div>`;
      box.innerHTML = adj.s.n
        ? row("Services", money(adj.sub)) +
          (adj.promo
            ? row("Discount (" + adj.promo.code + ")", "−" + money(adj.disc))
            : "") +
          row("Total", money(adj.total)) +
          (adj.card
            ? row("Gift card (" + adj.card.code + ")", "−" + money(adj.gift))
            : "") +
          (adj.full ? row("Deposit to hold your slot", money(adj.dep), "big") : "") +
          (adj.full ? row("Balance at the studio", money(adj.balance)) : "")
        : "";
      fs.hidden = !(adj.dep > 0);
      if (!fs.hidden && S.deposit.note) $("#depnote").textContent = S.deposit.note;
    };
    const upd = () => {
      $$("#svc .cnt").forEach((el, i) => {
        const boxes = $$(`#svc input[data-cat="${i}"]`),
          n = boxes.filter((x) => x.checked).length,
          a = $(`#svc [data-all="${i}"]`);
        el.textContent = n;
        el.classList.toggle("on", n > 0);
        a.checked = n == boxes.length;
        a.indeterminate = n > 0 && n < boxes.length;
      });
      const s = sum();
      $("#sel").textContent = s.n
        ? `${s.n} ${s.n > 1 ? "services" : "service"} · ${durTxt(s.mins)} · Total ${money(s.tot)}${s.ask ? ` + ${s.ask} on request` : ""}`
        : "";
      draw();
      bill();
    };
    $("#svc").onchange = (e) => {
      const a = e.target.dataset.all;
      if (a != null)
        $$(`#svc input[data-cat="${a}"]`).forEach((i) => (i.checked = e.target.checked));
      upd();
    };
    $("#sty").onchange = draw;
    $("#ap").onclick = async () => {
      await bill();
      toast(adj.error || "Codes applied");
    };
    const ml = $("[name=m][value=momo]");
    if (ml) ml.nextSibling.textContent = " Send Mobile Money to " + CFG.MOMO;
    $$("[name=m]").forEach(
      (r) =>
        (r.onchange = () => {
          $("#btx").hidden = $("#bf").elements.m.value != "momo";
        }),
    );
    dt.min = dt.value = day(0);
    dt.onchange = draw;
    draw();
    bill();
    $("#bf").onsubmit = async (e) => {
      e.preventDefault();
      const grp = SERVICES.map(([c], ci) => [
        c,
        $$(`#svc input[data-cat="${ci}"]:checked`).map((i) => ({
          name: i.value,
          price: i.dataset.p === "" ? null : +i.dataset.p,
        })),
      ]).filter((g) => g[1].length);
      if (!grp.length) return toast("Select at least one service");
      if (!pick) return toast("Pick a time slot first");
      const a = await calc();
      if (a.error) return toast(a.error);
      const v = Object.fromEntries(new FormData(e.target)),
        st = pick.free[0],
        s = a.s,
        finish = async (method, status, ref) => {
          const no = nextRef(B, "BK-");
          let n = 0;
          const lines = grp
              .map(
                ([c, items]) =>
                  `*${c}*\n${items.map((x) => `${++n}. ${x.name} — ${priceTxt(x.price)}`).join("\n")}`,
              )
              .join("\n\n"),
            depLine = a.full
              ? `Deposit: ${money(a.full)} (${status}${ref ? ", ref " + ref : ""})\nBalance at studio: ${money(a.balance)}\n`
              : "",
            msg = `*Mane Maison Studio*\n*Studio Booking Request* ${no}\n\n${lines}\n\n*Total items: ${s.n}*\nServices: ${money(a.sub)}\n${a.promo ? `Discount (${a.promo.code}): -${money(a.disc)}\n` : ""}${a.card ? `Gift card (${a.card.code}): -${money(a.gift)}\n` : ""}*Total: ${money(a.total)}*\n${depLine}\nDate: ${nice(dt.value)}\nTime: ${pick.time} (${durTxt(s.mins || S.slot)})\nStylist: ${st.name}\nClient: ${v.n}\nContact: ${v.p}\nTrack: ${trackUrl()}`;
          notifyBooking(msg);
          B.push({
            id: Date.now(),
            ref: no,
            date: dt.value,
            time: pick.time,
            mins: s.mins || S.slot,
            stylistId: st.id,
            stylist: st.name,
            service: grp
              .map(([c, items]) => c + ": " + items.map((x) => x.name).join(", "))
              .join(" | "),
            services: Object.fromEntries(grp),
            count: s.n,
            subtotal: a.sub,
            discount: a.promo ? { code: a.promo.code, amount: a.disc } : null,
            giftUsed: a.gift,
            total: a.total,
            deposit: {
              required: a.full,
              amount: a.dep,
              status: a.full ? status : "Not required",
              method,
              ref,
            },
            status: "Pending",
            name: v.n,
            phone: v.p,
            email: v.e || "",
          });
          await db.put("bookings", B);
          await useCodes(a.promo, a.card, a.gift, no);
          await logEvent(
            "Customer",
            "Requested",
            "Booking",
            no + " · " + v.n,
            `${nice(dt.value)} ${pick.time} · ${s.n} services · ${money(a.total)}`,
          );
          await notify(
            "booking",
            `New booking ${no}: ${v.n} · ${nice(dt.value)} at ${pick.time}`,
            "admin-bookings.html",
          );
          $("#done").hidden = false;
          $("#done").innerHTML =
            `<p>Booking received. Your booking number is</p><p class="serif" style="font-size:2.4rem">${esc(no)}</p><p>${nice(dt.value)} at ${pick.time} with ${esc(st.name)}.</p><p><a class="btn" href="track.html">Track my booking</a> <button type="button" class="ghost" id="ws">Send details on WhatsApp</button></p>`;
          $("#ws").onclick = () => wa(msg);
          toast("Booking sent");
          $$("#svc input").forEach((i) => (i.checked = false));
          e.target.elements.n.value = e.target.elements.p.value = "";
          upd();
          $("#done").scrollIntoView({ behavior: "smooth" });
        };
      if (a.full && a.dep == 0)
        return finish("gift", "Paid by gift card", a.card ? a.card.code : "");
      if (!a.full) return finish("none", "Not required", "");
      if (v.m == "online") {
        if (!CFG.PAYSTACK_KEY)
          return toast("Online payment is not connected yet. Choose Mobile Money.");
        if (!v.e) return toast("Enter your email to pay online");
        await loadPaystack();
        PaystackPop.setup({
          key: CFG.PAYSTACK_KEY,
          email: v.e,
          amount: Math.round(a.dep * 100),
          currency: "GHS",
          callback: (r) => {
            finish("online", "Paid online", r.reference);
          },
          onClose: () => toast("Payment cancelled"),
        }).openIframe();
        return;
      }
      if (!v.t) {
        $("#btx").hidden = false;
        return toast("Enter your Mobile Money transaction ID");
      }
      finish("momo", "Awaiting confirmation", v.t);
    };
  },
  contact() {
    $("#mf").onsubmit = async (e) => {
      e.preventDefault();
      const M = await db.get("messages");
      M.push({ ...Object.fromEntries(new FormData(e.target)), date: day(0) });
      await db.put("messages", M);
      e.target.reset();
      toast("Message sent. We will reply soon.");
    };
  },
};
shell();
applyLogo();
pages[document.body.dataset.page]?.();
