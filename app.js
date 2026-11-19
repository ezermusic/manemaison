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
const SERVICES = [
  [
    "Hair Styling",
    [
      ["Wash and blow-dry", 80],
      ["Silk press and flat ironing", 250],
      ["Curls, waves and heat styling", 150],
      ["Updos, bridal and event styling", 300],
      ["Braids and plaits (cornrows, box braids, knotless braids, twists)", 400],
      ["Ponytails, buns and sleek styles", 120],
      ["Extension styling and installs (sew-in, clip-in, tape-in)", 350],
    ],
  ],
  [
    "Hair Color",
    [
      ["Full color and root touch-up", 450],
      ["Highlights, lowlights and balayage", 700],
      ["Ombré and fashion colors", 600],
      ["Gray coverage", 350],
      ["Toning and color correction", 400],
    ],
  ],
  [
    "Hair Treatments & Care",
    [
      ["Deep conditioning", 180],
      ["Protein and moisture treatments", 200],
      ["Scalp treatment and scalp massage", 150],
      ["Hair steaming", 120],
      ["Keratin and smoothing treatments", 600],
      ["Dandruff and hair-loss care", 250],
      ["Trim and split-end removal", 80],
    ],
  ],
  [
    "Cutting & Shaping",
    [
      ["Women's and men's cuts", 100],
      ["Children's cuts", 60],
      ["Fringe/bang trims", 40],
      ["Beard trim and shaping", 50],
    ],
  ],
  [
    "Wig Services",
    [
      ["Wig installation (lace front, closure, full lace)", 350],
      ["Custom wig making", 800],
      ["Wig revamping and restoration", 300],
      ["Professional wig coloring and toning", 500],
      ["Wig styling (curl, straighten, cut, bleach knots, pluck hairline)", 250],
      ["Wig washing and maintenance", 120],
      ["Wig consultation and fitting", 50],
    ],
  ],
  [
    "Hair Removal",
    [
      ["Waxing (brows, lip, face, underarms, legs, bikini)", 120],
      ["Threading", 60],
      ["Sugaring", 130],
    ],
  ],
  [
    "Nails",
    [
      ["Manicure and pedicure", 180],
      ["Gel polish and acrylics", 250],
      ["Nail extensions and nail art", 300],
      ["Nail repair and removal", 80],
    ],
  ],
  [
    "Skin Care",
    [
      ["Facials (cleansing, hydrating, anti-aging, acne)", 300],
      ["Exfoliation and deep-cleansing treatments", 250],
      ["Chemical peels and dermaplaning", 400],
      ["Back and body facials", 350],
    ],
  ],
  [
    "Brows & Lashes",
    [
      ["Eyebrow shaping, tinting and lamination", 100],
      ["Microblading", 800],
      ["Lash lifts and tints", 250],
      ["Eyelash extensions (classic, hybrid, volume)", 350],
    ],
  ],
  [
    "Makeup",
    [
      ["Everyday and event makeup", 250],
      ["Bridal makeup and trials", 800],
      ["Makeup lessons", 400],
      ["Airbrush makeup", 500],
    ],
  ],
  [
    "Body & Wellness",
    [
      ["Massage (relaxation, deep tissue)", 300],
      ["Body scrubs and wraps", 350],
      ["Spray tanning", 200],
      ["Aromatherapy", 250],
    ],
  ],
  [
    "Bridal & Event Packages",
    [
      ["Bridal hair and makeup", 1500],
      ["Bridesmaid and mother-of-the-bride packages", 700],
      ["Prom, graduation and photoshoot styling", 500],
      ["On-location or mobile services", 400],
    ],
  ],
  [
    "Men's Grooming",
    [
      ["Haircuts and fades", 60],
      ["Hot-towel shave", 70],
      ["Beard treatments", 90],
      ["Facials for men", 200],
    ],
  ],
  [
    "Consultations & Add-ons",
    [
      ["Hair or beauty consultation", 0],
      ["Aftercare advice", 0],
      ["Gift card or membership enquiry", null],
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
const card = (p) =>
  `<div class="prod">${art(p)}<b>${esc(p.name)}</b><div class="row"><span>${money(p.price)}</span><button data-add="${p.id}" ${p.stock < 1 ? "disabled" : ""}>${p.stock < 1 ? "Sold out" : "Add"}</button></div><small>${p.stock < 1 ? "" : p.stock <= 5 ? "Only " + p.stock + " left" : "In stock"}</small></div>`;
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
function shell() {
  const cur = document.body.dataset.page,
    ceo = sessionStorage.mm_ceo,
    L = [
      ["index", "Home"],
      ["shop", "Shop"],
      ["bookings", "Book"],
      ["about", "About"],
      ["contact", "Contact"],
      ...(ceo ? [["dashboard", "CEO"]] : []),
    ];
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<header class="top"><a class="brand" href="index.html">${mono}<span class="serif">Mane Maison</span></a><button class="cartbtn" id="cb">Bag <b id="cc">0</b></button></header><nav id="nav" aria-label="Main"><i class="pill"></i>${L.map(([h, t]) => `<a href="${h}.html"${h == cur ? ' class="on" aria-current="page"' : ""}>${t}</a>`).join("")}</nav><div id="ov"></div><aside id="drawer" aria-label="Bag"></aside><div id="toast" role="status"></div>`,
  );
  const soc = [
    ["wa", "WhatsApp", "https://wa.me/" + CFG.WA],
    ["ig", "Instagram", CFG.SOCIAL.ig],
    ["fb", "Facebook", CFG.SOCIAL.fb],
    ["tt", "TikTok", CFG.SOCIAL.tt],
  ];
  document.body.insertAdjacentHTML(
    "beforeend",
    `<footer><div class="wrap"><div class="serif" style="font-size:2rem">for the love of beauty</div><div class="soc">${soc.map((x) => `<a href="${x[2]}" target="_blank" rel="noopener" aria-label="${x[1]}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${ICON[x[0]]}</svg></a>`).join("")}</div><div><a href="tel:0537751108">Call / WhatsApp 0537751108</a><a href="mailto:orders@manemaisonbeauty.com">Wig store · orders@manemaisonbeauty.com</a><a href="mailto:bookings@manemaisonbeauty.com">Hair studio · bookings@manemaisonbeauty.com</a><a href="mailto:office@manemaisonbeauty.com">Accounts & CEO · office@manemaisonbeauty.com</a></div><small>www.manemaisonbeauty.com · <a href="dashboard.html" style="display:inline;opacity:.5">Staff</a></small></div></footer>`,
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
  $("#cb").onclick = () => drawer(1);
  $("#ov").onclick = () => drawer(0);
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-add]");
    if (a) {
      const c = cart.get(),
        i = c.find((x) => x.id == a.dataset.add);
      i ? i.q++ : c.push({ id: +a.dataset.add, q: 1 });
      cart.set(c);
      toast("Added to your bag");
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
    tot = c.reduce((a, i) => a + i.q * P.find((p) => p.id == i.id).price, 0);
  d.innerHTML = `<div class="dh"><h2>Your bag</h2><button class="ghost" id="x">Close</button></div>${
    c
      .map((i) => {
        const p = P.find((p) => p.id == i.id);
        return `<div class="line"><span>${esc(p.name)}<br><small>${money(p.price)}</small></span><div><button data-q="${i.id}:-1" aria-label="Fewer">−</button> ${i.q} <button data-q="${i.id}:1" aria-label="More">+</button> <button class="ghost" data-rm="${i.id}">Remove</button></div></div>`;
      })
      .join("") || "<p>Your bag is empty. Browse the shop to add something.</p>"
  }${c.length ? `<p><button class="ghost" id="clr">Clear bag</button></p><p class="serif tot">Total ${money(tot)}</p><form id="co"><input name="n" placeholder="Full name" required><input name="p" type="tel" placeholder="Phone" required><input name="e" type="email" placeholder="Email" required><textarea name="a" placeholder="Delivery address" required></textarea><fieldset class="pay"><legend>Payment method</legend><label><input type="radio" name="m" value="online" checked> Card or Mobile Money (online)</label><label><input type="radio" name="m" value="momo"> Send Mobile Money to ${CFG.MOMO}</label><label><input type="radio" name="m" value="cod"> Pay on delivery</label></fieldset><input name="t" id="txn" placeholder="Mobile Money transaction ID" hidden><button>Place order</button></form>` : ""}`;
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
  $$("[name=m]", f).forEach(
    (r) =>
      (r.onchange = () => {
        $("#txn").hidden = f.m.value != "momo";
      }),
  );
  f.onsubmit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    const finish = async (status, ref) => {
      const O = await db.get("orders");
      c.forEach((i) => {
        const p = P.find((p) => p.id == i.id);
        p.stock = Math.max(0, p.stock - i.q);
      });
      O.push({
        id: Date.now(),
        date: day(0),
        name: v.n,
        phone: v.p,
        email: v.e,
        address: v.a,
        total: tot,
        status: "Pending",
        items: c,
        pay: { method: v.m, status, ref },
      });
      await db.put("orders", O);
      await db.put("products", P);
      const byCat = {};
      c.forEach((i) => {
        const p = P.find((p) => p.id == i.id);
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
      }[v.m];
      wa(
        `*Mane Maison Store*\n*New Order*\n\n${lines}\n\n*Total items: ${c.reduce((a, i) => a + i.q, 0)}*\n*Total: ${money(tot)}*\nPayment: ${pm} (${status}${ref ? ", ref " + ref : ""})\nName: ${v.n}\nPhone: ${v.p}\nAddress: ${v.a}`,
      );
      cart.set([]);
      drawer(0);
      toast("Order placed. We will confirm shortly.");
    };
    if (v.m == "online") {
      if (!CFG.PAYSTACK_KEY)
        return toast(
          "Online payment is not connected yet. Choose Mobile Money or Pay on delivery.",
        );
      await loadPaystack();
      PaystackPop.setup({
        key: CFG.PAYSTACK_KEY,
        email: v.e,
        amount: tot * 100,
        currency: "GHS",
        callback: (r) => {
          finish("Paid online", r.reference);
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
      return finish("Awaiting confirmation", v.t);
    }
    finish("Pay on delivery", "");
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
    const P = (await db.get("products")).sort((a, b) => b.sold - a.sold).slice(0, 4);
    $("#feat").innerHTML = P.map(card).join("");
  },
  async shop() {
    const P = await db.get("products"),
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
    const B = await db.get("bookings");
    let t = "";
    $("#svc").innerHTML = SERVICES.map(
      ([c, items], ci) =>
        `<details class="cat"${ci == 0 ? " open" : ""}><summary><span class="ci">${esc(c[0])}<img src="${esc(imgSrc(c, "cat-" + slug(c) + ".jpg"))}" alt="" loading="lazy" onerror="imgNext(this)"></span><b>${esc(c)}</b><em class="cnt"></em></summary><div class="opts"><label class="all"><input type="checkbox" data-all="${ci}"> <span>Select all</span></label>${items.map(([x, pr]) => `<label><input type="checkbox" data-cat="${ci}" data-p="${pr == null ? "" : pr}" value="${esc(x)}"> <span>${esc(x)}</span><b class="pr">${priceTxt(pr)}</b></label>`).join("")}</div></details>`,
    ).join("");
    const sum = () => {
      const all = $$("#svc input[data-cat]:checked");
      let tot = 0,
        ask = 0;
      all.forEach((i) => (i.dataset.p === "" ? ask++ : (tot += +i.dataset.p)));
      return { n: all.length, tot, ask };
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
        ? `${s.n} ${s.n > 1 ? "services" : "service"} · Total ${money(s.tot)}${s.ask ? ` + ${s.ask} on request` : ""}`
        : "";
    };
    $("#svc").onchange = (e) => {
      const a = e.target.dataset.all;
      if (a != null)
        $$(`#svc input[data-cat="${a}"]`).forEach((i) => (i.checked = e.target.checked));
      upd();
    };
    const dt = $("#dt");
    dt.min = dt.value = day(0);
    const draw = () => {
      const taken = B.filter((b) => b.date == dt.value).map((b) => b.time);
      t = "";
      $("#sl").innerHTML = [9, 10, 11, 12, 13, 14, 15, 16, 17]
        .map((h) => {
          const k = (h < 10 ? "0" : "") + h + ":00";
          return `<button type="button" ${taken.includes(k) ? "disabled" : ""}>${k}</button>`;
        })
        .join("");
      $$("#sl button").forEach(
        (b) =>
          (b.onclick = () => {
            t = b.textContent;
            $$("#sl button").forEach((x) => x.classList.toggle("on", x == b));
          }),
      );
    };
    dt.onchange = draw;
    draw();
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
      if (!t) return toast("Pick a time slot first");
      const v = Object.fromEntries(new FormData(e.target));
      const s = sum();
      let n = 0;
      const lines = grp
        .map(
          ([c, items]) =>
            `*${c}*\n${items.map((x) => `${++n}. ${x.name} — ${priceTxt(x.price)}`).join("\n")}`,
        )
        .join("\n\n");
      const msg = `*Mane Maison Studio*\n*Studio Booking Request*\n\n${lines}\n\n*Total items: ${s.n}*\n*Total: ${money(s.tot)}*${s.ask ? ` (+ ${s.ask} priced on request)` : ""}\n\nDate: ${nice(dt.value)}\nTime: ${t}\nClient: ${v.n}\nContact: ${v.p}`;
      notifyBooking(msg);
      B.push({
        id: Date.now(),
        date: dt.value,
        time: t,
        service: grp
          .map(([c, items]) => c + ": " + items.map((x) => x.name).join(", "))
          .join(" | "),
        services: Object.fromEntries(grp),
        count: s.n,
        total: s.tot,
        name: v.n,
        phone: v.p,
      });
      await db.put("bookings", B);
      toast("Booking sent to WhatsApp and email");
      $$("#svc input").forEach((i) => (i.checked = false));
      e.target.n.value = e.target.p.value = "";
      upd();
      draw();
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
  async dashboard() {
    const g = $("#gate"),
      m = $("#main"),
      pin = $("#pin"),
      btn = $("#lock");
    const open = !!sessionStorage.mm_ceo;
    pin.hidden = open;
    btn.textContent = open ? "Lock Dashboard" : "Unlock";
    g.classList.toggle("open", open);
    m.hidden = !open;
    if (open) {
      dash();
      logoTools();
    }
    g.onsubmit = (e) => {
      e.preventDefault();
      if (sessionStorage.mm_ceo) {
        sessionStorage.removeItem("mm_ceo");
        return location.reload();
      }
      if (pin.value == CFG.PIN) {
        sessionStorage.mm_ceo = 1;
        return location.reload();
      }
      toast("Incorrect passcode");
      g.classList.remove("shake");
      void g.offsetWidth;
      g.classList.add("shake");
    };
  },
};
async function dash() {
  const [P, O, B] = await Promise.all(
      ["products", "orders", "bookings"].map((c) => db.get(c)),
    ),
    rev = O.reduce((a, o) => a + o.total, 0),
    low = P.filter((p) => p.stock <= 5).length,
    up = B.filter((b) => b.date >= day(0)).length,
    cr = P.reduce((a, p) => a + p.sold * p.price, 0),
    wr = P.filter((p) => p.cat == "Wigs").reduce((a, p) => a + p.sold * p.price, 0);
  const K = [
    ["Revenue", rev, 1],
    ["Orders", O.length],
    ["Upcoming bookings", up],
    ["Low stock items", low],
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
    ["Stock health", P.filter((p) => p.stock > 5).length / P.length],
    [
      "Orders delivered",
      O.filter((o) => o.status == "Delivered").length / (O.length || 1),
    ],
    [
      "Studio utilisation",
      Math.min(1, B.filter((b) => b.date >= day(0) && b.date < day(7)).length / 63),
    ],
    ["Wig revenue share", wr / (cr || 1)],
  ];
  $("#r").innerHTML = R.map(
    (r) =>
      `<div class="ring"><svg viewBox="0 0 80 80"><circle class="bg" cx="40" cy="40" r="30"/><circle class="fg" cx="40" cy="40" r="30" data-p="${r[1]}" style="stroke-dasharray:0 189"/></svg><b>${Math.round(r[1] * 100)}%</b><small>${r[0]}</small></div>`,
  ).join("");
  const D = [...Array(7)].map((_, i) => day(i - 6)),
    V = D.map((d) => O.filter((o) => o.date == d).reduce((a, o) => a + o.total, 0)),
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
  $("#inv").innerHTML =
    `<tr><th>Product<th>Type<th>Price<th>Stock<th></tr>` +
    P.map(
      (p) =>
        `<tr><td>${esc(p.name)}<td>${esc(p.cat)}<td>${money(p.price)}<td class="${p.stock <= 5 ? "low" : ""}"><button data-s="${p.id}:-1">−</button> ${p.stock} <button data-s="${p.id}:1">+</button><td><span class="stk" style="width:${Math.min(80, p.stock * 3)}px"></span></tr>`,
    ).join("");
  $("#ord").innerHTML =
    `<tr><th>Date<th>Client<th>Total<th>Payment<th>Status</tr>` +
    O.slice()
      .reverse()
      .slice(0, 10)
      .map(
        (o) =>
          `<tr><td>${o.date}<td>${esc(o.name)}<td>${money(o.total)}<td>${esc(o.pay ? o.pay.status : "Paid")}<td><button class="ghost" data-o="${o.id}">${o.status}</button></tr>`,
      )
      .join("");
  $("#bk").innerHTML =
    `<tr><th>Date<th>Time<th>Service<th>Client<th>Total</tr>` +
    B.filter((b) => b.date >= day(0))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .map(
        (b) =>
          `<tr><td>${b.date}<td>${b.time}<td>${esc(b.service)}<td>${esc(b.name)}<td>${b.total == null ? "—" : money(b.total)}</tr>`,
      )
      .join("");
  $$("[data-s]").forEach(
    (b) =>
      (b.onclick = async () => {
        const [i, n] = b.dataset.s.split(":"),
          p = P.find((x) => x.id == i);
        p.stock = Math.max(0, p.stock + +n);
        await db.put("products", P);
        dash();
      }),
  );
  $$("[data-o]").forEach(
    (b) =>
      (b.onclick = async () => {
        const o = O.find((x) => x.id == b.dataset.o),
          S = ["Pending", "Packed", "Delivered"];
        o.status = S[(S.indexOf(o.status) + 1) % 3];
        await db.put("orders", O);
        dash();
      }),
  );
  $("#np").onsubmit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    P.push({
      id: Date.now() % 1e6,
      name: v.n,
      cat: v.c,
      price: +v.p,
      stock: +v.s,
      img: v.i || "",
      sold: 0,
    });
    await db.put("products", P);
    e.target.reset();
    dash();
    toast("Product added");
  };
}
shell();
applyLogo();
pages[document.body.dataset.page]?.();
