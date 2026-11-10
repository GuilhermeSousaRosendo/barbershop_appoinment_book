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

  if (!s) {
    links += link('login.html', 'Entrar') + link('cadastro.html', 'Cadastrar');
  } else if (s.tipo === 'cliente') {
    links += link('agendar.html', 'Agendar') + link('meus-agendamentos.html', 'Meus agendamentos');
  } else {
    links += link('barbeiro.html', 'Agenda') + link('horarios.html', 'Meus horários');
  }

  if (s) {
    links += `<span class="hint">${s.nome}</span><button class="btn small ghost" type="button" onclick="sair()">Sair</button>`;
  }

  const navElement = $('#nav');
  if (navElement) {

    navElement.innerHTML = `
  <a class="logo" href="index.html">
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M7 3h10l-1 5H8L7 3Z"/>
      <path d="M8 8h8l1 13H7L8 8Z"/>
      <path d="M9 12h6M9.5 16h5"/>
      <path d="M9 3V1h6v2"/>
    </svg>
    <span>BarberTime</span>
  </a>
  <div class="links">${links}</div>
`;

  }
}

// Inicialização e Evento de Login
document.addEventListener('DOMContentLoaded', () => {
  navbar();

  const form = $('#form');
  if (form) {
    form.onsubmit = async e => {
      e.preventDefault();
      const msg = $('#msg');
      const botao = form.querySelector('button');

      msg.textContent = '';
      botao.disabled = true;
      botao.textContent = 'Entrando...';

      try {
        const user = await api('/login', {
          method: 'POST',
          body: {
            email: $('#email').value,
            senha: $('#senha').value
          }
        });

        entrar(user);
        location.href = user.tipo === 'barbeiro' ? 'barbeiro.html' : 'agendar.html';

      } catch (err) {
        msg.textContent = err.message || 'Ocorreu um erro ao entrar.';
        botao.disabled = false;
        botao.innerHTML = 'Entrar na minha conta <span>→</span>';
      }
    };
  }
});