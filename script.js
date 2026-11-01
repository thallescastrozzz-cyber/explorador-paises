// =====================================================================
// Explorador de Países — Etapa 02
// Busca: REST Countries API | Persistência: Supabase (PostgreSQL)
// =====================================================================
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// 🔧 TROQUE PELOS DADOS DO SEU PROJETO (Project Settings → API)
// A chave "anon public" foi feita para ficar no frontend; a proteção é feita pelas políticas RLS.
const SUPABASE_URL = "https://nrnbfnblfpndnujvarqx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_KlzvoslLP9k7wRPwfOeZlg_fRUU1iJY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TABELA = "favoritos";

// ---------- Elementos da página ----------
const formBusca = document.getElementById("form-busca");
const campoBusca = document.getElementById("campo-busca");
const statusBusca = document.getElementById("status-busca");
const resultados = document.getElementById("resultados");
const statusLista = document.getElementById("status-lista");
const listaFavoritos = document.getElementById("lista-favoritos");
const botoesFiltro = document.querySelectorAll(".filtro");

let filtroAtual = "todos";
let favoritosCache = [];

// =====================================================================
// Dados dos países (API pública, sem chave)
// Base aberta "mledoze/countries" servida pela CDN jsDelivr + bandeiras do flagcdn.com
// (a REST Countries v3.1 foi desativada e agora exige cadastro e chave)
// =====================================================================
const URL_PAISES = "https://cdn.jsdelivr.net/gh/mledoze/countries@master/countries.json";
let cachePaises = null;

const normalizar = (t) =>
  (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

async function carregarPaises() {
  if (!cachePaises) {
    const resp = await fetch(URL_PAISES);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    cachePaises = await resp.json();
  }
  return cachePaises;
}

async function buscarPaises(termo) {
  const t = normalizar(termo);
  const todos = await carregarPaises();
  const nomes = (p) => [
    p.translations?.por?.common, p.translations?.por?.official,
    p.name.common, p.name.official,
  ].map(normalizar);
  // primeiro os que começam com o termo, depois os que apenas contêm
  const comeca = todos.filter((p) => nomes(p).some((n) => n.startsWith(t)));
  const contem = todos.filter((p) => !comeca.includes(p) && nomes(p).some((n) => n.includes(t)));
  return [...comeca, ...contem];
}

const bandeira = (pais) => `https://flagcdn.com/w320/${pais.cca2.toLowerCase()}.png`;

function nomePt(pais) {
  return pais.translations?.por?.common || pais.name.common;
}

formBusca.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusBusca.className = "status";
  statusBusca.textContent = "Buscando...";
  resultados.innerHTML = "";
  try {
    const paises = await buscarPaises(campoBusca.value);
    if (paises.length === 0) {
      statusBusca.textContent = "Nenhum país encontrado. Tente outro nome.";
      return;
    }
    statusBusca.textContent = `${paises.length} resultado(s):`;
    paises.slice(0, 12).forEach(renderizarResultado);
  } catch (err) {
    statusBusca.className = "status erro";
    statusBusca.textContent = "Erro ao carregar os dados dos países. Verifique sua conexão.";
    console.error(err);
  }
});

function renderizarResultado(pais) {
  const card = document.createElement("article");
  card.className = "pais";
  card.innerHTML = `
    <img src="${bandeira(pais)}" alt="Bandeira de ${nomePt(pais)}">
    <div class="info">
      <h3>${nomePt(pais)}</h3>
      <p>🏛️ Capital: ${pais.capital?.[0] ?? "—"}</p>
      <p>🌐 Região: ${pais.region}${pais.subregion ? ` · ${pais.subregion}` : ""}</p>
      <p>🗣️ Idiomas: ${Object.values(pais.languages || {}).join(", ") || "—"}</p>
      <p>📐 Área: ${(pais.area ?? 0).toLocaleString("pt-BR")} km²</p>
    </div>
    <div class="acoes">
      <button data-status="visitado">✈️ Visitei</button>
      <button data-status="desejado" class="secundario">⭐ Quero ir</button>
    </div>`;

  card.querySelectorAll("button").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const extra = {
        codigo: pais.cca3,
        bandeira: bandeira(pais),
        capital: pais.capital?.[0] ?? null,
        regiao: pais.region,
        status: btn.dataset.status,
        anotacao: "",
      };
      btn.disabled = true;
      await salvarFavorito(nomePt(pais), extra);
      btn.disabled = false;
    })
  );
  resultados.appendChild(card);
}

// =====================================================================
// CRUD no Supabase
// =====================================================================

// CREATE — salvar um país
async function salvarFavorito(nome, extra) {
  const jaExiste = favoritosCache.some((f) => f.dados_extra?.codigo === extra.codigo);
  if (jaExiste) {
    alert(`${nome} já está na sua lista.`);
    return;
  }
  const { error } = await supabase.from(TABELA).insert({ nome_item: nome, dados_extra: extra });
  if (error) {
    console.error(error);
    alert("Não foi possível salvar. Veja o Console (F12) — confira as políticas RLS.");
    return;
  }
  listarFavoritos();
}

// READ — listar países salvos
async function listarFavoritos() {
  const { data, error } = await supabase
    .from(TABELA)
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) {
    console.error(error);
    statusLista.className = "status erro";
    statusLista.textContent = "Erro ao carregar do banco. Confira URL, chave e políticas RLS.";
    return;
  }
  favoritosCache = data;
  renderizarLista();
}

// UPDATE (bônus) — trocar status ou editar anotação
async function atualizarFavorito(item, mudancas) {
  const novoExtra = { ...item.dados_extra, ...mudancas };
  const { error } = await supabase.from(TABELA).update({ dados_extra: novoExtra }).eq("id", item.id);
  if (error) console.error(error);
  listarFavoritos();
}

// DELETE — remover um país
async function removerFavorito(id) {
  const { error } = await supabase.from(TABELA).delete().eq("id", id);
  if (error) console.error(error);
  listarFavoritos();
}

// =====================================================================
// Renderização da lista "Meus países"
// =====================================================================
function renderizarLista() {
  const itens = favoritosCache.filter(
    (f) => filtroAtual === "todos" || f.dados_extra?.status === filtroAtual
  );

  listaFavoritos.innerHTML = "";
  statusLista.className = "status";
  const visitados = favoritosCache.filter((f) => f.dados_extra?.status === "visitado").length;
  statusLista.textContent = favoritosCache.length
    ? `${favoritosCache.length} país(es) salvos · ${visitados} visitado(s) · ${favoritosCache.length - visitados} desejado(s)`
    : "Sua lista está vazia. Busque um país e clique em “Visitei” ou “Quero ir”.";

  itens.forEach((item) => {
    const extra = item.dados_extra || {};
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <img src="${extra.bandeira ?? ""}" alt="">
      <div class="texto">
        <strong>${item.nome_item}<span class="tag ${extra.status}">${extra.status === "visitado" ? "visitado" : "desejado"}</span></strong>
        <small>${extra.capital ?? "—"} · ${extra.regiao ?? ""} · salvo em ${new Date(item.criado_em).toLocaleDateString("pt-BR")}</small>
        ${extra.anotacao ? `<p class="nota">📝 ${extra.anotacao}</p>` : ""}
      </div>
      <div class="botoes">
        <button class="secundario" data-acao="status">${extra.status === "visitado" ? "Marcar como desejado" : "Marcar como visitado"}</button>
        <button class="secundario" data-acao="nota">📝 Anotação</button>
        <button class="perigo" data-acao="excluir">Excluir</button>
      </div>`;

    li.querySelector('[data-acao="status"]').addEventListener("click", () =>
      atualizarFavorito(item, { status: extra.status === "visitado" ? "desejado" : "visitado" })
    );
    li.querySelector('[data-acao="nota"]').addEventListener("click", () => {
      const texto = prompt(`Anotação para ${item.nome_item}:`, extra.anotacao ?? "");
      if (texto !== null) atualizarFavorito(item, { anotacao: texto.trim() });
    });
    li.querySelector('[data-acao="excluir"]').addEventListener("click", () => {
      if (confirm(`Remover ${item.nome_item} da lista?`)) removerFavorito(item.id);
    });
    listaFavoritos.appendChild(li);
  });
}

botoesFiltro.forEach((btn) =>
  btn.addEventListener("click", () => {
    botoesFiltro.forEach((b) => b.classList.remove("ativo"));
    btn.classList.add("ativo");
    filtroAtual = btn.dataset.filtro;
    renderizarLista();
  })
);

// Carrega os países salvos ao abrir a página
listarFavoritos();
