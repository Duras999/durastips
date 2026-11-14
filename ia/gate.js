// Portão de entrada do Palpiteiro: login (Google ou WhatsApp + senha),
// pedido de acesso com aprovação manual e registro de uso.
import { firebaseConfig, SDK } from "./firebase-config.js";

const ready = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("COLE");
window.track = () => {};
if (!ready) {
  console.warn("Palpiteiro: Firebase ainda não configurado, app aberto sem login.");
} else {
  start();
}

async function start() {
  document.body.classList.add("locked");
  const gate = document.createElement("div");
  gate.id = "gate";
  document.body.appendChild(gate);

  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`)
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app), db = F.getFirestore(app);
  A.setPersistence(auth, A.browserLocalPersistence).catch(() => {});
  let unsub = null;

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const digits = s => String(s || "").replace(/\D/g, "");
  const logo = `<div class="g-logo"><img src="icon-192.png?v=3" alt=""><h1>Palpi<span>teiro</span></h1></div>`;
  const show = html => { gate.innerHTML = `<div class="g-card">${logo}${html}</div>`; };
  const err = msg => { const e = gate.querySelector(".g-err"); if (e) { e.textContent = msg; e.hidden = false; } };
  const busy = on => gate.querySelectorAll("button,input").forEach(b => b.disabled = on);
  const msgFor = e => {
    const c = (e && e.code) || "";
    if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "E-mail ou senha incorretos.";
    if (c.includes("invalid-email")) return "E-mail inválido.";
    if (c.includes("email-already-in-use")) return "Esse e-mail já tem cadastro. Use Entrar.";
    if (c.includes("weak-password")) return "A senha precisa ter pelo menos 6 caracteres.";
    if (c.includes("popup-closed")) return "Login com Google cancelado.";
    if (c.includes("too-many-requests")) return "Muitas tentativas. Espere um pouco e tente de novo.";
    if (c.includes("network")) return "Sem conexão. Verifique a internet.";
    return "Não deu certo agora. Tente de novo." + (c ? ` (${c})` : "");
  };

  const loginView = () => {
    show(`<p class="g-sub">Entre para ver os jogos e palpites.</p>
      <button class="g-google" id="g-google"><svg viewBox="0 0 48 48" width="20" height="20"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Entrar com Google</button>
      <div class="g-or"><span>ou</span></div>
      <input id="g-mail" type="email" inputmode="email" placeholder="E-mail" autocomplete="email">
      <input id="g-pass" type="password" placeholder="Senha" autocomplete="current-password">
      <div class="g-err" hidden></div>
      <button class="g-main" id="g-enter">Entrar</button>
      <p class="g-link">Não tem conta? <a href="#" id="g-tosign">Pedir acesso</a></p>`);
    gate.querySelector("#g-google").onclick = google;
    gate.querySelector("#g-tosign").onclick = e => { e.preventDefault(); signupView(); };
    gate.querySelector("#g-enter").onclick = async () => {
      const m = gate.querySelector("#g-mail").value.trim(), p = gate.querySelector("#g-pass").value;
      if (!/^\S+@\S+\.\S+$/.test(m)) return err("Digite seu e-mail.");
      if (!p) return err("Digite a senha.");
      busy(true);
      try { await A.signInWithEmailAndPassword(auth, m, p); } catch (e) { busy(false); err(msgFor(e)); }
    };
  };

  const signupView = () => {
    show(`<p class="g-sub">Peça seu acesso. Ele é liberado depois da aprovação.</p>
      <button class="g-google" id="g-google">Continuar com Google</button>
      <div class="g-or"><span>ou cadastre-se</span></div>
      <input id="g-name" placeholder="Seu nome" autocomplete="name">
      <input id="g-mail" type="email" inputmode="email" placeholder="E-mail" autocomplete="email">
      <input id="g-wpp" type="tel" inputmode="tel" placeholder="WhatsApp com DDD" autocomplete="tel">
      <input id="g-pass" type="password" placeholder="Crie uma senha (mín. 6)" autocomplete="new-password">
      <div class="g-err" hidden></div>
      <button class="g-main" id="g-sign">Pedir acesso</button>
      <p class="g-link">Já tem conta? <a href="#" id="g-tologin">Entrar</a></p>`);
    gate.querySelector("#g-google").onclick = google;
    gate.querySelector("#g-tologin").onclick = e => { e.preventDefault(); loginView(); };
    gate.querySelector("#g-sign").onclick = async () => {
      const n = gate.querySelector("#g-name").value.trim(), m = gate.querySelector("#g-mail").value.trim(), w = digits(gate.querySelector("#g-wpp").value), p = gate.querySelector("#g-pass").value;
      if (n.length < 2) return err("Digite seu nome.");
      if (!/^\S+@\S+\.\S+$/.test(m)) return err("Digite um e-mail válido.");
      if (w.length < 10 || w.length > 13) return err("Digite o WhatsApp com DDD.");
      if (p.length < 6) return err("A senha precisa ter pelo menos 6 caracteres.");
      busy(true);
      try {
        sessionStorage.setItem("pl-new", JSON.stringify({name: n, whatsapp: w}));
        const c = await A.createUserWithEmailAndPassword(auth, m, p);
        await A.updateProfile(c.user, {displayName: n}).catch(() => {});
      } catch (e) { busy(false); err(msgFor(e)); }
    };
  };

  async function google() {
    busy(true);
    const prov = new A.GoogleAuthProvider();
    prov.setCustomParameters({prompt: "select_account"});
    try { await A.signInWithPopup(auth, prov); }
    catch (e) {
      if (String(e.code).includes("popup-blocked") || String(e.code).includes("operation-not-supported")) {
        try { await A.signInWithRedirect(auth, prov); return; } catch (e2) { e = e2; }
      }
      console.error("Palpiteiro google login", e && e.code, e && e.message);
      busy(false); err(String(e && e.code).includes("invalid-credential") ? "O Google recusou o login. (" + e.code + ")" : msgFor(e));
    }
  }

  const waitView = (u, d) => {
    show(`<div class="g-icon">⏳</div><h2>Pedido enviado</h2>
      <p class="g-sub">Olá, ${esc(d.name || "tudo bem")}! Seu acesso está aguardando aprovação. Assim que for liberado, o app abre aqui automaticamente.</p>
      ${d.whatsapp ? "" : `<p class="g-sub" style="margin-top:6px">Deixe seu WhatsApp para falarmos com você:</p>
      <input id="g-wpp" type="tel" inputmode="tel" placeholder="WhatsApp com DDD" autocomplete="tel">
      <div class="g-err" hidden></div>
      <button class="g-main" id="g-savewpp">Salvar WhatsApp</button>`}
      <button class="g-ghost" id="g-out">Sair</button>`);
    gate.querySelector(".g-icon").textContent = "";
    gate.querySelector("#g-out").onclick = () => A.signOut(auth);
    const sv = gate.querySelector("#g-savewpp");
    if (sv) sv.onclick = async () => {
      const w = digits(gate.querySelector("#g-wpp").value);
      if (w.length < 10 || w.length > 13) return err("Digite o WhatsApp com DDD.");
      busy(true);
      try { await F.updateDoc(F.doc(db, "users", u.uid), {whatsapp: w}); } catch (e) { busy(false); err("Não deu para salvar agora."); }
    };
  };
  const blockedView = () => {
    show(`<h2>Acesso não liberado</h2><p class="g-sub">Seu pedido não foi aprovado. Fale com o suporte se achar que foi um engano.</p>
      <button class="g-ghost" id="g-out">Sair</button>`);
    gate.querySelector("#g-out").onclick = () => A.signOut(auth);
  };

  const today = () => new Date().toLocaleDateString("en-CA", {timeZone: "America/Sao_Paulo"});
  const openApp = (u) => {
    document.body.classList.remove("locked");
    gate.hidden = true;
    const ref = F.doc(db, "users", u.uid);
    const bump = (field) => {
      const inc = F.increment(1), now = F.serverTimestamp();
      F.updateDoc(ref, {[field]: inc, lastSeen: now}).catch(() => {});
      F.setDoc(F.doc(db, "users", u.uid, "days", today()), {[field]: inc, date: today(), last: now}, {merge: true}).catch(() => {});
    };
    window.track = kind => { if (["games", "bets", "tickets"].includes(kind)) bump(kind); };
    if (!sessionStorage.getItem("pl-open")) { sessionStorage.setItem("pl-open", "1"); bump("opens"); }
    else F.updateDoc(ref, {lastSeen: F.serverTimestamp()}).catch(() => {});
  };

  show(`<div class="g-load"><span class="dots"><i></i><i></i><i></i></span></div>`);
  A.getRedirectResult(auth).catch(() => {});
  A.onAuthStateChanged(auth, async u => {
    if (unsub) { unsub(); unsub = null; }
    if (!u) { document.body.classList.add("locked"); gate.hidden = false; return loginView(); }
    show(`<div class="g-load"><span class="dots"><i></i><i></i><i></i></span></div>`);
    const ref = F.doc(db, "users", u.uid);
    try {
      const snap = await F.getDoc(ref);
      if (!snap.exists()) {
        let extra = {};
        try { extra = JSON.parse(sessionStorage.getItem("pl-new") || "{}"); } catch (e) {}
        const isGoogle = (u.providerData || []).some(p => p.providerId === "google.com");
        await F.setDoc(ref, {
          name: extra.name || u.displayName || "",
          whatsapp: extra.whatsapp || "",
          email: u.email || "",
          photo: u.photoURL || "",
          provider: isGoogle ? "google" : "email",
          status: "pending",
          createdAt: F.serverTimestamp(),
          lastSeen: F.serverTimestamp(),
          opens: 0, games: 0, bets: 0, tickets: 0
        });
        sessionStorage.removeItem("pl-new");
      }
    } catch (e) { console.error(e); }
    let opened = false;
    unsub = F.onSnapshot(ref, s => {
      const d = s.data() || {};
      if (d.status === "approved") { if (!opened) { opened = true; openApp(u); } }
      else {
        opened = false; document.body.classList.add("locked"); gate.hidden = false;
        d.status === "blocked" ? blockedView() : waitView(u, d);
      }
    }, () => waitView(u, {}));
  });
}
