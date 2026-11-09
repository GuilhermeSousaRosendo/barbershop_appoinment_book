const $ = q => document.querySelector(q);

// ---- Chamada à API ----
async function api(url, { method = 'GET', body } = {}) {
  const r = await fetch('/api' + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.erro || 'Erro inesperado.');
  return data;
}

// ---- Sessão (simulada no navegador) ----
const sessao = () => JSON.parse(localStorage.getItem('sessao'));
const entrar = user => localStorage.setItem('sessao', JSON.stringify(user));
const sair = () => { localStorage.removeItem('sessao'); location.href = 'index.html'; };

// Redireciona para o login se não estiver logado (ou se for o tipo errado)
function proteger(tipo) {
  const s = sessao();
  if (!s || (tipo && s.tipo !== tipo)) { location.href = 'login.html'; throw new Error('não autorizado'); }
  return s;
}

// ---- Datas ----
const hoje = () => new Date().toLocaleDateString('sv-SE');
const fmtData = d => d.split('-').reverse().join('/');

// ---- Navbar ----
function navbar() {
  const s = sessao();
  const pagina = location.pathname.split('/').pop() || 'index.html';
  const link = (href, texto) => `<a href="${href}" class="${pagina === href ? 'ativo' : ''}">${texto}</a>`;

  let links = link('index.html', 'Início');
  if (!s) links += link('login.html', 'Entrar') + link('cadastro.html', 'Cadastrar');
  else if (s.tipo === 'cliente')
    links += link('agendar.html', 'Agendar') + link('meus-agendamentos.html', 'Meus agendamentos');
  else
    links += link('barbeiro.html', 'Agenda') + link('horarios.html', 'Meus horários');
  if (s) links += `<span class="hint">${s.nome}</span><button class="btn small ghost" onclick="sair()">Sair</button>`;

  $('#nav').innerHTML = `<a class="logo" href="index.html">💈 BarberTime</a><div class="links">${links}</div>`;
}