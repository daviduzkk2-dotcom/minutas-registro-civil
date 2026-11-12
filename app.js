/* Minutas do Registro Civil — tudo roda no navegador; nada é gravado (sem localStorage, cookies ou servidor). */
(function () {
  'use strict';

  const form = document.getElementById('form');
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const campo = (nome) => form.elements[nome];

  // ---------- Blocos de endereço (requerente e testemunhas) ----------
  const tpl = document.getElementById('tplEndereco');
  document.querySelectorAll('.endereco').forEach((caixa) => {
    const p = caixa.dataset.pessoa;
    caixa.appendChild(tpl.content.cloneNode(true));
    caixa.querySelectorAll('[data-campo]').forEach((el) => {
      if (el.tagName === 'INPUT') el.name = `${p}_${el.dataset.campo}`;
    });
    const cep = caixa.querySelector('[data-campo="cep"]');
    const status = caixa.querySelector('[data-campo="cepStatus"]');
    const cpf = caixa.querySelector('[data-campo="cpf"]');
    cpf.addEventListener('input', () => { cpf.value = mascaraCPF(cpf.value); cpf.classList.remove('invalido'); });
    cpf.addEventListener('blur', () => { if (cpf.value && !cpfValido(cpf.value)) cpf.classList.add('invalido'); });
    cep.addEventListener('input', () => {
      cep.value = mascaraCEP(cep.value);
      if (cep.value.replace(/\D/g, '').length === 8) buscarCEP(p, cep.value, status);
      else status.textContent = '';
    });
  });

  function mascaraCPF(v) {
    v = v.replace(/\D/g, '').slice(0, 11);
    let s = v.slice(0, 3);
    if (v.length > 3) s += '.' + v.slice(3, 6);
    if (v.length > 6) s += '.' + v.slice(6, 9);
    if (v.length > 9) s += '-' + v.slice(9);
    return s;
  }
  function mascaraCEP(v) {
    v = v.replace(/\D/g, '').slice(0, 8);
    return v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
  }
  function cpfValido(v) {
    const d = v.replace(/\D/g, '');
    if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    for (let t = 9; t < 11; t++) {
      let s = 0;
      for (let i = 0; i < t; i++) s += +d[i] * (t + 1 - i);
      if (((s * 10) % 11) % 10 !== +d[t]) return false;
    }
    return true;
  }

  let ultimoCEP = {};
  async function buscarCEP(p, cep, status) {
    const n = cep.replace(/\D/g, '');
    if (ultimoCEP[p] === n) return;
    ultimoCEP[p] = n;
    status.textContent = 'Buscando endereço…';
    try {
      const r = await fetch(`https://viacep.com.br/ws/${n}/json/`, { referrerPolicy: 'no-referrer', cache: 'no-store' });
      const j = await r.json();
      if (j.erro) throw new Error('não encontrado');
      campo(`${p}_logradouro`).value = j.logradouro || '';
      campo(`${p}_bairro`).value = j.bairro || '';
      campo(`${p}_cidade`).value = j.localidade || '';
      campo(`${p}_uf`).value = j.uf || '';
      status.textContent = j.logradouro ? 'Endereço preenchido. Falta o número.' : 'CEP geral da cidade: digite rua e bairro.';
      (j.logradouro ? campo(`${p}_numero`) : campo(`${p}_logradouro`)).focus();
    } catch (e) {
      ultimoCEP[p] = null;
      status.textContent = 'CEP não encontrado. Preencha o endereço à mão.';
    }
  }

  // ---------- Modelo e tipo de livro ----------
  function atualizarModelo() {
    const comTest = campo('modelo').value === 'testemunhas';
    $('#blocoTestemunhas').hidden = !comTest;
  }
  function atualizarLivro() {
    const t = campo('livroTipo').value;
    const casamento = t.startsWith('B');
    $('#lblRegistrado').firstChild.textContent = casamento ? 'Nome do 1º contraente ' : (t.startsWith('C') ? 'Nome do falecido ' : 'Nome do registrado ');
    if (t === 'C AUX') $('#lblRegistrado').firstChild.textContent = 'Nome do natimorto (ou dos pais) ';
    $('#lblRegistrado2').hidden = !casamento;
  }
  // ---------- Motivo das testemunhas (texto pronto, editável) ----------
  const MOTIVOS = {
    semdoc: () => 'EM RAZÃO DE O REQUERENTE NÃO ESTAR PORTANDO DOCUMENTO DE IDENTIFICAÇÃO, DUAS TESTEMUNHAS ASSINARAM PARA COMPROVAR SEU PEDIDO E SUA PRESENÇA.',
    rogo: (nome) => `POR NÃO SABER OU NÃO PODER O REQUERENTE ASSINAR, ASSINA A SEU ROGO ${nome || '________________________________________'}, ` +
      'E DUAS TESTEMUNHAS ASSINARAM PARA COMPROVAR SEU PEDIDO E SUA PRESENÇA.',
    digital: () => 'POR NÃO SABER O REQUERENTE ASSINAR, FOI COLHIDA SUA IMPRESSÃO DIGITAL, E DUAS TESTEMUNHAS ASSINARAM PARA COMPROVAR SEU PEDIDO E SUA PRESENÇA.',
    docinvalido: () => 'EM RAZÃO DE O DOCUMENTO DE IDENTIFICAÇÃO DO REQUERENTE NÃO ESTAR EM CONDIÇÕES DE USO, DUAS TESTEMUNHAS ASSINARAM PARA COMPROVAR SEU PEDIDO E SUA PRESENÇA.',
    outro: () => '',
  };
  let motivoEditado = false;
  function atualizarMotivo(forcar) {
    const tipo = campo('motivoTipo').value;
    $('#lblRogo').hidden = tipo !== 'rogo';
    if (forcar || !motivoEditado) {
      campo('motivoTexto').value = MOTIVOS[tipo](v('rogoNome').toLocaleUpperCase('pt-BR'));
      motivoEditado = false;
    }
    if (tipo === 'outro' && forcar) campo('motivoTexto').focus();
  }
  campo('motivoTipo').addEventListener('change', () => atualizarMotivo(true));
  campo('rogoNome').addEventListener('input', () => atualizarMotivo(false));
  campo('motivoTexto').addEventListener('input', () => { motivoEditado = true; });

  form.querySelectorAll('[name="modelo"]').forEach((r) => r.addEventListener('change', atualizarModelo));
  campo('livroTipo').addEventListener('change', atualizarLivro);

  // ---------- Caixa de escolha com pesquisa ----------
  const ICONE_LUPA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const abertos = new Set();

  function criarCombo(raiz, { vazio, aoEscolher }) {
    raiz.innerHTML =
      `<button type="button" class="combo-botao" aria-haspopup="listbox"><span class="txt vazio">${esc(vazio)}</span></button>` +
      `<div class="combo-painel" hidden><div class="combo-busca"><input type="text" placeholder="Pesquisar…" autocomplete="off" aria-label="Pesquisar">${ICONE_LUPA}</div>` +
      '<ul class="combo-lista" role="listbox"></ul></div>';
    const botao = $('.combo-botao', raiz), painel = $('.combo-painel', raiz), busca = $('input', painel), ul = $('ul', painel);
    let itens = [], filtrados = [], foco = 0, valor = '';
    const LIMITE = 400;

    function desenhar() {
      const q = semAcento(busca.value);
      const palavras = q.split(/\s+/).filter(Boolean);
      filtrados = itens.filter((it) => palavras.every((p) => it.busca.includes(p)));
      if (q) {
        // Primeiro o que começa com o texto digitado, depois início de palavra, depois o resto.
        const nota = (it) => {
          const r = semAcento(it.rotulo).replace(/^\d+ - /, '');
          if (r.startsWith(q)) return 0;
          if ((' ' + r).includes(' ' + q)) return 1;
          return palavras.every((p) => (' ' + r).includes(' ' + p)) ? 2 : 3;
        };
        filtrados = filtrados.map((it, i) => [nota(it), i, it]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);
      }
      foco = Math.max(0, filtrados.findIndex((it) => it.valor === valor));
      if (q) foco = 0;
      const mostrar = filtrados.slice(0, LIMITE);
      ul.innerHTML = mostrar.length
        ? mostrar.map((it, i) => `<li role="option" data-i="${i}" class="${i === foco ? 'foco' : ''} ${it.valor === valor ? 'marcado' : ''}">${esc(it.rotulo)}${it.detalhe ? `<small>${esc(it.detalhe)}</small>` : ''}</li>`).join('') +
          (filtrados.length > LIMITE ? `<li class="nada">… continue digitando para ver mais (${filtrados.length})</li>` : '')
        : '<li class="nada">Nada encontrado</li>';
      const atual = ul.querySelector('.foco');
      if (atual) atual.scrollIntoView({ block: 'nearest' });
    }
    function abrir() {
      if (botao.disabled) return;
      abertos.forEach((c) => c !== api && c.fechar());
      painel.hidden = false; raiz.classList.add('aberto'); abertos.add(api);
      busca.value = ''; desenhar(); busca.focus();
    }
    function fechar() { painel.hidden = true; raiz.classList.remove('aberto'); abertos.delete(api); }
    function escolher(it) {
      valor = it ? it.valor : '';
      const txt = $('.txt', botao);
      txt.textContent = it ? it.rotulo : vazio;
      txt.classList.toggle('vazio', !it);
      botao.title = it && it.detalhe ? it.detalhe : '';
      fechar();
      aoEscolher(it);
    }
    function moverFoco(d) {
      const n = Math.min(filtrados.length, LIMITE);
      if (!n) return;
      foco = (foco + d + n) % n;
      ul.querySelectorAll('li[data-i]').forEach((li) => li.classList.toggle('foco', +li.dataset.i === foco));
      const atual = ul.querySelector('.foco'); if (atual) atual.scrollIntoView({ block: 'nearest' });
    }
    botao.addEventListener('click', () => (painel.hidden ? abrir() : (fechar(), botao.focus())));
    botao.addEventListener('keydown', (e) => {
      if (/^(ArrowDown|Enter| )$/.test(e.key) || (e.key.length === 1 && /\S/.test(e.key))) {
        if (e.key.length === 1 && e.key !== ' ') { abrir(); busca.value = e.key; desenhar(); e.preventDefault(); return; }
        e.preventDefault(); abrir();
      }
    });
    busca.addEventListener('input', desenhar);
    busca.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); moverFoco(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moverFoco(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (filtrados[foco]) escolher(filtrados[foco]); botao.focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); fechar(); botao.focus(); }
      else if (e.key === 'Tab') fechar();
    });
    ul.addEventListener('mousedown', (e) => e.preventDefault());
    ul.addEventListener('click', (e) => {
      const li = e.target.closest('li[data-i]');
      if (li) { escolher(filtrados[+li.dataset.i]); botao.focus(); }
    });
    const api = {
      definirItens(lista, novoVazio) {
        itens = lista.map((it) => Object.assign({ busca: semAcento(`${it.rotulo} ${it.detalhe || ''}`) }, it));
        if (novoVazio) vazio = novoVazio;
        botao.disabled = !itens.length;
        escolher(null);
      },
      escolherValor(v) { escolher(itens.find((it) => it.valor === v) || null); },
      get valor() { return valor; },
      fechar,
    };
    return api;
  }
  document.addEventListener('mousedown', (e) => {
    abertos.forEach((c) => { if (!e.target.closest('.combo')) c.fechar(); });
  });

  // ---------- Cartórios (CNJ – Justiça Aberta) ----------
  let base = null;
  const selUF = $('#uf'), txtDest = $('#destinatario');
  let cidadeAtual = null;
  const OUTRO = { valor: 'outro', rotulo: 'Outro cartório (escrever o destinatário)', detalhe: 'Use se o cartório não estiver na lista' };

  const comboCartorio = criarCombo($('#comboCartorio'), {
    vazio: 'Escolha a cidade primeiro',
    aoEscolher: (it) => montarDestinatario(it),
  });
  const comboCidade = criarCombo($('#comboCidade'), {
    vazio: 'Selecione',
    aoEscolher: (it) => { cidadeAtual = it ? it.valor : null; preencherCartorios(); },
  });

  fetch('dados/cartorios-rcpn.json').then((r) => r.json()).then((j) => {
    base = j;
    Object.keys(j.uf).forEach((uf) => selUF.add(new Option(uf, uf, uf === 'SP', uf === 'SP')));
    preencherCidades();
    iniciarInteiro();
    $('#fonteCartorios').textContent = `Lista: ${j.fonte}, baixada em ${j.baixado_em.split('-').reverse().join('/')}. Se o cartório não aparecer, escolha “Outro cartório” e escreva o destinatário.`;
  }).catch(() => {
    $('#fonteCartorios').textContent = 'Não foi possível carregar a lista de cartórios. Escreva o destinatário à mão.';
  });

  function preencherCidades() {
    if (!base) return;
    const cidades = Object.keys(base.uf[selUF.value] || {});
    comboCidade.definirItens(cidades.map((c) => ({ valor: c, rotulo: c })), 'Selecione');
  }
  function preencherCartorios() {
    txtDest.value = '';
    if (!cidadeAtual) { comboCartorio.definirItens([], 'Escolha a cidade primeiro'); return; }
    const lista = base.uf[selUF.value][cidadeAtual];
    const itens = lista.map(([cns, resumo, nome]) => ({
      valor: cns,
      rotulo: `${cns} - ${cidadeAtual}${resumo ? ` - ${resumo}` : ''}`,
      detalhe: nome,
      resumo, nome,
    }));
    itens.push(OUTRO);
    comboCartorio.definirItens(itens, 'Selecione');
    if (lista.length === 1) comboCartorio.escolherValor(lista[0][0]);
  }
  function montarDestinatario(it) {
    if (!it) { txtDest.value = ''; return; }
    if (it.valor === 'outro') { txtDest.value = ''; txtDest.focus(); return; }
    const uf = selUF.value;
    const cid = cidadeAtual.toLocaleUpperCase('pt-BR');
    const sozinho = base.uf[uf][cidadeAtual].length === 1;
    // O CNS não vai para o PDF: o destinatário leva só cidade e subdistrito/distrito.
    if (it.resumo) txtDest.value = `OFICIAL DE REGISTRO CIVIL DAS PESSOAS NATURAIS DE ${cid}/${uf} – ${it.resumo.toLocaleUpperCase('pt-BR')}`;
    else if (sozinho) txtDest.value = `OFICIAL DE REGISTRO CIVIL DAS PESSOAS NATURAIS DE ${cid}/${uf}`;
    else txtDest.value = `${it.nome.toLocaleUpperCase('pt-BR')} – ${cid}/${uf}`;
  }
  selUF.addEventListener('change', () => { cidadeAtual = null; preencherCidades(); });

  // ---------- Datas ----------
  function hojeISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function dataExtenso(iso) {
    const [a, m, d] = iso.split('-');
    return `${d} de ${MESES[+m - 1]} de ${a}`;
  }
  $('#data').value = hojeISO();

  // ---------- Imagens do timbrado ----------
  const imagens = {};
  ['logo', 'oficial'].forEach((n) => {
    fetch(`img/${n}.png`).then((r) => r.blob()).then((b) => new Promise((ok) => {
      const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b);
    })).then((url) => { imagens[n] = url; });
  });

  // ---------- Leitura e validação ----------
  const v = (n) => (campo(n) ? campo(n).value.trim() : '');
  const up = (s) => s.toLocaleUpperCase('pt-BR');

  function pessoa(p, nomeCampo) {
    return {
      nome: up(v(nomeCampo)),
      cpf: v(`${p}_cpf`),
      cep: v(`${p}_cep`), numero: v(`${p}_numero`), complemento: v(`${p}_complemento`),
      logradouro: v(`${p}_logradouro`), bairro: v(`${p}_bairro`), cidade: v(`${p}_cidade`), uf: up(v(`${p}_uf`)),
    };
  }
  function enderecoTexto(x) {
    let s = x.logradouro;
    if (x.numero) s += `, ${x.numero}`;
    if (x.complemento) s += `, ${x.complemento}`;
    if (x.bairro) s += ` - ${x.bairro}`;
    if (x.cidade) s += `, ${x.cidade}`;
    if (x.uf) s += ` - ${x.uf}`;
    return s;
  }

  function coletar() {
    const erros = [];
    form.querySelectorAll('.invalido').forEach((e) => e.classList.remove('invalido'));
    const exigir = (nome, rotulo) => {
      if (!v(nome)) { erros.push(rotulo); if (campo(nome)) campo(nome).classList.add('invalido'); }
    };
    const d = {
      modelo: campo('modelo').value,
      livroTipo: v('livroTipo'), livro: v('livro'), folha: v('folha'), termo: v('termo'),
      registrado1: up(v('registrado1')), registrado2: up(v('registrado2')),
      destinatario: up(v('destinatario')),
      req: pessoa('req', 'reqNome'), reqQualidade: v('reqQualidade'),
      t1: pessoa('t1', 't1Nome'), t2: pessoa('t2', 't2Nome'),
      local: up(v('localAssinatura')), data: v('data'),
      motivo: up(v('motivoTexto').replace(/\s+/g, ' ')),
    };
    const casamento = d.livroTipo.startsWith('B');
    exigir('livroTipo', 'Tipo de livro');
    exigir('livro', 'Livro nº'); exigir('folha', 'Folha'); exigir('termo', 'Termo nº');
    exigir('registrado1', casamento ? 'Nome do 1º contraente' : 'Nome do registrado');
    if (casamento) exigir('registrado2', 'Nome do 2º contraente');
    exigir('destinatario', 'Cartório de destino (destinatário)');
    exigir('reqNome', 'Nome do requerente');
    const pessoas = [['req', 'requerente']];
    if (d.modelo === 'testemunhas') {
      exigir('t1Nome', 'Nome da testemunha 1'); exigir('t2Nome', 'Nome da testemunha 2');
      exigir('motivoTexto', 'Texto do motivo das testemunhas');
      pessoas.push(['t1', 'testemunha 1'], ['t2', 'testemunha 2']);
    }
    pessoas.forEach(([p, r]) => {
      exigir(`${p}_logradouro`, `Endereço do(a) ${r}`);
      exigir(`${p}_numero`, `Número do endereço do(a) ${r}`);
      const cpf = v(`${p}_cpf`);
      const cpfObrigatorio = p !== 'req' || d.modelo === 'simples';
      if (!cpf && cpfObrigatorio) { erros.push(`CPF do(a) ${r}`); campo(`${p}_cpf`).classList.add('invalido'); }
      if (cpf && !cpfValido(cpf)) { erros.push(`CPF do(a) ${r} inválido (confira os números)`); campo(`${p}_cpf`).classList.add('invalido'); }
    });
    exigir('localAssinatura', 'Cidade da assinatura'); exigir('data', 'Data');
    return { d, erros };
  }

  function mostrarErros(erros) {
    const caixa = $('#erros');
    if (!erros.length) { caixa.hidden = true; return; }
    caixa.innerHTML = '<b>Falta preencher ou corrigir:</b><ul>' + erros.map((e) => `<li>${e}</li>`).join('') + '</ul>';
    caixa.hidden = false;
    const primeiro = form.querySelector('.invalido');
    if (primeiro) primeiro.focus();
  }

  // ---------- Montagem do PDF ----------
  const CERTIDAO = { A: 'NASCIMENTO', B: 'CASAMENTO', 'B AUX': 'CASAMENTO', C: 'ÓBITO', 'C AUX': 'NATIMORTO' };
  const pad = (s, n) => (/^\d+$/.test(s) ? s.padStart(n, '0') : up(s));
  const RECUO = 70; // recuo de primeira linha (pt)

  // Assinatura: duas linhas (a pessoa assina duas vezes) e, embaixo, a qualificação.
  function assinatura(x, rotulo, cpfOpcional, largura = 320, espaco = 30, entre = 26) {
    const linha = (topo) => ({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: largura, y2: 0, lineWidth: 0.8 }], margin: [0, topo, 0, 3] });
    const linhas = [
      linha(espaco),
      linha(entre),
      { text: [{ text: rotulo ? `${rotulo}: ` : '', bold: true }, { text: x.nome, bold: true }, x.qualidade ? ` (${x.qualidade})` : ''] },
    ];
    if (x.cpf || !cpfOpcional) linhas.push({ text: `CPF: ${x.cpf}` });
    linhas.push({ text: `ENDEREÇO: ${enderecoTexto(x)}` });
    return { stack: linhas, fontSize: 9.5, unbreakable: true };
  }

  function documento(d) {
    const tipoCert = CERTIDAO[d.livroTipo];
    const referente = d.livroTipo.startsWith('B') ? `${d.registrado1} E ${d.registrado2}` : d.registrado1;
    const corpo =
      'DECLARO, PARA TODOS OS FINS E EFEITOS DE DIREITO, NOS TERMOS DO ARTIGO 30, PARÁGRAFOS 1º E 2º, DA LEI Nº 6.015/73, ' +
      'QUE SOU RECONHECIDAMENTE POBRE, NA ACEPÇÃO JURÍDICA CIVIL DO TERMO, NÃO POSSUINDO RECURSOS SUFICIENTES PARA VIVER ' +
      'E MANTER MINHA FAMÍLIA, RAZÃO PELA QUAL NÃO TENHO CONDIÇÕES FINANCEIRAS PARA ARCAR COM AS DESPESAS DECORRENTES DA ' +
      `EXTRAÇÃO DA 2ª VIA DA CERTIDÃO DE ${tipoCert} REFERENTE A `;
    const fim = ' DECLARO, MAIS E FINALMENTE, QUE TENHO REAL CONHECIMENTO DE QUE A FALSIDADE DO SUPRA DECLARADO ' +
      'ACARRETARÁ CONTRA A MINHA PESSOA OS EFEITOS DA RESPONSABILIDADE CIVIL E PENAL.';

    const req = Object.assign({}, d.req, { qualidade: d.reqQualidade ? up(d.reqQualidade) : '' });
    const comTest = d.modelo === 'testemunhas';

    const content = [
      { text: d.destinatario, bold: true, fontSize: 10.5, margin: [0, 0, 0, comTest ? 12 : 18] },
      { text: 'D E C L A R A Ç Ã O', bold: true, alignment: 'center', fontSize: 13, margin: comTest ? [0, 4, 0, 14] : [0, 14, 0, 30] },
      { text: [corpo, { text: referente + '.', bold: true }, fim], alignment: 'justify', leadingIndent: RECUO, lineHeight: comTest ? 1.2 : 1.35 },
      { text: 'POR SER A EXPRESSÃO DA VERDADE, FIRMO A PRESENTE.', leadingIndent: RECUO, margin: [0, 8, 0, 0] },
      { text: `${d.local}, em ${dataExtenso(d.data)}.`, leadingIndent: RECUO, margin: [0, comTest ? 12 : 16, 0, 0] },
      {
        stack: [
          `LIVRO ${d.livroTipo} ${pad(d.livro, 5)}`,
          `FLS ${pad(d.folha, 3)}`,
          `TERMO Nº ${pad(d.termo, 7)}`,
        ],
        bold: true, fontSize: 10, margin: [0, comTest ? 10 : 20, 0, 0],
      },
      { columns: [{ width: RECUO, text: '' }, assinatura(req, comTest ? 'REQUERENTE' : '', comTest, 320, comTest ? 18 : 30, comTest ? 22 : 26)] },
    ];
    if (comTest) {
      content.push(
        { text: d.motivo, alignment: 'justify', fontSize: 10, margin: [0, 12, 0, 0] },
        // Testemunhas lado a lado, cada uma com duas linhas.
        { columns: [assinatura(d.t1, 'TESTEMUNHA 1', false, 222, 20, 22), assinatura(d.t2, 'TESTEMUNHA 2', false, 222, 20, 22)], columnGap: 20 },
      );
    }
    // Carimbo de certificação no fim, alinhado à direita, com espaço para assinatura.
    content.push({
      unbreakable: true,
      margin: [0, comTest ? 10 : 30, 0, 0],
      columns: [
        { width: '*', text: '' },
        {
          width: 150,
          table: {
            widths: ['*'],
            body: [[{
              stack: [
                { text: 'CERTIFICO E DOU FÉ QUE ESTE DOCUMENTO FOI ASSINADO EM MINHA PRESENÇA.', bold: true, alignment: 'center' },
                { text: `${d.local}, ${dataExtenso(d.data)}.`, alignment: 'center', margin: [0, 2, 0, 0] },
                { canvas: [{ type: 'line', x1: 10, y1: 0, x2: 130, y2: 0, lineWidth: 0.6 }], margin: [0, 16, 0, 0] },
              ],
              fontSize: 6, lineHeight: 1.1, margin: [3, 3, 3, 3],
            }]],
          },
          layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#333', vLineColor: () => '#333' },
        },
      ],
    });

    const cabecalho = [];
    if (imagens.logo) {
      cabecalho.push({
        margin: [40, 18, 40, 0],
        columns: [
          { image: imagens.logo, width: 120 },
          { stack: [
            { text: 'OFICIAL DE REGISTRO CIVIL DAS PESSOAS NATURAIS E DE INTERDIÇÕES E TUTELAS DA SEDE DA COMARCA DE CARAGUATATUBA, ESTADO DE SÃO PAULO',
              alignment: 'center', fontSize: 8.5, bold: true, margin: [0, 8, 0, 6] },
            imagens.oficial ? { image: imagens.oficial, width: 170, alignment: 'center' } : '',
          ] },
        ],
        columnGap: 16,
      });
    }
    // Linha divisória abaixo do cabeçalho
    cabecalho.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.8, lineColor: '#555' }], margin: [40, 8, 40, 0] });

    return {
      pageSize: 'A4',
      pageMargins: [70, 110, 60, 60],
      info: { title: 'Declaração de pobreza', creator: 'Minutas do Registro Civil' },
      header: () => cabecalho,
      footer: () => ({
        margin: [40, 18, 40, 0],
        stack: [
          // Linha divisória acima do rodapé
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.8, lineColor: '#555' }], margin: [0, 0, 0, 6] },
          { text: 'Av. Pernambuco, 150 – Jardim Primavera, Caraguatatuba – SP, CEP 11660-640 – Telefone: (12) 3883-9224',
            alignment: 'center', fontSize: 8, color: '#444' },
        ],
      }),
      defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.15 },
      content,
    };
  }

  function nomeArquivo(d, ext = 'pdf') {
    const base = d.registrado1.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `declaracao-pobreza-${base || 'minuta'}.${ext}`;
  }

  // ---------- Montagem do Word (.docx), com o mesmo layout do PDF ----------
  // Unidades do docx: twips (1 pt = 20) para recuos/espaços; meio-ponto para o tamanho da letra.
  const pt = (n) => Math.round(n * 20);
  let bufImagens = null;
  async function carregarImagensWord() {
    if (!bufImagens) {
      const [logo, oficial] = await Promise.all(['logo', 'oficial'].map((n) => fetch(`img/${n}.png`).then((r) => r.arrayBuffer())));
      bufImagens = { logo, oficial };
    }
    return bufImagens;
  }

  async function documentoWord(d) {
    const X = window.docx;
    const { Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, Header, Footer, TableLayoutType, VerticalAlign } = X;
    const img = await carregarImagensWord();
    const FONTE = 'Arial';
    const LARG = 465; // largura útil (pt), igual ao PDF
    const SEM_BORDA = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const semBordas = { top: SEM_BORDA, bottom: SEM_BORDA, left: SEM_BORDA, right: SEM_BORDA, insideHorizontal: SEM_BORDA, insideVertical: SEM_BORDA };
    const LINHA = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
    const run = (text, o = {}) => new TextRun({ text, font: FONTE, ...o });
    const p = (filhos, o = {}) => new Paragraph({ children: Array.isArray(filhos) ? filhos : [filhos], ...o });

    const tipoCert = CERTIDAO[d.livroTipo];
    const referente = d.livroTipo.startsWith('B') ? `${d.registrado1} E ${d.registrado2}` : d.registrado1;
    const comTest = d.modelo === 'testemunhas';
    const req = Object.assign({}, d.req, { qualidade: d.reqQualidade ? up(d.reqQualidade) : '' });
    const T = 22; // 11 pt

    // Linha de assinatura: parágrafo vazio com borda de baixo, do tamanho pedido.
    const linhaAss = (antes, esquerda, largura, total) => p(run(''), {
      spacing: { before: pt(antes), after: pt(3) },
      indent: { left: pt(esquerda), right: pt(total - esquerda - largura) },
      border: { bottom: LINHA },
    });
    const qualif = (x, rotulo, cpfOpcional, esquerda, larguraTotal, largura) => {
      const o = { indent: { left: pt(esquerda), right: pt(larguraTotal - esquerda - largura) }, spacing: { after: 0 } };
      const t = 19;
      const out = [
        p([run(rotulo ? `${rotulo}: ` : '', { bold: true, size: t }), run(x.nome, { bold: true, size: t }), run(x.qualidade ? ` (${x.qualidade})` : '', { size: t })], o),
      ];
      if (x.cpf || !cpfOpcional) out.push(p(run(`CPF: ${x.cpf}`, { size: t }), o));
      out.push(p(run(`ENDEREÇO: ${enderecoTexto(x)}`, { size: t }), o));
      return out;
    };
    // Separador mínimo: sem ele o Word funde as duas linhas (parágrafos vizinhos com a mesma borda).
    const separador = () => p(run('', { size: 2 }), { spacing: { before: 0, after: 0, line: 20, lineRule: X.LineRuleType.EXACT } });
    const assinaturaW = (x, rotulo, cpfOpcional, esquerda, larguraTotal, largura, espaco, entre, larguraTexto = largura) => [
      linhaAss(espaco, esquerda, largura, larguraTotal),
      separador(),
      linhaAss(entre, esquerda, largura, larguraTotal),
      ...qualif(x, rotulo, cpfOpcional, esquerda, larguraTotal, larguraTexto),
    ];

    const corpo = [
      p(run(d.destinatario, { bold: true, size: 21 }), { spacing: { after: pt(comTest ? 12 : 18) } }),
      p(run('D E C L A R A Ç Ã O', { bold: true, size: 26 }), { alignment: AlignmentType.CENTER, spacing: { before: pt(comTest ? 4 : 14), after: pt(comTest ? 14 : 30) } }),
      p([
        run('DECLARO, PARA TODOS OS FINS E EFEITOS DE DIREITO, NOS TERMOS DO ARTIGO 30, PARÁGRAFOS 1º E 2º, DA LEI Nº 6.015/73, ' +
          'QUE SOU RECONHECIDAMENTE POBRE, NA ACEPÇÃO JURÍDICA CIVIL DO TERMO, NÃO POSSUINDO RECURSOS SUFICIENTES PARA VIVER ' +
          'E MANTER MINHA FAMÍLIA, RAZÃO PELA QUAL NÃO TENHO CONDIÇÕES FINANCEIRAS PARA ARCAR COM AS DESPESAS DECORRENTES DA ' +
          `EXTRAÇÃO DA 2ª VIA DA CERTIDÃO DE ${tipoCert} REFERENTE A `, { size: T }),
        run(referente + '.', { bold: true, size: T }),
        run(' DECLARO, MAIS E FINALMENTE, QUE TENHO REAL CONHECIMENTO DE QUE A FALSIDADE DO SUPRA DECLARADO ' +
          'ACARRETARÁ CONTRA A MINHA PESSOA OS EFEITOS DA RESPONSABILIDADE CIVIL E PENAL.', { size: T }),
      ], { alignment: AlignmentType.JUSTIFIED, indent: { firstLine: pt(RECUO) }, spacing: { line: comTest ? 288 : 324, after: 0 } }),
      p(run('POR SER A EXPRESSÃO DA VERDADE, FIRMO A PRESENTE.', { size: T }), { indent: { firstLine: pt(RECUO) }, spacing: { before: pt(8), after: 0 } }),
      p(run(`${d.local}, em ${dataExtenso(d.data)}.`, { size: T }), { indent: { firstLine: pt(RECUO) }, spacing: { before: pt(comTest ? 12 : 16), after: 0 } }),
      p(run(`LIVRO ${d.livroTipo} ${pad(d.livro, 5)}`, { bold: true, size: 20 }), { spacing: { before: pt(comTest ? 10 : 20), after: 0 } }),
      p(run(`FLS ${pad(d.folha, 3)}`, { bold: true, size: 20 }), { spacing: { after: 0 } }),
      p(run(`TERMO Nº ${pad(d.termo, 7)}`, { bold: true, size: 20 }), { spacing: { after: 0 } }),
      ...assinaturaW(req, comTest ? 'REQUERENTE' : '', comTest, RECUO, LARG, 320, comTest ? 18 : 30, comTest ? 22 : 26, LARG - RECUO),
    ];

    if (comTest) {
      corpo.push(p(run(d.motivo, { size: 20 }),
        { alignment: AlignmentType.JUSTIFIED, spacing: { before: pt(12), after: 0 } }));
      const COL = 222.5;
      const celula = (x, rotulo, margemDir) => new TableCell({
        width: { size: pt(COL), type: WidthType.DXA },
        borders: semBordas,
        margins: { left: 0, right: pt(margemDir), top: 0, bottom: 0 },
        children: assinaturaW(x, rotulo, false, 0, COL - margemDir, COL - margemDir, 20, 22),
      });
      corpo.push(new Table({
        width: { size: pt(LARG), type: WidthType.DXA },
        columnWidths: [pt(COL), pt(COL)],
        layout: TableLayoutType.FIXED,
        borders: semBordas,
        rows: [new TableRow({ cantSplit: true, children: [celula(d.t1, 'TESTEMUNHA 1', 10), celula(d.t2, 'TESTEMUNHA 2', 0)] })],
      }));
    }

    // Carimbo de certificação: caixa pequena à direita.
    const LC = 150;
    corpo.push(p(run(''), { spacing: { before: pt(comTest ? 4 : 24), after: 0 } }));
    corpo.push(new Table({
      width: { size: pt(LC), type: WidthType.DXA },
      columnWidths: [pt(LC)],
      layout: TableLayoutType.FIXED,
      alignment: AlignmentType.RIGHT,
      borders: { top: LINHA, bottom: LINHA, left: LINHA, right: LINHA, insideHorizontal: SEM_BORDA, insideVertical: SEM_BORDA },
      rows: [new TableRow({ cantSplit: true, children: [new TableCell({
        width: { size: pt(LC), type: WidthType.DXA },
        margins: { top: pt(3), bottom: pt(3), left: pt(3), right: pt(3) },
        verticalAlign: VerticalAlign.TOP,
        children: [
          p(run('CERTIFICO E DOU FÉ QUE ESTE DOCUMENTO FOI ASSINADO EM MINHA PRESENÇA.', { bold: true, size: 12 }), { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
          p(run(`${d.local}, ${dataExtenso(d.data)}.`, { size: 12 }), { alignment: AlignmentType.CENTER, spacing: { before: pt(2), after: 0 } }),
          p(run('', { size: 12 }), { spacing: { before: pt(14), after: pt(2) }, indent: { left: pt(10), right: pt(10) }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' } } }),
        ],
      })] })],
    }));

    // Cabeçalho (logo + nome do cartório + Oficial) com linha embaixo; rodapé com linha em cima.
    const cab = new Header({ children: [
      new Table({
        width: { size: pt(LARG), type: WidthType.DXA },
        columnWidths: [pt(136), pt(LARG - 136)],
        layout: TableLayoutType.FIXED,
        borders: semBordas,
        rows: [new TableRow({ children: [
          new TableCell({ width: { size: pt(136), type: WidthType.DXA }, borders: semBordas, verticalAlign: VerticalAlign.CENTER,
            children: [p(new ImageRun({ data: img.logo, transformation: { width: 150, height: 65 } }))] }),
          new TableCell({ width: { size: pt(LARG - 136), type: WidthType.DXA }, borders: semBordas, verticalAlign: VerticalAlign.CENTER, children: [
            p(run('OFICIAL DE REGISTRO CIVIL DAS PESSOAS NATURAIS E DE INTERDIÇÕES E TUTELAS DA SEDE DA COMARCA DE CARAGUATATUBA, ESTADO DE SÃO PAULO', { bold: true, size: 16 }),
              { alignment: AlignmentType.CENTER, spacing: { after: pt(4) } }),
            p(new ImageRun({ data: img.oficial, transformation: { width: 210, height: 29 } }), { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
          ] }),
        ] })],
      }),
      p(run(''), { spacing: { before: 0, after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '555555' } } }),
    ] });
    const rod = new Footer({ children: [
      p(run('Av. Pernambuco, 150 – Jardim Primavera, Caraguatatuba – SP, CEP 11660-640 – Telefone: (12) 3883-9224', { size: 16, color: '444444' }),
        { alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 6, color: '555555', space: 4 } } }),
    ] });

    return new X.Document({
      creator: 'Minutas do Registro Civil',
      title: 'Declaração de pobreza',
      styles: { default: { document: { run: { font: FONTE, size: T } } } },
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: pt(105), bottom: pt(60), left: pt(RECUO), right: pt(60), header: pt(18), footer: pt(20) },
          },
        },
        headers: { default: cab },
        footers: { default: rod },
        children: corpo,
      }],
    });
  }

  async function baixarWord() {
    const { d, erros } = coletar();
    mostrarErros(erros);
    if (erros.length) return;
    const blob = await window.docx.Packer.toBlob(await documentoWord(d));
    marcarGerado();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nomeArquivo(d, 'docx');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  let urlPrevia = null;
  function gerar(acao) {
    const { d, erros } = coletar();
    mostrarErros(erros);
    if (erros.length) return;
    const pdf = pdfMake.createPdf(documento(d));
    marcarGerado();
    if (acao === 'baixar') {
      pdf.download(nomeArquivo(d));
    } else {
      pdf.getBlob((blob) => {
        if (urlPrevia) URL.revokeObjectURL(urlPrevia);
        urlPrevia = URL.createObjectURL(blob);
        $('#quadroPrevia').src = urlPrevia;
        $('#previa').hidden = false;
        $('#previa').scrollIntoView({ behavior: 'smooth' });
      });
    }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); gerar('baixar'); });
  $('#btnVer').addEventListener('click', () => gerar('ver'));
  // Carimbo de cópia: abre o PDF pronto na pré-visualização (para ver e imprimir).
  $('#btnCarimbo').addEventListener('click', () => {
    $('#quadroPrevia').src = 'modelos/carimbo-copia-extraida-do-original.pdf';
    $('#previa').hidden = false;
    $('#previa').scrollIntoView({ behavior: 'smooth' });
  });
  $('#btnWord').addEventListener('click', () => {
    baixarWord().catch(() => alert('Não foi possível gerar o arquivo do Word. Tente de novo ou baixe o PDF.'));
  });
  // ---------- Proteção contra livro errado: minuta nova zera o tipo de livro ----------
  // Depois de gerar um documento, se o nome do registrado mudar, é outra minuta:
  // o tipo de livro volta para "Selecione" e livro/folha/termo são apagados.
  const semAc = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  let nomeGerado = null;
  function marcarGerado() { nomeGerado = semAc(v('registrado1')); avisoLivro(false); }
  function avisoLivro(mostrar) { $('#avisoLivro').hidden = !mostrar; }
  function zerarLivro() {
    campo('livroTipo').value = '';
    ['livro', 'folha', 'termo'].forEach((n) => { campo(n).value = ''; });
    atualizarLivro();
    avisoLivro(true);
  }
  campo('registrado1').addEventListener('change', () => {
    if (nomeGerado !== null && semAc(v('registrado1')) !== nomeGerado) {
      nomeGerado = null;
      zerarLivro();
    }
  });
  campo('livroTipo').addEventListener('change', () => { if (campo('livroTipo').value) avisoLivro(false); });

  function limparTudo() {
    form.reset();
    form.querySelectorAll('.invalido').forEach((e) => e.classList.remove('invalido'));
    form.querySelectorAll('[data-campo="cepStatus"]').forEach((e) => { e.textContent = ''; });
    ultimoCEP = {};
    $('#data').value = hojeISO();
    if (abaAtual === 'pobreza') {
      if (urlPrevia) { URL.revokeObjectURL(urlPrevia); urlPrevia = null; }
      $('#quadroPrevia').removeAttribute('src');
      $('#previa').hidden = true;
      window.scrollTo(0, 0);
    }
    $('#erros').hidden = true;
    if (base) { selUF.value = 'SP'; cidadeAtual = null; preencherCidades(); }
    txtDest.value = '';
    atualizarModelo(); atualizarLivro(); atualizarMotivo(true);
    nomeGerado = null; avisoLivro(false);
  }
  $('#btnLimpar').addEventListener('click', () => {
    if (!confirm('Apagar tudo o que foi preenchido?')) return;
    limparTudo();
    window.scrollTo(0, 0);
    $('#avisoInatividade').hidden = true;
  });

  // ---------- Abas (escolha da minuta) ----------
  let abaAtual = 'pobreza';
  function mostrarAba(nome) {
    abaAtual = nome;
    document.querySelectorAll('.aba').forEach((b) => b.classList.toggle('ativa', b.dataset.minuta === nome));
    form.hidden = nome !== 'pobreza';
    $('#abaInteiro').hidden = nome !== 'inteiro';
    if (urlPrevia) { URL.revokeObjectURL(urlPrevia); urlPrevia = null; }
    $('#quadroPrevia').removeAttribute('src');
    $('#previa').hidden = true;
    $('#avisoInatividade').hidden = true;
  }
  document.querySelectorAll('.aba').forEach((b) => b.addEventListener('click', () => mostrarAba(b.dataset.minuta)));

  // ---------- Requerimento de inteiro teor (formulário em PDF + cartório de destino) ----------
  const itUF = $('#itUf'), itTexto = $('#itTexto');
  let itCidade = null;
  const itComboCartorio = criarCombo($('#itComboCartorio'), {
    vazio: 'Escolha a cidade primeiro',
    aoEscolher: (it) => montarTextoInteiro(it),
  });
  const itComboCidade = criarCombo($('#itComboCidade'), {
    vazio: 'Selecione',
    aoEscolher: (it) => { itCidade = it ? it.valor : null; preencherCartoriosInteiro(); },
  });
  function iniciarInteiro() {
    if (itUF.options.length) return;
    Object.keys(base.uf).forEach((uf) => itUF.add(new Option(uf, uf, uf === 'SP', uf === 'SP')));
    preencherCidadesInteiro();
  }
  function preencherCidadesInteiro() {
    if (!base) return;
    itCidade = null;
    itComboCidade.definirItens(Object.keys(base.uf[itUF.value] || {}).map((c) => ({ valor: c, rotulo: c })), 'Selecione');
  }
  function preencherCartoriosInteiro() {
    itTexto.value = '';
    if (!itCidade) { itComboCartorio.definirItens([], 'Escolha a cidade primeiro'); return; }
    const lista = base.uf[itUF.value][itCidade];
    const itens = lista.map(([cns, resumo, nome]) => ({ valor: cns, rotulo: `${cns} - ${itCidade}${resumo ? ` - ${resumo}` : ''}`, detalhe: nome, resumo, nome }));
    itens.push(OUTRO);
    itComboCartorio.definirItens(itens, 'Selecione');
    if (lista.length === 1) itComboCartorio.escolherValor(lista[0][0]);
  }
  function montarTextoInteiro(it) {
    if (!it) { itTexto.value = ''; return; }
    if (it.valor === 'outro') { itTexto.value = ''; itTexto.focus(); return; }
    const uf = itUF.value;
    const cid = itCidade.toLocaleUpperCase('pt-BR');
    const sozinho = base.uf[uf][itCidade].length === 1;
    if (it.resumo) itTexto.value = `${cid}/${uf} – ${it.resumo.toLocaleUpperCase('pt-BR')}`;
    else if (sozinho) itTexto.value = `${cid}/${uf}`;
    else itTexto.value = `${cid}/${uf} – ${it.nome.toLocaleUpperCase('pt-BR')}`;
  }
  itUF.addEventListener('change', preencherCidadesInteiro);

  // Fonte padrão do PDF só tem caracteres latinos: troca o que não couber.
  const latino = (s) => s.normalize('NFC').replace(/[‐‑‒—]/g, '–').replace(/[^\x20-\x7E -ÿ–]/g, '');
  async function gerarInteiro(acao) {
    const caixa = $('#itErros');
    const texto = latino(itTexto.value.trim().toLocaleUpperCase('pt-BR').replace(/\s+/g, ' '));
    if (!texto) {
      caixa.innerHTML = '<b>Falta escolher o cartório</b> (ou escrever o texto da linha "DA COMARCA DE").';
      caixa.hidden = false; itTexto.classList.add('invalido');
      return;
    }
    caixa.hidden = true; itTexto.classList.remove('invalido');
    const { PDFDocument, StandardFonts } = window.PDFLib;
    const modelo = await fetch('modelos/requerimento-inteiro-teor.pdf').then((r) => r.arrayBuffer());
    const pdf = await PDFDocument.create();
    pdf.setTitle('Requerimento de inteiro teor'); pdf.setCreator('Minutas do Registro Civil'); pdf.setProducer('Minutas do Registro Civil');
    const [pg] = await pdf.embedPdf(modelo, [0]);
    // Reduz a folha original (maior que A4) para caber inteira numa folha A4.
    const A4 = [595.28, 841.89];
    const esc = Math.min(A4[0] / pg.width, A4[1] / pg.height);
    const ox = (A4[0] - pg.width * esc) / 2, oy = (A4[1] - pg.height * esc) / 2;
    const folha = pdf.addPage(A4);
    folha.drawPage(pg, { x: ox, y: oy, width: pg.width * esc, height: pg.height * esc });
    // Linha "DA COMARCA DE ____": começa logo depois do texto (x≈351) e vai até x≈765 no original.
    const fonte = await pdf.embedFont(StandardFonts.HelveticaBold);
    const X0 = 358, Y0 = 1188, LARG = 405;
    let tam = 17;
    while (tam > 7 && fonte.widthOfTextAtSize(texto, tam) > LARG) tam -= 0.5;
    folha.drawText(texto, { x: ox + X0 * esc, y: oy + Y0 * esc, size: tam * esc, font: fonte });
    const blob = new Blob([await pdf.save()], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    if (acao === 'baixar') {
      const a = document.createElement('a');
      const cid = (itCidade || 'cartorio').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      a.href = url; a.download = `requerimento-inteiro-teor-${cid}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } else {
      if (urlPrevia) URL.revokeObjectURL(urlPrevia);
      urlPrevia = url;
      $('#quadroPrevia').src = url;
      $('#previa').hidden = false;
      $('#previa').scrollIntoView({ behavior: 'smooth' });
    }
  }
  const avisarErro = () => alert('Não foi possível gerar o PDF. Tente de novo.');
  $('#itVer').addEventListener('click', () => gerarInteiro('ver').catch(avisarErro));
  $('#itBaixar').addEventListener('click', () => gerarInteiro('baixar').catch(avisarErro));
  function limparInteiro() {
    if (base) { itUF.value = 'SP'; preencherCidadesInteiro(); }
    itComboCartorio.definirItens([], 'Escolha a cidade primeiro');
    itTexto.value = ''; itTexto.classList.remove('invalido');
    $('#itErros').hidden = true;
    if (abaAtual === 'inteiro') {
      if (urlPrevia) { URL.revokeObjectURL(urlPrevia); urlPrevia = null; }
      $('#quadroPrevia').removeAttribute('src');
      $('#previa').hidden = true;
    }
  }
  $('#itLimpar').addEventListener('click', () => {
    if (!confirm('Apagar o que foi preenchido?')) return;
    limparInteiro(); window.scrollTo(0, 0);
  });

  // ---------- Limpeza automática por falta de uso ----------
  // Declaração de pobreza: 10 minutos. Minutas novas (inteiro teor e as próximas): 40 minutos.
  const LIMITE_INATIVO = 10 * 60 * 1000;
  const LIMITE_INATIVO_NOVAS = 40 * 60 * 1000;
  let ultimaAtividade = Date.now();
  const marcarAtividade = () => { ultimaAtividade = Date.now(); };
  ['input', 'change', 'keydown', 'pointerdown', 'wheel', 'touchstart'].forEach((ev) => document.addEventListener(ev, marcarAtividade, { passive: true, capture: true }));
  function temAlgoPreenchido() {
    return [...form.elements].some((el) => {
      if (!el.name || el.type === 'radio' || el.type === 'date' || el.tagName === 'SELECT') return false;
      if (['localAssinatura', 'motivoTexto'].includes(el.name)) return false;
      return el.value.trim() !== '';
    });
  }
  let pobrezaLimpa = false, inteiroLimpo = false;
  const marcarSujo = () => { pobrezaLimpa = false; inteiroLimpo = false; };
  ['input', 'change', 'keydown', 'pointerdown'].forEach((ev) => document.addEventListener(ev, marcarSujo, { passive: true, capture: true }));
  function verificarInatividade() {
    const parado = Date.now() - ultimaAtividade;
    let limpou = false;
    if (parado >= LIMITE_INATIVO && !pobrezaLimpa) {
      pobrezaLimpa = true;
      if (temAlgoPreenchido() || (abaAtual === 'pobreza' && !$('#previa').hidden)) { limparTudo(); limpou = abaAtual === 'pobreza'; }
    }
    if (parado >= LIMITE_INATIVO_NOVAS && !inteiroLimpo) {
      inteiroLimpo = true;
      if (itTexto.value.trim() || itCidade || (abaAtual === 'inteiro' && !$('#previa').hidden)) { limparInteiro(); limpou = limpou || abaAtual === 'inteiro'; }
    }
    if (limpou) $('#avisoInatividade').hidden = false;
  }
  setInterval(verificarInatividade, 30 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) verificarInatividade(); });
  $('#avisoInatividade').addEventListener('click', () => { $('#avisoInatividade').hidden = true; });

  // Ao recarregar, o navegador pode repor valores antigos: começa sempre limpo.
  window.addEventListener('pageshow', () => { form.reset(); $('#data').value = hojeISO(); atualizarModelo(); atualizarLivro(); atualizarMotivo(true); });
  atualizarModelo();
  atualizarLivro();
  atualizarMotivo(true);
})();
