/* Minutas novas: retificação, alteração de prenome e alteração de sobrenome.
   Tudo no navegador, nada é gravado. Sem papel timbrado; terminam com a certificação de quem atende. */
(function () {
  'use strict';
  const B = window.MinutasBase;
  if (!B) {
    // Página nova com arquivo antigo em cache: avisa em vez de deixar a aba vazia.
    document.querySelectorAll('.minuta-nova').forEach((s) => {
      s.innerHTML = '<p class="erros">O site foi atualizado e o navegador ainda está com a versão antiga. Aperte <b>Ctrl+F5</b> para recarregar.</p>';
    });
    return;
  }
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  const up = (s) => (s || '').toLocaleUpperCase('pt-BR');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const limpo = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
  function idade(iso) {
    if (!iso) return null;
    const [a, m, d] = iso.split('-').map(Number);
    const h = new Date();
    let i = h.getFullYear() - a;
    if (h.getMonth() + 1 < m || (h.getMonth() + 1 === m && h.getDate() < d)) i--;
    return i;
  }
  function diasDesde(iso) {
    if (!iso) return null;
    return Math.floor((Date.now() - new Date(iso + 'T12:00:00').getTime()) / 86400000);
  }

  // =====================================================================
  // Peças de formulário reutilizáveis
  // =====================================================================
  const ESTADOS_CIVIS = [
    ['solteiro', 'solteiro(a)', 'solteiro', 'solteira'],
    ['casado', 'casado(a)', 'casado', 'casada'],
    ['divorciado', 'divorciado(a)', 'divorciado', 'divorciada'],
    ['viuvo', 'viúvo(a)', 'viúvo', 'viúva'],
    ['separado', 'separado(a) judicialmente', 'separado judicialmente', 'separada judicialmente'],
    ['convivente', 'convivente em união estável', 'convivente em união estável', 'convivente em união estável'],
  ];
  const CARGOS = ['Escrevente', 'Escrevente Substituto', 'Oficial Substituto', 'Oficial'];

  // Bloco de qualificação de uma pessoa. "completo" inclui nascimento, naturalidade e filiação.
  function blocoPessoa(raiz, prefixo, { titulo, completo = true, telefone = true, sexo = true } = {}) {
    const n = (c) => `${prefixo}_${c}`;
    raiz.insertAdjacentHTML('beforeend', `
      ${titulo ? `<h3>${titulo}</h3>` : ''}
      <div class="grade g2">
        <label>Nome completo <input data-c="nome"></label>
        ${sexo ? `<label>Sexo (só para a concordância do texto)
          <select data-c="sexo"><option value="" selected>Selecione</option><option value="M">Masculino</option><option value="F">Feminino</option></select></label>` : ''}
      </div>
      <div class="grade g4">
        <label>Nacionalidade <input data-c="nacionalidade" value="brasileira"></label>
        <label>Estado civil <select data-c="estadoCivil"><option value="" selected>Selecione</option>
          ${ESTADOS_CIVIS.map((e) => `<option value="${e[0]}">${e[1]}</option>`).join('')}</select></label>
        <label>Profissão <input data-c="profissao"></label>
        <label>CPF <input data-c="cpf" inputmode="numeric" maxlength="14" placeholder="000.000.000-00"></label>
      </div>
      <div class="grade g4">
        <label>RG nº <input data-c="rg"></label>
        <label>Órgão emissor <input data-c="rgOrgao" value="SSP/SP"></label>
        ${completo ? `<label>Data de nascimento <input type="date" data-c="nascimento"></label>
        <label>Naturalidade (cidade/UF) <input data-c="naturalidade" placeholder="ex.: Caraguatatuba/SP"></label>` : ''}
      </div>
      ${completo ? `<div class="grade g2">
        <label>Nome do pai <input data-c="pai"></label>
        <label>Nome da mãe <input data-c="mae"></label>
      </div>` : ''}
      <div class="grade g-end1">
        <label>CEP <input data-c="cep" inputmode="numeric" maxlength="9" placeholder="00000-000"><small data-c="cepStatus" class="dica"></small></label>
        <label>Número <input data-c="numero"></label>
        <label>Complemento <input data-c="complemento" placeholder="opcional"></label>
        ${telefone ? '<label>Telefone <input data-c="telefone" inputmode="tel"></label>' : '<span></span>'}
      </div>
      <div class="grade g-end2">
        <label>Rua / logradouro <input data-c="logradouro"></label>
        <label>Bairro <input data-c="bairro"></label>
        <label>Cidade <input data-c="cidade"></label>
        <label>UF <input data-c="uf" maxlength="2"></label>
      </div>`);
    const el = (c) => raiz.querySelector(`[data-c="${c}"][data-p="${prefixo}"]`) || null;
    // marca os campos deste bloco
    raiz.querySelectorAll('[data-c]:not([data-p])').forEach((e) => { e.dataset.p = prefixo; e.name = n(e.dataset.c); });
    const cpf = el('cpf');
    cpf.addEventListener('input', () => { cpf.value = B.mascaraCPF(cpf.value); cpf.classList.remove('invalido'); });
    cpf.addEventListener('blur', () => { if (cpf.value && !B.cpfValido(cpf.value)) cpf.classList.add('invalido'); });
    const cep = el('cep'), status = el('cepStatus');
    let ultimo = null;
    cep.addEventListener('input', async () => {
      cep.value = B.mascaraCEP(cep.value);
      const d = cep.value.replace(/\D/g, '');
      if (d.length !== 8) { status.textContent = ''; return; }
      if (d === ultimo) return;
      ultimo = d; status.textContent = 'Buscando endereço…';
      try {
        const j = await fetch(`https://viacep.com.br/ws/${d}/json/`, { referrerPolicy: 'no-referrer', cache: 'no-store' }).then((r) => r.json());
        if (j.erro) throw new Error();
        el('logradouro').value = j.logradouro || ''; el('bairro').value = j.bairro || '';
        el('cidade').value = j.localidade || ''; el('uf').value = j.uf || '';
        status.textContent = j.logradouro ? 'Endereço preenchido. Falta o número.' : 'CEP geral da cidade: digite rua e bairro.';
        (j.logradouro ? el('numero') : el('logradouro')).focus();
      } catch (e) { ultimo = null; status.textContent = 'CEP não encontrado. Preencha o endereço à mão.'; }
    });
    const v = (c) => (el(c) ? limpo(el(c).value) : '');
    return {
      el,
      ler() {
        return {
          nome: up(v('nome')), sexo: v('sexo'), nacionalidade: v('nacionalidade'), estadoCivil: v('estadoCivil'),
          profissao: v('profissao'), cpf: v('cpf'), rg: v('rg'), rgOrgao: v('rgOrgao'), nascimento: v('nascimento'),
          naturalidade: v('naturalidade'), pai: up(v('pai')), mae: up(v('mae')), telefone: v('telefone'),
          logradouro: v('logradouro'), numero: v('numero'), complemento: v('complemento'), bairro: v('bairro'),
          cidade: v('cidade'), uf: up(v('uf')),
        };
      },
      limpar() { ultimo = null; status.textContent = ''; },
      // exigidos: lista de campos obrigatórios
      validar(erros, rotulo, exigidos) {
        exigidos.forEach((c) => {
          const e = el(c);
          if (e && !limpo(e.value)) { erros.push(`${rotulo}: ${e.closest('label') ? e.closest('label').firstChild.textContent.trim() : c}`); e.classList.add('invalido'); }
        });
        if (v('cpf') && !B.cpfValido(v('cpf'))) { erros.push(`${rotulo}: CPF inválido (confira os números)`); el('cpf').classList.add('invalido'); }
      },
    };
  }

  // Concordância de gênero
  const gx = (sexo, m, f) => (sexo === 'F' ? f : sexo === 'M' ? m : `${m}(a)`);
  function estadoCivilTexto(cod, sexo) {
    const e = ESTADOS_CIVIS.find((x) => x[0] === cod);
    if (!e) return '';
    return sexo === 'F' ? e[3] : sexo === 'M' ? e[2] : e[1];
  }
  function enderecoTexto(x) {
    let s = x.logradouro;
    if (!s) return '';
    if (x.numero) s += `, ${x.numero}`;
    if (x.complemento) s += `, ${x.complemento}`;
    if (x.bairro) s += ` - ${x.bairro}`;
    if (x.cidade) s += `, ${x.cidade}`;
    if (x.uf) s += ` - ${x.uf}`;
    return s;
  }
  // Qualificação em texto corrido, no padrão dos modelos do cartório.
  function qualificacao(x, { completo = true } = {}) {
    const g = (m, f) => gx(x.sexo, m, f);
    const partes = [];
    if (x.nacionalidade) partes.push(`nacionalidade ${x.nacionalidade}`);
    const ec = estadoCivilTexto(x.estadoCivil, x.sexo); if (ec) partes.push(ec);
    if (x.profissao) partes.push(x.profissao);
    if (x.rg) partes.push(`${g('portador', 'portadora')} da cédula de identidade RG nº ${x.rg}${x.rgOrgao ? ` ${x.rgOrgao}` : ''}`);
    if (x.cpf) partes.push(`${g('inscrito', 'inscrita')} no CPF/MF sob o nº ${x.cpf}`);
    if (completo && x.naturalidade) partes.push(`natural de ${x.naturalidade}`);
    if (completo && x.nascimento) partes.push(`${g('nascido', 'nascida')} aos ${dataBR(x.nascimento)}`);
    if (completo && (x.pai || x.mae)) partes.push(`${g('filho', 'filha')} de ${[x.pai, x.mae].filter(Boolean).join(' e ')}`);
    const end = enderecoTexto(x); if (end) partes.push(`${g('residente e domiciliado', 'residente e domiciliada')} à ${end}`);
    if (x.telefone) partes.push(`telefone ${x.telefone}`);
    return partes.join(', ');
  }

  // Cartório de destino (estado, cidade e cartório, com pesquisa) + texto do destinatário.
  function blocoDestino(raiz, id) {
    raiz.insertAdjacentHTML('beforeend', `
      <fieldset>
        <legend>Cartório onde está o registro (destino)</legend>
        <div class="grade g-destino">
          <label>Estado <select id="${id}Uf"></select></label>
          <div class="rotulo">Cidade <div class="combo" id="${id}Cidade"></div></div>
          <div class="rotulo">Cartório <div class="combo" id="${id}Cartorio"></div></div>
        </div>
        <label>Endereçamento (como sai no documento – pode corrigir)
          <textarea id="${id}Dest" rows="2"></textarea></label>
      </fieldset>`);
    const selUF = $(`#${id}Uf`), dest = $(`#${id}Dest`);
    let cidade = null;
    const comboCart = B.criarCombo($(`#${id}Cartorio`), { vazio: 'Escolha a cidade primeiro', aoEscolher: (it) => montar(it) });
    const comboCid = B.criarCombo($(`#${id}Cidade`), { vazio: 'Selecione', aoEscolher: (it) => { cidade = it ? it.valor : null; cartorios(); } });
    function cidades() {
      const base = B.base(); if (!base) return;
      cidade = null;
      comboCid.definirItens(Object.keys(base.uf[selUF.value] || {}).map((c) => ({ valor: c, rotulo: c })), 'Selecione');
    }
    function cartorios() {
      dest.value = '';
      if (!cidade) { comboCart.definirItens([], 'Escolha a cidade primeiro'); return; }
      const lista = B.base().uf[selUF.value][cidade];
      const itens = lista.map(([cns, resumo, nome]) => ({ valor: cns, rotulo: `${cns} - ${cidade}${resumo ? ` - ${resumo}` : ''}`, detalhe: nome, resumo, nome }));
      itens.push(B.OUTRO);
      comboCart.definirItens(itens, 'Selecione');
      if (lista.length === 1) comboCart.escolherValor(lista[0][0]);
    }
    function montar(it) {
      if (!it) { dest.value = ''; return; }
      if (it.valor === 'outro') { dest.value = 'ILMO(A). SR(A). OFICIAL DE REGISTRO CIVIL DAS PESSOAS NATURAIS DE '; dest.focus(); return; }
      const uf = selUF.value, cid = up(cidade);
      const sozinho = B.base().uf[uf][cidade].length === 1;
      let alvo;
      if (it.resumo) alvo = `${cid}/${uf} – ${up(it.resumo)}`;
      else if (sozinho) alvo = `${cid}/${uf}`;
      else alvo = `${cid}/${uf} – ${up(it.nome)}`;
      dest.value = `ILMO(A). SR(A). OFICIAL DE REGISTRO CIVIL DAS PESSOAS NATURAIS DE ${alvo}`;
    }
    selUF.addEventListener('change', cidades);
    B.quandoCarregarBase((base) => {
      if (selUF.options.length) return;
      Object.keys(base.uf).forEach((uf) => selUF.add(new Option(uf, uf, uf === 'SP', uf === 'SP')));
      cidades();
    });
    return {
      texto: () => up(limpo(dest.value)),
      cidade: () => cidade,
      limpar() { selUF.value = 'SP'; cidades(); comboCart.definirItens([], 'Escolha a cidade primeiro'); dest.value = ''; },
      temDados: () => !!(cidade || dest.value.trim()),
      el: dest,
    };
  }

  // Local, data e quem certifica (nome + cargo).
  function blocoFechamento(raiz, id) {
    raiz.insertAdjacentHTML('beforeend', `
      <fieldset>
        <legend>Local, data e certificação</legend>
        <div class="grade g2">
          <label>Cidade <input id="${id}Local" value="CARAGUATATUBA"></label>
          <label>Data <input type="date" id="${id}Data"></label>
        </div>
        <div class="grade g-cert">
          <label>Escrevente <input id="${id}Esc"></label>
          <label>Cargo <select id="${id}Cargo"><option value="" selected>Selecione</option>
            ${CARGOS.map((c) => `<option>${c}</option>`).join('')}</select></label>
          <label>Selo (opcional) <input id="${id}Selo" placeholder="em branco = linha para preencher à mão"></label>
        </div>
      </fieldset>`);
    const data = $(`#${id}Data`); data.value = B.hojeISO();
    return {
      ler: () => ({ local: up(limpo($(`#${id}Local`).value)), data: data.value, escrevente: limpo($(`#${id}Esc`).value), cargo: $(`#${id}Cargo`).value, selo: up(limpo($(`#${id}Selo`).value)) }),
      validar(erros) {
        [[`#${id}Local`, 'Cidade da assinatura'], [`#${id}Data`, 'Data'], [`#${id}Esc`, 'Escrevente'], [`#${id}Cargo`, 'Cargo de quem certifica']].forEach(([s, r]) => {
          if (!limpo($(s).value)) { erros.push(r); $(s).classList.add('invalido'); }
        });
      },
      reiniciarData() { data.value = B.hojeISO(); $(`#${id}Local`).value = 'CARAGUATATUBA'; },
    };
  }

  function botoes(raiz, id) {
    raiz.insertAdjacentHTML('beforeend', `
      <div id="${id}Erros" class="erros" role="alert" hidden></div>
      <div class="acoes">
        <button type="button" class="sec" data-acao="ver">Pré-visualizar</button>
        <button type="button" class="pri" data-acao="pdf">Baixar PDF</button>
        <button type="button" class="sec" data-acao="word">Baixar Word (editável)</button>
        <button type="button" class="perigo" data-acao="limpar">Nova minuta (limpar)</button>
      </div>`);
  }
  function mostrarErros(raiz, id, erros) {
    const c = $(`#${id}Erros`);
    if (!erros.length) { c.hidden = true; return false; }
    c.innerHTML = '<b>Falta preencher ou corrigir:</b><ul>' + erros.map((e) => `<li>${esc(e)}</li>`).join('') + '</ul>';
    c.hidden = false;
    const p = raiz.querySelector('.invalido'); if (p) p.focus();
    return true;
  }

  // =====================================================================
  // Documento genérico → PDF (pdfmake) e Word (docx)
  // Blocos: {p:[runs], al, ind, esqBloco, antes, depois, tam, neg} | {ass:{nome, linhas, larg, centro}} | {lado:[ass, ass]} | {grupo:[...]}
  // run: 'texto' (os nomes da lista NOMES saem em negrito sozinhos) ou {t, b}
  // =====================================================================
  const R = (t, b) => ({ t, b: !!b });
  const LARG_UTIL = 475; // largura útil do A4 com as margens usadas (pt)
  const MARGENS = { esq: 65, dir: 55, cima: 42, baixo: 40 };
  const RECUO = 70; // recuo da primeira linha, como nos modelos do cartório
  let NOMES = [];
  // Quebra o texto e põe em negrito os nomes conhecidos (requerente, registrados, pais...).
  function partes(rs) {
    const nomes = [...new Set(NOMES.filter((n) => n && n.length > 2))].sort((a, b) => b.length - a.length);
    const re = nomes.length ? new RegExp('(' + nomes.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g') : null;
    const out = [];
    rs.forEach((r) => {
      if (typeof r !== 'string') { out.push(r); return; }
      if (!re) { out.push({ t: r, b: false }); return; }
      r.split(re).forEach((s, i) => { if (s) out.push({ t: s, b: i % 2 === 1 }); });
    });
    return out;
  }

  function pdfDoc(titulo, blocos) {
    const runs = (rs, neg) => partes(rs).map((r) => ({ text: r.t, bold: !!(neg || r.b) }));
    const assin = (a) => {
      const larg = a.larg || 320, al = a.centro ? 'center' : 'left';
      const st = [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: larg, y2: 0, lineWidth: 0.8 }], margin: [0, a.antes || 26, 0, 2] },
        { text: runs(a.nome, a.neg), fontSize: a.tam || 10, alignment: al },
        ...(a.linhas || []).map((l) => ({ text: runs(l), fontSize: (a.tam || 10) - 0.5, alignment: al })),
      ];
      if (a.centro) return { columns: [{ width: '*', text: '' }, { width: larg, stack: st }, { width: '*', text: '' }], unbreakable: true };
      return { stack: st, unbreakable: true };
    };
    const render = (b) => {
      if (b.grupo) return { stack: b.grupo.map(render), unbreakable: true };
      if (b.espaco) return { text: '', margin: [0, b.espaco, 0, 0] };
      if (b.ass) return assin(b.ass);
      if (b.lado) return { columns: b.lado.map(assin), columnGap: 20, unbreakable: true };
      return {
        text: runs(b.p, b.neg), alignment: { j: 'justify', c: 'center', e: 'left', d: 'right' }[b.al || 'j'],
        leadingIndent: b.ind || 0, margin: [b.esqBloco || 0, b.antes || 0, 0, b.depois == null ? 4 : b.depois], fontSize: b.tam || 10.5,
        lineHeight: b.lh || 1.15,
      };
    };
    return {
      pageSize: 'A4', pageMargins: [MARGENS.esq, MARGENS.cima, MARGENS.dir, MARGENS.baixo],
      info: { title: titulo, creator: 'Minutas do Registro Civil' },
      defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.2 }, content: blocos.map(render),
    };
  }

  function wordDoc(titulo, blocos) {
    const X = window.docx;
    const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, TableLayoutType } = X;
    const pt = (n) => Math.round(n * 20);
    const F = 'Arial';
    const SB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const sem = { top: SB, bottom: SB, left: SB, right: SB, insideHorizontal: SB, insideVertical: SB };
    const runs = (rs, tam, neg) => partes(rs).map((r) => new TextRun({ text: r.t, bold: !!(neg || r.b), font: F, size: Math.round(tam * 2) }));
    const AL = { j: AlignmentType.JUSTIFIED, c: AlignmentType.CENTER, e: AlignmentType.LEFT, d: AlignmentType.RIGHT };
    const assin = (a, total) => {
      const larg = a.larg || 320, tam = a.tam || 10;
      const esq = a.centro ? Math.max(0, (total - larg) / 2) : 0;
      const ind = { left: pt(esq), right: pt(Math.max(0, total - esq - larg)) };
      const al = a.centro ? AlignmentType.CENTER : AlignmentType.LEFT;
      return [
        new Paragraph({ children: [new TextRun({ text: '', font: F })], spacing: { before: pt(a.antes || 26), after: pt(2) }, indent: ind, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } } }),
        new Paragraph({ children: runs(a.nome, tam, a.neg), spacing: { after: 0 }, alignment: al }),
        ...(a.linhas || []).map((l) => new Paragraph({ children: runs(l, tam - 0.5), spacing: { after: 0 }, alignment: al })),
      ];
    };
    const filhos = [];
    const lista = [];
    blocos.forEach((b) => { if (b.grupo) lista.push(...b.grupo); else lista.push(b); });
    lista.forEach((b) => {
      if (b.espaco) { filhos.push(new Paragraph({ children: [], spacing: { before: pt(b.espaco), after: 0 } })); return; }
      if (b.ass) { filhos.push(...assin(b.ass, LARG_UTIL)); return; }
      if (b.lado) {
        const col = (LARG_UTIL - 20) / 2;
        filhos.push(new Table({
          width: { size: pt(LARG_UTIL), type: WidthType.DXA }, columnWidths: [pt(col + 20), pt(col)], layout: TableLayoutType.FIXED, borders: sem,
          rows: [new TableRow({ cantSplit: true, children: b.lado.map((a, i) => new TableCell({
            width: { size: pt(i === 0 ? col + 20 : col), type: WidthType.DXA }, borders: sem,
            margins: { left: 0, right: pt(i === 0 ? 20 : 0), top: 0, bottom: 0 },
            children: assin(Object.assign({}, a, { centro: false, larg: Math.min(a.larg || col, col) }), col),
          })) })],
        }));
        return;
      }
      const tam = b.tam || 10.5;
      filhos.push(new Paragraph({
        children: runs(b.p, tam, b.neg), alignment: AL[b.al || 'j'],
        indent: { firstLine: pt(b.ind || 0), left: pt(b.esqBloco || 0) },
        spacing: { before: pt(b.antes || 0), after: pt(b.depois == null ? 4 : b.depois), line: Math.round((b.lh || 1.15) * 240) },
      }));
    });
    return new X.Document({
      creator: 'Minutas do Registro Civil', title: titulo,
      styles: { default: { document: { run: { font: F, size: 22 } } } },
      sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: pt(MARGENS.cima), bottom: pt(MARGENS.baixo), left: pt(MARGENS.esq), right: pt(MARGENS.dir) } } }, children: filhos }],
    });
  }

  // Peças de texto comuns
  const titulo = (t) => ({ p: [t], al: 'e', antes: 8, depois: 2 });           // "I – REQUERENTE:" (sem negrito)
  const enderecamento = (t) => ({ p: [t], al: 'j', neg: true, depois: 12 });  // endereçamento em negrito
  // Texto de caixa editável → parágrafos. Linhas que começam com espaço/tab saem recuadas como item.
  function paragrafosDe(texto) {
    return texto.split(/\r?\n/).filter((l) => l.trim()).map((l) => (/^[\t ]{2,}|^\t/.test(l)
      ? { p: [l.trim()], esqBloco: 40, depois: 3 }
      : { p: [l.trim()], ind: RECUO }));
  }

  // Final comum: local/data centralizados, assinatura(s) centralizada(s) e certificação.
  function fechamentoBlocos(f, assinaturas, { docsOriginais = false } = {}) {
    const bl = [{ p: [`${f.local}, ${B.dataExtenso(f.data)}.`], al: 'c', antes: 10, depois: 0 }];
    assinaturas.forEach((a) => bl.push(a));
    // A certificação e a assinatura de quem certifica ficam sempre juntas na mesma página.
    bl.push({ grupo: [
      { p: [R('CERTIFICO E DOU FÉ', true), ' que a assinatura supra foi lançada em minha presença.' + (docsOriginais ? ' Certifico ainda que todos os documentos anexados foram extraídos dos originais.' : '')], antes: 14, depois: 0, tam: 9.5 },
      { ass: { nome: [`${f.escrevente} – ${f.cargo}`], linhas: [[`SELO: ${f.selo || '______________________________'}`]], larg: 300, antes: 24, tam: 9.5, centro: true } },
    ] });
    return bl;
  }
  const assinaturaCentro = (nome, linhas) => ({ ass: { nome: [nome], linhas: linhas || [], larg: 320, centro: true, neg: true } });

  function nomeArquivo(prefixo, nome, ext) {
    const b = (nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${prefixo}-${b || 'minuta'}.${ext}`;
  }
  async function entregar(acao, r) {
    NOMES = r.nomes || [];
    if (acao === 'word') {
      const blob = await window.docx.Packer.toBlob(wordDoc(r.titulo, r.blocos));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = r.arquivo + '.docx';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return;
    }
    const pdf = pdfMake.createPdf(pdfDoc(r.titulo, r.blocos));
    if (acao === 'pdf') pdf.download(r.arquivo + '.pdf');
    else pdf.getBlob((blob) => B.mostrarPdf(blob));
  }

  // Caixa "texto que vai sair (pode editar)": montada sozinha; depois de editada, não é mais trocada.
  function blocoTexto(raiz, id, legenda) {
    raiz.insertAdjacentHTML('beforeend', `
      <fieldset class="texto-editavel"><legend>${legenda}</legend>
        <p class="dica">O texto é montado sozinho com os dados preenchidos. Pode editar à vontade: depois de editado, o site não troca mais.
          Linhas que começam com espaço saem recuadas, como item. Os nomes saem em negrito no documento.</p>
        <textarea id="${id}" rows="9"></textarea>
        <div class="acoes-crc"><button type="button" class="sec mini" id="${id}Refazer">Refazer texto automático</button>
          <span class="dica" id="${id}Estado"></span></div>
      </fieldset>`);
    const ta = $(`#${id}`), estado = $(`#${id}Estado`);
    let editado = false;
    const marcar = () => { estado.textContent = editado ? 'Texto editado à mão (não é mais atualizado sozinho).' : 'Atualizando sozinho.'; };
    ta.addEventListener('input', () => { editado = true; marcar(); });
    marcar();
    return {
      ta,
      atualizar(t) { if (!editado) ta.value = t; },
      refazer(t) { editado = false; ta.value = t; marcar(); },
      reset() { editado = false; ta.value = ''; marcar(); },
      ler: () => ta.value,
    };
  }

  // Monta uma aba: chama "montar" para criar os campos e liga os botões.
  function criarAba({ nome, raiz, id, montar, gerar, limparExtra, camposZerar, textoAuto }) {
    const ctx = montar(raiz);
    botoes(raiz, id);
    let nomeGerado = null;
    // texto automático: recalcula a cada mudança nos campos (menos na própria caixa de texto)
    if (ctx.texto && textoAuto) {
      let t = null;
      const recalcular = () => { clearTimeout(t); t = setTimeout(() => ctx.texto.atualizar(textoAuto(ctx)), 150); };
      raiz.addEventListener('input', (e) => { if (e.target !== ctx.texto.ta) recalcular(); });
      raiz.addEventListener('change', (e) => { if (e.target !== ctx.texto.ta) recalcular(); });
      raiz.addEventListener('click', (e) => { if (e.target.closest('.combo-lista, .remover, #retAdd')) recalcular(); });
      $(`#${ctx.texto.ta.id}Refazer`).addEventListener('click', () => ctx.texto.refazer(textoAuto(ctx)));
      ctx.recalcular = recalcular;
    }
    raiz.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-acao]'); if (!b || !raiz.contains(b)) return;
      const acao = b.dataset.acao;
      if (acao === 'limpar') { if (confirm('Apagar o que foi preenchido nesta minuta?')) { limpar(); window.scrollTo(0, 0); } return; }
      raiz.querySelectorAll('.invalido').forEach((x) => x.classList.remove('invalido'));
      const erros = [];
      const r = gerar(ctx, erros);
      if (mostrarErros(raiz, id, erros) || !r) return;
      try {
        await entregar(acao === 'ver' ? 'ver' : acao, r);
        nomeGerado = r.chave;
      } catch (err) { console.error(err); alert('Não foi possível gerar o documento. Tente de novo.'); }
    });
    // Minuta nova: se o requerente mudar depois de gerar, zera livro/folha/termo e o tipo de assento.
    if (ctx.campoChave) {
      ctx.campoChave.addEventListener('change', () => {
        if (nomeGerado !== null && up(limpo(ctx.campoChave.value)) !== nomeGerado) {
          nomeGerado = null;
          (camposZerar ? camposZerar(ctx) : []).forEach((el) => { el.value = ''; el.dispatchEvent(new Event('change')); });
          if (ctx.texto) ctx.texto.reset();
          const av = $(`#${id}AvisoNova`); if (av) av.hidden = false;
        }
      });
    }
    function limpar() {
      raiz.querySelectorAll('input, textarea, select').forEach((el) => {
        if (el.closest('.combo')) return;
        if (el.type === 'checkbox' || el.type === 'radio') el.checked = el.defaultChecked;
        else if (el.tagName === 'SELECT') { const d = [...el.options].find((o) => o.defaultSelected); el.value = d ? d.value : (el.options[0] ? el.options[0].value : ''); }
        else el.value = el.defaultValue;
        el.classList.remove('invalido');
      });
      raiz.querySelectorAll('.dica[data-c="cepStatus"]').forEach((s) => { s.textContent = ''; });
      $(`#${id}Erros`).hidden = true;
      const av = $(`#${id}AvisoNova`); if (av) av.hidden = true;
      nomeGerado = null;
      if (limparExtra) limparExtra(ctx);
      if (ctx.texto) ctx.texto.reset();
      if (B.abaAtual() === nome) B.esconderPrevia();
    }
    B.registrarAba({
      nome, limpar,
      temDados: () => [...raiz.querySelectorAll('input:not([type=date]):not([type=checkbox]), textarea')].some((el) => !el.closest('.combo') && el.value.trim() && el.value !== el.defaultValue) || (ctx.destino && ctx.destino.temDados()),
    });
    return ctx;
  }

  const ASSENTOS = [
    ['A', 'Nascimento', 'NASCIMENTO', 'A'], ['B', 'Casamento', 'CASAMENTO', 'B'], ['B AUX', 'Casamento religioso com efeito civil', 'CASAMENTO', 'B-Auxiliar'],
    ['C', 'Óbito', 'ÓBITO', 'C'], ['C AUX', 'Natimorto', 'NATIMORTO', 'C-Auxiliar'],
  ];
  const LIVROS = ['A', 'B', 'B-Auxiliar', 'C', 'C-Auxiliar', 'E'];

  // =====================================================================
  // 1) RETIFICAÇÃO (seções; complementação de dados e/ou correção)
  // =====================================================================
  const CAMPOS_RET = ['Nome do(a) registrado(a)', 'Nome do pai', 'Nome da mãe', 'Nome dos avós paternos', 'Nome dos avós maternos',
    'Data de nascimento', 'Local de nascimento', 'Naturalidade', 'Nome do contraente', 'Nome da contraente', 'Filiação do contraente',
    'Filiação da contraente', 'Nome do(a) falecido(a)', 'Outro'];
  const MOTIVOS_RET = {
    semdoc: (s) => `Considerando que ${gx(s, 'o', 'a')} requerente não pôde ser devidamente ${gx(s, 'identificado', 'identificada')}, por não estar ${gx(s, 'munido', 'munida')} de documento oficial de identificação, segue a qualificação das testemunhas, nos termos da legislação aplicável.`,
    rogo: (s, rogo) => `Por não saber ou não poder ${gx(s, 'o', 'a')} requerente assinar, assina a seu rogo ${rogo || '________________________________'}, na presença das testemunhas abaixo qualificadas.`,
    digital: (s) => `Por não saber ${gx(s, 'o', 'a')} requerente assinar, foi colhida sua impressão digital, na presença das testemunhas abaixo qualificadas.`,
    docinvalido: (s) => `Considerando que o documento de identificação apresentado ${gx(s, 'pelo', 'pela')} requerente não está em condições de uso, segue a qualificação das testemunhas, nos termos da legislação aplicável.`,
    outro: () => '',
  };
  const FUNDAMENTOS = {
    97: ['nos termos do artigo 97 da Lei nº 6.015/1973', 'no artigo 97 da Lei nº 6.015/1973'],
    '97e110': ['nos termos dos artigos 97 e 110 da Lei nº 6.015/1973', 'nos artigos 97 e 110 da Lei nº 6.015/1973'],
    110: ['nos termos do artigo 110 da Lei nº 6.015/1973', 'no artigo 110 da Lei nº 6.015/1973'],
  };

  // Caixa de complementação de dados de uma pessoa do assento.
  function blocoComplemento(raiz, k) {
    raiz.insertAdjacentHTML('beforeend', `
      <div class="complemento" data-k="${k}">
        <h3 data-titulo></h3>
        <div class="grade g4">
          <label>Sexo <select data-f="sexo"><option value="" selected>Não incluir</option><option value="M">Masculino</option><option value="F">Feminino</option></select></label>
          <label>Data de nascimento <input type="date" data-f="nascimento"></label>
          <label>Nacionalidade <input data-f="nacionalidade" placeholder="ex.: Brasileira"></label>
          <label>Naturalidade <input data-f="naturalidade" placeholder="ex.: São Paulo/SP"></label>
        </div>
        <div class="grade g2">
          <label>Nome do pai <input data-f="pai"></label>
          <label>Nome da mãe <input data-f="mae"></label>
        </div>
        <div class="grade g4">
          <label>Registrado(a) em (cartório) <input data-f="regCart" placeholder="ex.: São Paulo – 28º Subdistrito – Jardim Paulista – SP"></label>
          <label>Livro A nº <input data-f="regLivro"></label>
          <label>Folha <input data-f="regFolha"></label>
          <label>Termo <input data-f="regTermo"></label>
        </div>
        <label>Constar o nome completo (se for o caso) <input data-f="nomeCompleto"></label>
      </div>`);
    const caixa = raiz.querySelector(`.complemento[data-k="${k}"]`);
    const f = (n) => caixa.querySelector(`[data-f="${n}"]`);
    return {
      caixa,
      titulo(t) { caixa.querySelector('[data-titulo]').textContent = t; },
      ler: () => {
        const o = {}; ['sexo', 'nascimento', 'nacionalidade', 'naturalidade', 'pai', 'mae', 'regCart', 'regLivro', 'regFolha', 'regTermo', 'nomeCompleto'].forEach((n) => { o[n] = limpo(f(n).value); });
        o.pai = up(o.pai); o.mae = up(o.mae); o.nomeCompleto = up(o.nomeCompleto); return o;
      },
    };
  }
  // "Sexo: Feminino; Nome dos genitores: X e Y; Data de nascimento: ...; Nacionalidade: ...; Naturalidade: ..., e registrada em ..., conforme o Lº A-12, fls. 134, T-7712; bem como constar seu nome completo: NOME."
  function textoComplemento(d) {
    const p = [];
    if (d.sexo) p.push(`Sexo: ${d.sexo === 'F' ? 'Feminino' : 'Masculino'}`);
    const gen = [d.pai, d.mae].filter(Boolean);
    if (gen.length) p.push(`Nome ${gen.length > 1 ? 'dos genitores' : 'do genitor'}: ${gen.join(' e ')}`);
    if (d.nascimento) p.push(`Data de nascimento: ${dataBR(d.nascimento)}`);
    if (d.nacionalidade) p.push(`Nacionalidade: ${d.nacionalidade}`);
    let nat = d.naturalidade ? `Naturalidade: ${d.naturalidade}` : '';
    if (d.regCart || d.regLivro) {
      const reg = `${gx(d.sexo, 'registrado', 'registrada')}${d.regCart ? ` em ${d.regCart}` : ''}${d.regLivro ? `, conforme o Lº A-${d.regLivro}${d.regFolha ? `, fls. ${d.regFolha}` : ''}${d.regTermo ? `, T-${d.regTermo}` : ''}` : ''}`;
      nat = nat ? `${nat}, e ${reg}` : reg.charAt(0).toUpperCase() + reg.slice(1);
    }
    if (nat) p.push(nat);
    let s = p.join('; ');
    if (d.nomeCompleto) s += `${s ? '; bem como ' : ''}constar seu nome completo: ${d.nomeCompleto}`;
    return s ? s + '.' : '';
  }

  const ret = criarAba({
    nome: 'retificacao', raiz: $('#abaRetificacao'), id: 'ret',
    montar(raiz) {
      raiz.insertAdjacentHTML('beforeend', '<p class="aviso" id="retAvisoNova" hidden>Minuta nova: o requerente mudou, então o tipo de assento, o livro, a folha, o termo e o texto foram zerados.</p>');
      const destino = blocoDestino(raiz, 'retD');
      raiz.insertAdjacentHTML('beforeend', `
        <fieldset><legend>Quem requer</legend>
          <div class="opcoes">
            <label class="opcao"><input type="radio" name="retQuem" value="proprio" checked> O próprio registrado</label>
            <label class="opcao"><input type="radio" name="retQuem" value="representante"> Representante legal (pai/mãe de registrado menor)</label>
            <label class="opcao"><input type="radio" name="retQuem" value="procurador"> Procurador(a)</label>
          </div>
          <div id="retReq"></div>
          <div id="retRepres" hidden>
            <label id="retProcLbl">Procuração (onde e quando foi feita) <input id="retProcTxt" placeholder="ex.: lavrada no 1º Tabelião de Notas de X, livro 10, fls. 20, em 01/02/2026"></label>
            <div id="retRepQual"></div>
          </div>
        </fieldset>
        <fieldset><legend>Modelo</legend>
          <div class="opcoes">
            <label class="opcao"><input type="radio" name="retModelo" value="simples" checked> Requerente com documento</label>
            <label class="opcao"><input type="radio" name="retModelo" value="testemunhas"> Com testemunhas</label>
          </div>
          <div id="retTest" hidden>
            <label>Motivo das testemunhas <select id="retMotivoTipo">
              <option value="semdoc" selected>Requerente sem documento de identificação</option>
              <option value="rogo">Requerente não sabe ou não pode assinar (a rogo)</option>
              <option value="digital">Requerente não sabe assinar (impressão digital)</option>
              <option value="docinvalido">Documento sem condições de uso</option>
              <option value="outro">Outro (escrever)</option></select></label>
            <label id="retRogoLbl" hidden>Nome de quem assina a rogo (opcional) <input id="retRogo"></label>
            <label>Texto do motivo (pode editar) <textarea id="retMotivo" rows="3"></textarea></label>
            <div id="retT1"></div><div id="retT2"></div>
          </div>
        </fieldset>
        <fieldset><legend>Assento a retificar</legend>
          <div class="grade g4">
            <label>Tipo de assento <select id="retTipo"><option value="" selected>Selecione</option>
              ${ASSENTOS.map((a) => `<option value="${a[0]}">${a[1]}</option>`).join('')}</select></label>
            <label>Livro <select id="retLivroLetra">${LIVROS.map((l) => `<option>${l}</option>`).join('')}</select></label>
            <label>Livro nº <input id="retLivro" inputmode="numeric"></label>
            <label>Folha <input id="retFolha" inputmode="numeric"></label>
          </div>
          <div class="grade g4">
            <label>Termo nº <input id="retTermo" inputmode="numeric"></label>
            <label id="retN1Lbl">Nome do(a) registrado(a) <input id="retN1"></label>
            <label id="retN2Lbl" hidden>Nome do 2º contraente <input id="retN2"></label>
            <span></span>
          </div>
        </fieldset>
        <fieldset><legend>O que retificar</legend>
          <label class="opcao"><input type="checkbox" id="retUsaComp"> Complementação de dados (incluir dados que não constam)</label>
          <div id="retComp" hidden></div>
          <label class="opcao" style="margin-top:8px"><input type="checkbox" id="retUsaCorr" checked> Correção (onde consta / deve constar)</label>
          <div id="retCorrBox">
            <div id="retCorrecoes"></div>
            <button type="button" class="sec mini" id="retAdd">+ adicionar correção</button>
          </div>
          <div class="grade g2" style="margin-top:12px">
            <label>Fundamento <select id="retFundTipo">
              <option value="97">art. 97 da Lei nº 6.015/1973</option>
              <option value="97e110" selected>arts. 97 e 110 da Lei nº 6.015/1973</option>
              <option value="110">art. 110 da Lei nº 6.015/1973</option></select></label>
            <label class="opcao" style="align-self:end"><input type="checkbox" id="retIsento"> Erro imputável ao cartório – sai "ISENTO"</label>
          </div>
        </fieldset>`);
      const req = blocoPessoa($('#retReq'), 'retR', { titulo: 'Qualificação de quem assina o requerimento' });
      const repr = blocoPessoa($('#retRepQual'), 'retRp', { titulo: 'Qualificação do(a) representado(a) / outorgante (em nome de quem se pede)' });
      const t1 = blocoPessoa($('#retT1'), 'retT1', { titulo: 'Testemunha 1', completo: false });
      const t2 = blocoPessoa($('#retT2'), 'retT2', { titulo: 'Testemunha 2', completo: false });
      const comp = [blocoComplemento($('#retComp'), 1), blocoComplemento($('#retComp'), 2)];
      const texto = blocoTexto(raiz, 'retTexto', 'II – Requerimento: texto que vai sair no documento (pode editar)');
      const fech = blocoFechamento(raiz, 'retF');
      // linhas de correção
      const caixa = $('#retCorrecoes');
      function addLinha() {
        const d = document.createElement('div');
        d.className = 'correcao';
        d.innerHTML = `<div class="grade g-corr">
          <label>Campo <select data-k="campo">${CAMPOS_RET.map((c) => `<option>${c}</option>`).join('')}</select></label>
          <label>Onde consta <input data-k="consta"></label>
          <label>Deve constar <input data-k="deve"></label>
          <button type="button" class="remover" title="Remover esta correção" aria-label="Remover">×</button></div>
          <label class="outro-campo" hidden>Qual campo? <input data-k="outro"></label>`;
        caixa.appendChild(d);
        const sel = d.querySelector('[data-k=campo]');
        sel.addEventListener('change', () => { d.querySelector('.outro-campo').hidden = sel.value !== 'Outro'; });
        d.querySelector('.remover').addEventListener('click', () => { if (caixa.children.length > 1) d.remove(); });
      }
      addLinha();
      $('#retAdd').addEventListener('click', addLinha);
      const quem = () => raiz.querySelector('[name=retQuem]:checked').value;
      raiz.querySelectorAll('[name=retQuem]').forEach((r) => r.addEventListener('change', () => {
        $('#retRepres').hidden = quem() === 'proprio';
        $('#retProcLbl').hidden = quem() !== 'procurador';
      }));
      const modelo = () => raiz.querySelector('[name=retModelo]:checked').value;
      let motivoEditado = false;
      function motivo(forcar) {
        const t = $('#retMotivoTipo').value;
        $('#retRogoLbl').hidden = t !== 'rogo';
        if (forcar || !motivoEditado) { $('#retMotivo').value = MOTIVOS_RET[t](req.ler().sexo, up(limpo($('#retRogo').value))); motivoEditado = false; }
      }
      raiz.querySelectorAll('[name=retModelo]').forEach((r) => r.addEventListener('change', () => { $('#retTest').hidden = modelo() !== 'testemunhas'; motivo(false); }));
      $('#retMotivoTipo').addEventListener('change', () => motivo(true));
      $('#retRogo').addEventListener('input', () => motivo(false));
      req.el('sexo').addEventListener('change', () => motivo(false));
      $('#retMotivo').addEventListener('input', () => { motivoEditado = true; });
      motivo(true);
      function ajustarTipo() {
        const t = $('#retTipo').value, cas = t.startsWith('B');
        $('#retN1Lbl').firstChild.textContent = cas ? 'Nome do 1º contraente ' : t.startsWith('C') ? 'Nome do(a) falecido(a) ' : 'Nome do(a) registrado(a) ';
        $('#retN2Lbl').hidden = !cas;
        const a = ASSENTOS.find((x) => x[0] === t); if (a) $('#retLivroLetra').value = a[3];
        comp[1].caixa.hidden = !cas;
        comp[0].titulo(cas ? 'Dados complementares do(a) 1º contraente' : t.startsWith('C') ? 'Dados complementares do(a) falecido(a)' : 'Dados complementares do(a) registrado(a)');
        comp[1].titulo('Dados complementares do(a) 2º contraente');
      }
      $('#retTipo').addEventListener('change', ajustarTipo);
      ajustarTipo();
      $('#retUsaComp').addEventListener('change', () => { $('#retComp').hidden = !$('#retUsaComp').checked; });
      $('#retUsaCorr').addEventListener('change', () => { $('#retCorrBox').hidden = !$('#retUsaCorr').checked; });
      return { destino, req, repr, t1, t2, comp, fech, texto, quem, modelo, addLinha, caixa, motivo, ajustarTipo, campoChave: req.el('nome'), resetMotivo: () => { motivoEditado = false; } };
    },
    textoAuto(ctx) {
      const tipo = $('#retTipo').value;
      const a = ASSENTOS.find((x) => x[0] === tipo);
      const assento = a ? a[2] : '[TIPO DE ASSENTO]';
      const n1 = up(limpo($('#retN1').value)) || '[NOME]', n2 = up(limpo($('#retN2').value)) || '[NOME]';
      const nomes = tipo.startsWith('B') ? `${n1} e ${n2}` : n1;
      const livro = `Livro ${$('#retLivroLetra').value}-${limpo($('#retLivro').value) || '__'}, fls. ${limpo($('#retFolha').value) || '__'}, termo nº ${limpo($('#retTermo').value) || '__'}`;
      const fund = FUNDAMENTOS[$('#retFundTipo').value][0];
      const linhas = [`Venho, através deste, requerer a retificação, ${fund}, do assento de ${assento} de ${nomes}, para constar:`];
      if ($('#retUsaComp').checked) {
        const quantos = tipo.startsWith('B') ? 2 : 1;
        for (let i = 0; i < quantos; i++) {
          const d = ctx.comp[i].ler(), t = textoComplemento(d);
          if (!t) continue;
          const s = d.sexo;
          const quemE = tipo.startsWith('B') ? `${i === 0 ? gx(s, 'do primeiro', 'da primeira') : gx(s, 'do segundo', 'da segunda')} ${gx(s, 'contraente', 'contraente')}`
            : tipo.startsWith('C') ? gx(s, 'do falecido', 'da falecida') : gx(s, 'do registrado', 'da registrada');
          linhas.push(`Os dados complementares ${quemE}:`);
          linhas.push(`\t${t}`);
        }
      }
      if ($('#retUsaCorr').checked) {
        const corr = [...ctx.caixa.children].map((d) => {
          const g = (k) => d.querySelector(`[data-k=${k}]`);
          return { campo: g('campo').value === 'Outro' ? limpo(g('outro').value) : g('campo').value, consta: up(limpo(g('consta').value)), deve: up(limpo(g('deve').value)) };
        }).filter((c) => c.consta || c.deve);
        if (corr.length) {
          linhas.push(corr.length > 1 ? 'As seguintes correções:' : 'A seguinte correção:');
          corr.forEach((c, i) => linhas.push(`\t${c.campo || '[campo]'}: onde consta “${c.consta || '___'}”, deve constar “${c.deve || '___'}”${i === corr.length - 1 ? '.' : ';'}`));
        }
      }
      linhas.push('Tudo conforme cópias comprobatórias em anexo.');
      linhas.push(`Diante do exposto, requer que seja feita a retificação junto ao termo de ${assento} lavrado no ${livro}. Certifico ainda que os documentos em anexo conferem com o original.`);
      return linhas.join('\n');
    },
    camposZerar: () => [$('#retTipo'), $('#retLivro'), $('#retFolha'), $('#retTermo')],
    limparExtra(ctx) {
      ctx.destino.limpar(); ctx.req.limpar(); ctx.repr.limpar(); ctx.t1.limpar(); ctx.t2.limpar(); ctx.fech.reiniciarData();
      ctx.caixa.innerHTML = ''; ctx.addLinha();
      $('#retRepres').hidden = true; $('#retTest').hidden = true; $('#retComp').hidden = true; $('#retCorrBox').hidden = false;
      ctx.ajustarTipo(); ctx.resetMotivo(); ctx.motivo(true);
    },
    gerar(ctx, erros) {
      const dest = ctx.destino.texto();
      if (!dest) { erros.push('Cartório de destino'); ctx.destino.el.classList.add('invalido'); }
      const q = ctx.quem(), comTest = ctx.modelo() === 'testemunhas';
      ctx.req.validar(erros, 'Requerente', ['nome', 'sexo', 'nacionalidade', 'estadoCivil', 'logradouro', 'numero'].concat(comTest ? [] : ['cpf']));
      if (q !== 'proprio') ctx.repr.validar(erros, 'Representado(a)', ['nome', 'sexo', 'nacionalidade', 'estadoCivil', 'nascimento', 'logradouro', 'numero']);
      [['#retTipo', 'Tipo de assento'], ['#retLivro', 'Livro nº'], ['#retFolha', 'Folha'], ['#retTermo', 'Termo nº'], ['#retN1', 'Nome que consta no registro']].forEach(([s, r]) => {
        if (!limpo($(s).value)) { erros.push(r); $(s).classList.add('invalido'); }
      });
      const tipo = $('#retTipo').value;
      if (tipo.startsWith('B') && !limpo($('#retN2').value)) { erros.push('Nome do 2º contraente'); $('#retN2').classList.add('invalido'); }
      if (!$('#retUsaComp').checked && !$('#retUsaCorr').checked) erros.push('Escolha o que retificar: complementação de dados e/ou correção');
      const texto = ctx.texto.ler();
      if (!limpo(texto)) { erros.push('Texto do requerimento'); ctx.texto.ta.classList.add('invalido'); }
      if (/\[(NOME|TIPO DE ASSENTO|campo)\]|“___”|-__,|fls\. __/.test(texto)) erros.push('O texto do requerimento ainda tem partes em branco (___ ou [ ]): preencha os campos ou corrija o texto');
      if (comTest) {
        ctx.t1.validar(erros, 'Testemunha 1', ['nome', 'cpf', 'logradouro', 'numero']);
        ctx.t2.validar(erros, 'Testemunha 2', ['nome', 'cpf', 'logradouro', 'numero']);
        if (!limpo($('#retMotivo').value)) { erros.push('Texto do motivo das testemunhas'); $('#retMotivo').classList.add('invalido'); }
      }
      ctx.fech.validar(erros);
      if (erros.length) return null;

      const r = ctx.req.ler(), f = ctx.fech.ler(), s = r.sexo;
      const rp = ctx.repr.ler();
      let qualidade = '';
      if (q === 'representante') qualidade = `, na qualidade de representante legal de ${rp.nome}, ${qualificacao(rp)}`;
      if (q === 'procurador') qualidade = `, na qualidade de ${gx(s, 'procurador', 'procuradora')} de ${rp.nome}, ${qualificacao(rp)}${limpo($('#retProcTxt').value) ? `, conforme procuração ${limpo($('#retProcTxt').value)}` : ''}`;
      const blocos = [
        enderecamento(dest),
        titulo('I – REQUERENTE:'),
        { p: [`${r.nome}, ${qualificacao(r)}${qualidade}.`], ind: RECUO },
        titulo('II – REQUERIMENTO:'),
        ...paragrafosDe(texto),
      ];
      let n = 'III';
      const nomesT = [];
      if (comTest) {
        const [a, b] = [ctx.t1.ler(), ctx.t2.ler()];
        nomesT.push(a.nome, b.nome);
        blocos.push(titulo('III – TESTEMUNHAS:'), { p: [limpo($('#retMotivo').value)], ind: RECUO, tam: 10 });
        [a, b].forEach((t) => blocos.push({ p: [`${t.nome}, ${qualificacao(t, { completo: false })}.`], ind: RECUO, tam: 10, depois: 3 }));
        n = 'IV';
      }
      blocos.push(titulo(`${n} – FUNDAMENTO JURÍDICO:`), { p: [`O presente requerimento está fundamentado ${FUNDAMENTOS[$('#retFundTipo').value][1]}.`], ind: RECUO });
      blocos.push({ p: ['Termos em que, pede deferimento.'], ind: RECUO, antes: 4 });
      if ($('#retIsento').checked) blocos.push({ p: [R('ISENTO', true), ' – erro imputável ao cartório (art. 110, § 5º, da Lei nº 6.015/1973).'], tam: 10, antes: 4 });
      const linhaQual = q === 'representante' ? [[`Representante legal de ${rp.nome}`]] : q === 'procurador' ? [[`${gx(s, 'Procurador', 'Procuradora')} de ${rp.nome}`]] : [];
      const assin = [assinaturaCentro(r.nome, linhaQual)];
      if (comTest) {
        const [a, b] = [ctx.t1.ler(), ctx.t2.ler()];
        assin.push({ lado: [{ nome: [R('TESTEMUNHA 1: ', true), R(a.nome, true)], linhas: [[`CPF: ${a.cpf}`]], larg: 215 }, { nome: [R('TESTEMUNHA 2: ', true), R(b.nome, true)], linhas: [[`CPF: ${b.cpf}`]], larg: 215 }] });
      }
      const comps = ctx.comp.map((c) => c.ler());
      return {
        titulo: 'Requerimento de retificação', arquivo: nomeArquivo('retificacao', r.nome), chave: r.nome,
        nomes: [r.nome, r.pai, r.mae, rp.nome, rp.pai, rp.mae, up(limpo($('#retN1').value)), up(limpo($('#retN2').value)), ...nomesT,
          ...comps.flatMap((c) => [c.pai, c.mae, c.nomeCompleto])],
        blocos: blocos.concat(fechamentoBlocos(f, assin)),
      };
    },
  });

  // =====================================================================
  // 2) ALTERAÇÃO DE PRENOME (art. 56) – seções I a IV
  // =====================================================================
  const pre = criarAba({
    nome: 'prenome', raiz: $('#abaPrenome'), id: 'pre',
    montar(raiz) {
      raiz.insertAdjacentHTML('beforeend', `
        <p class="aviso">Só para maiores de 18 anos, e o pedido é sempre pessoal (sem representante ou procurador). A alteração imotivada de prenome pela via extrajudicial só pode ser feita uma vez (art. 56, § 1º, da Lei nº 6.015/1973).</p>
        <p class="aviso" id="preAvisoNova" hidden>Minuta nova: o requerente mudou, então o livro, a folha, o termo e o texto foram zerados.</p>
        <p class="erros" id="preMenor" hidden></p>`);
      const destino = blocoDestino(raiz, 'preD');
      raiz.insertAdjacentHTML('beforeend', '<fieldset><legend>Requerente</legend><div id="preReq"></div></fieldset>');
      const req = blocoPessoa($('#preReq'), 'preR', {});
      raiz.insertAdjacentHTML('beforeend', `
        <fieldset><legend>Registro de nascimento</legend>
          <div class="grade g4">
            <label>Livro A nº <input id="preLivro" inputmode="numeric"></label>
            <label>Folha <input id="preFolha" inputmode="numeric"></label>
            <label>Termo nº <input id="preTermo" inputmode="numeric"></label>
            <span></span>
          </div>
        </fieldset>
        <fieldset><legend>Novo prenome</legend>
          <div class="grade g2">
            <label>Prenome atual <input id="prePrenAtual" placeholder="ex.: MARIA APARECIDA"></label>
            <label>Prenome pretendido <input id="prePrenNovo"></label>
          </div>
          <label>Nome completo que passará a usar (pode corrigir) <input id="preNomeNovo"></label>
          <p class="dica">O site troca só o prenome e mantém os sobrenomes do nome atual.</p>
        </fieldset>
        <fieldset><legend>Documentos (constam da averbação)</legend>
          <div class="grade g-doc">
            <label>ICN (Identificação Civil Nacional) <select id="preIcn"><option value="nao" selected>Não possui</option><option value="sim">Possui</option></select></label>
            <label>Nº da ICN <input id="preIcnN"></label>
            <label>RG de outro estado <select id="preRgUf"><option value="nao" selected>Não possui</option><option value="sim">Possui</option></select></label>
            <label>Nº e UF desse RG <input id="preRgUfN" placeholder="ex.: 1234567 SSP/MG"></label>
            <label>Passaporte <select id="prePass"><option value="nao" selected>Não possui</option><option value="sim">Possui</option></select></label>
            <label>Nº do passaporte <input id="prePassN"></label>
            <label>Título de eleitor nº <input id="preTitulo" inputmode="numeric"></label>
          </div>
          <label class="opcao"><input type="checkbox" id="preDocsOrig" checked> Na certificação, incluir "Certifico ainda que todos os documentos anexados foram extraídos dos originais."</label>
        </fieldset>`);
      const texto = blocoTexto(raiz, 'preTexto', 'II – Requerimento: texto que vai sair no documento (pode editar)');
      const fech = blocoFechamento(raiz, 'preF');
      let nomeEditado = false;
      function sugerir() {
        if (nomeEditado) return;
        const atual = up(limpo(req.el('nome').value)), pa = up(limpo($('#prePrenAtual').value)), pn = up(limpo($('#prePrenNovo').value));
        if (!pn) { $('#preNomeNovo').value = ''; return; }
        const sobren = pa && atual.startsWith(pa + ' ') ? atual.slice(pa.length + 1) : atual.split(' ').slice(1).join(' ');
        $('#preNomeNovo').value = limpo(`${pn} ${sobren}`);
      }
      [req.el('nome'), $('#prePrenAtual'), $('#prePrenNovo')].forEach((e) => e.addEventListener('input', sugerir));
      req.el('nome').addEventListener('change', () => {
        if (!limpo($('#prePrenAtual').value)) $('#prePrenAtual').value = up(limpo(req.el('nome').value)).split(' ')[0] || '';
      });
      $('#preNomeNovo').addEventListener('input', () => { nomeEditado = true; });
      req.el('nascimento').addEventListener('change', () => {
        const i = idade(req.el('nascimento').value);
        const m = $('#preMenor');
        if (i !== null && i < 18) { m.textContent = `O requerente tem ${i} anos. A alteração de prenome pelo art. 56 só pode ser pedida depois de atingida a maioridade civil.`; m.hidden = false; } else m.hidden = true;
      });
      [['#preIcn', '#preIcnN'], ['#preRgUf', '#preRgUfN'], ['#prePass', '#prePassN']].forEach(([s, n]) => {
        const sync = () => { $(n).disabled = $(s).value !== 'sim'; if ($(n).disabled) $(n).value = ''; };
        $(s).addEventListener('change', sync); sync();
      });
      return { destino, req, fech, texto, campoChave: req.el('nome'), resetNome: () => { nomeEditado = false; } };
    },
    textoAuto(ctx) {
      const r = ctx.req.ler(), g = (m, f) => gx(r.sexo, m, f);
      return `Com fulcro no disposto pelo artigo 56 da Lei nº 6.015/1973, ${g('o', 'a')} requerente acima ${g('indicado', 'indicada')}, ${g('registrado', 'registrada')} conforme o Livro A-${limpo($('#preLivro').value) || '__'}, fls. ${limpo($('#preFolha').value) || '__'}, termo nº ${limpo($('#preTermo').value) || '__'}, vem, respeitosamente, requerer a V. Sa. a instauração de procedimento para alteração de prenome, substituindo o prenome ${up(limpo($('#prePrenAtual').value)) || '[PRENOME ATUAL]'} por ${up(limpo($('#prePrenNovo').value)) || '[PRENOME NOVO]'}, de modo que passe a ser ${g('identificado', 'identificada')} como: ${up(limpo($('#preNomeNovo').value)) || '[NOME NOVO]'}.`;
    },
    camposZerar: () => [$('#preLivro'), $('#preFolha'), $('#preTermo')],
    limparExtra(ctx) {
      ctx.destino.limpar(); ctx.req.limpar(); ctx.fech.reiniciarData(); ctx.resetNome();
      $('#preMenor').hidden = true;
      ['#preIcnN', '#preRgUfN', '#prePassN'].forEach((s) => { $(s).disabled = true; });
    },
    gerar(ctx, erros) {
      const dest = ctx.destino.texto();
      if (!dest) { erros.push('Cartório de destino'); ctx.destino.el.classList.add('invalido'); }
      ctx.req.validar(erros, 'Requerente', ['nome', 'sexo', 'nacionalidade', 'estadoCivil', 'profissao', 'rg', 'cpf', 'nascimento', 'naturalidade', 'logradouro', 'numero']);
      const r = ctx.req.ler();
      if (!r.pai && !r.mae) { erros.push('Requerente: filiação (pai e/ou mãe)'); ctx.req.el('mae').classList.add('invalido'); }
      const i = idade(r.nascimento);
      if (i !== null && i < 18) erros.push(`Requerente com ${i} anos: a alteração de prenome (art. 56) só é possível para maiores de 18 anos`);
      [['#preLivro', 'Livro nº'], ['#preFolha', 'Folha'], ['#preTermo', 'Termo nº'], ['#prePrenAtual', 'Prenome atual'], ['#prePrenNovo', 'Prenome pretendido'], ['#preNomeNovo', 'Nome completo que passará a usar']].forEach(([s, rt]) => {
        if (!limpo($(s).value)) { erros.push(rt); $(s).classList.add('invalido'); }
      });
      [['#preIcn', '#preIcnN', 'Nº da ICN'], ['#preRgUf', '#preRgUfN', 'Nº e UF do RG de outro estado'], ['#prePass', '#prePassN', 'Nº do passaporte']].forEach(([s, n, rt]) => {
        if ($(s).value === 'sim' && !limpo($(n).value)) { erros.push(rt); $(n).classList.add('invalido'); }
      });
      const texto = ctx.texto.ler();
      if (!limpo(texto)) { erros.push('Texto do requerimento'); ctx.texto.ta.classList.add('invalido'); }
      if (/\[[A-Z ]+\]|-__,|fls\. __/.test(texto)) erros.push('O texto do requerimento ainda tem partes em branco: preencha os campos ou corrija o texto');
      ctx.fech.validar(erros);
      if (erros.length) return null;
      const f = ctx.fech.ler(), g = (m, fe) => gx(r.sexo, m, fe);
      const docs = [
        $('#preIcn').value === 'sim' ? `possui Identificação Civil Nacional (ICN) nº ${limpo($('#preIcnN').value)}` : 'não possui Identificação Civil Nacional (ICN)',
        $('#preRgUf').value === 'sim' ? `possui cédula de identidade RG emitida em outra unidade da Federação, nº ${limpo($('#preRgUfN').value)}` : 'não possui cédula de identidade RG emitida em outra unidade da Federação',
        $('#prePass').value === 'sim' ? `possui passaporte nº ${limpo($('#prePassN').value)}` : 'não possui passaporte',
      ];
      const titEl = limpo($('#preTitulo').value);
      const blocos = [
        enderecamento(dest),
        titulo('I – REQUERENTE:'),
        { p: [`${r.nome}, ${qualificacao(r)}.`], ind: RECUO },
        titulo('II – REQUERIMENTO:'),
        ...paragrafosDe(texto),
        titulo('III – DECLARAÇÕES SOB AS PENAS DA LEI:'),
        { p: [`${g('O', 'A')} requerente declara que:`], ind: RECUO, depois: 2 },
        { p: ['a) a alteração ora requerida está de acordo com seu nome atual e que responde civil e criminalmente pela veracidade desta afirmação. Declara, ainda, que não é parte em ação judicial em trâmite sobre alteração de prenome ou, em caso de ação judicial com o referido escopo, que a mesma já foi devidamente arquivada, conforme certidão anexa;'], esqBloco: 40, depois: 2 },
        { p: [`b) ${docs.join('; ')}${titEl ? `; e seu título de eleitor é o de nº ${titEl}` : ''};`], esqBloco: 40, depois: 2 },
        { p: ['c) está ciente de que não será admitida outra alteração de prenome por este procedimento diretamente perante Oficial de Registro Civil das Pessoas Naturais, resguardada a via judicial;'], esqBloco: 40, depois: 2 },
        { p: ['d) está ciente de que deverá promover a alteração nos demais registros que lhe digam respeito, direta ou indiretamente, e nos respectivos documentos de identificação.'], esqBloco: 40 },
        titulo('IV – FUNDAMENTO JURÍDICO:'),
        { p: ['O presente requerimento está fundamentado no artigo 56 da Lei nº 6.015/1973.'], ind: RECUO },
        { p: ['Por ser verdade, firmo o presente termo.'], ind: RECUO, antes: 4 },
      ];
      return {
        titulo: 'Requerimento de alteração de prenome', arquivo: nomeArquivo('alteracao-prenome', r.nome), chave: r.nome,
        nomes: [r.nome, r.pai, r.mae, up(limpo($('#prePrenAtual').value)), up(limpo($('#prePrenNovo').value)), up(limpo($('#preNomeNovo').value))],
        blocos: blocos.concat(fechamentoBlocos(f, [assinaturaCentro(r.nome)], { docsOriginais: $('#preDocsOrig').checked })),
      };
    },
  });

  // =====================================================================
  // 3) ALTERAÇÃO DE SOBRENOME (art. 57) – seções I a IV
  // =====================================================================
  const HIPOTESES = {
    I: { rot: 'I – inclusão de sobrenome familiar', inciso: 'inciso I' },
    II: { rot: 'II – inclusão ou exclusão de sobrenome do cônjuge (casamento em vigor)', inciso: 'inciso II' },
    III: { rot: 'III – exclusão de sobrenome do ex-cônjuge (após a dissolução)', inciso: 'inciso III' },
    IV: { rot: 'IV – alteração das relações de filiação', inciso: 'inciso IV' },
    UE: { rot: '§ 2º – união estável registrada (inclusão ou exclusão do sobrenome do companheiro)', inciso: '§ 2º' },
  };
  const sob = criarAba({
    nome: 'sobrenome', raiz: $('#abaSobrenome'), id: 'sob',
    montar(raiz) {
      raiz.insertAdjacentHTML('beforeend', `
        <p class="aviso">As certidões apresentadas devem ter sido expedidas há no máximo 90 dias (art. 515-I, § 3º, do Código Nacional de Normas – Prov. CNJ 149/2023).</p>
        <p class="aviso" id="sobAvisoNova" hidden>Minuta nova: o requerente mudou, então o livro, a folha, o termo e o texto foram zerados.</p>`);
      const destino = blocoDestino(raiz, 'sobD');
      raiz.insertAdjacentHTML('beforeend', `
        <fieldset><legend>Hipótese</legend>
          <label>Hipótese do art. 57 <select id="sobHip"><option value="" selected>Selecione</option>
            ${Object.entries(HIPOTESES).map(([k, h]) => `<option value="${k}">${h.rot}</option>`).join('')}</select></label>
          <p class="dica" id="sobHipDica"></p>
        </fieldset>
        <fieldset><legend>Requerente</legend><div id="sobReq"></div>
          <div id="sobMenorBox" hidden>
            <p class="aviso">Requerente menor de 18 anos: o requerimento sai em nome do menor, representado por pai ou mãe, que assina.</p>
            <label>Quem representa <select id="sobRepQual"><option value="pai">Pai</option><option value="mae" selected>Mãe</option></select></label>
            <div id="sobRep"></div>
          </div>
          <div id="sobProcBox">
            <label class="opcao"><input type="checkbox" id="sobProc"> Requerente representado(a) por procurador(a) (escritura pública)</label>
            <div id="sobProcCampos" hidden>
              <div class="grade g2">
                <label>Nome do(a) procurador(a) <input id="sobProcNome"></label>
                <label>CPF do(a) procurador(a) <input id="sobProcCpf" inputmode="numeric" maxlength="14"></label>
              </div>
              <div class="grade g4">
                <label>Tabelionato <input id="sobProcTab" placeholder="ex.: 1º Tabelião de Notas de X"></label>
                <label>Livro <input id="sobProcLivro"></label>
                <label>Folhas <input id="sobProcFls"></label>
                <label>Data da escritura <input type="date" id="sobProcData"></label>
              </div>
              <p class="erros" id="sobProcVelha" hidden></p>
            </div>
          </div>
        </fieldset>
        <fieldset id="sobCasBox" hidden><legend id="sobCasLeg">Casamento</legend>
          <div class="grade g2">
            <label id="sobConjLbl">Nome do cônjuge <input id="sobConj"></label>
            <label>Local (cidade/UF) <input id="sobCasLocal"></label>
          </div>
          <div class="grade g4">
            <label>Data <input type="date" id="sobCasData"></label>
            <label id="sobCasLivroLbl">Livro B nº <input id="sobCasLivro"></label>
            <label>Folha <input id="sobCasFolha"></label>
            <label>Termo nº <input id="sobCasTermo"></label>
          </div>
          <label id="sobDissLbl" hidden>Forma da dissolução <select id="sobDiss">
            <option value="divórcio" selected>Divórcio</option><option value="falecimento do cônjuge">Falecimento do cônjuge (viuvez)</option>
            <option value="separação judicial">Separação judicial</option><option value="anulação do casamento">Anulação do casamento</option></select></label>
        </fieldset>
        <fieldset id="sobNascBox" hidden><legend>Registro de nascimento do(a) requerente</legend>
          <div class="grade g4">
            <label>Livro A nº <input id="sobNascLivro"></label>
            <label>Folha <input id="sobNascFolha"></label>
            <label>Termo nº <input id="sobNascTermo"></label>
            <span></span>
          </div>
          <label id="sobOrigemLbl">Origem do sobrenome / motivo (opcional) <input id="sobOrigem" placeholder="ex.: sobrenome da avó materna / reconhecimento de paternidade averbado em 2026"></label>
        </fieldset>
        <fieldset><legend>Alteração</legend>
          <div class="grade g2">
            <label>Incluir ou excluir <select id="sobOp"><option value="" selected>Selecione</option><option value="incluir">Incluir</option><option value="excluir">Excluir</option></select></label>
            <label>Sobrenome(s) a incluir/excluir <input id="sobSob"></label>
          </div>
          <label class="opcao" id="sobSolteiroLbl" hidden><input type="checkbox" id="sobSolteiro"> Voltar a usar o nome de solteiro(a)</label>
          <label>Nome completo que passará a usar (pode corrigir) <input id="sobNomeNovo"></label>
          <p class="aviso" id="sobAvisoAsc" hidden>Atenção: na inclusão do sobrenome do cônjuge, deve permanecer ao menos um sobrenome que ligue a pessoa a uma de suas linhas de ascendência (art. 515-L, § 1º, do Código Nacional de Normas).</p>
        </fieldset>`);
      const req = blocoPessoa($('#sobReq'), 'sobR', {});
      const rep = blocoPessoa($('#sobRep'), 'sobP', { titulo: 'Qualificação do(a) representante', completo: false });
      const texto = blocoTexto(raiz, 'sobTexto', 'II – Requerimento: texto que vai sair no documento (pode editar)');
      const fech = blocoFechamento(raiz, 'sobF');
      const hip = () => $('#sobHip').value;
      function atualizar() {
        const h = hip();
        const cas = ['II', 'III', 'UE'].includes(h);
        $('#sobCasBox').hidden = !cas;
        $('#sobNascBox').hidden = !['I', 'IV'].includes(h);
        $('#sobDissLbl').hidden = h !== 'III';
        $('#sobCasLeg').textContent = h === 'UE' ? 'União estável (registro no Livro E)' : h === 'III' ? 'Casamento dissolvido' : 'Casamento';
        $('#sobConjLbl').firstChild.textContent = h === 'UE' ? 'Nome do(a) companheiro(a) ' : h === 'III' ? 'Nome do(a) ex-cônjuge ' : 'Nome do cônjuge ';
        $('#sobCasLivroLbl').firstChild.textContent = h === 'UE' ? 'Livro E nº ' : 'Livro B nº ';
        $('#sobOrigemLbl').firstChild.textContent = h === 'IV' ? 'Alteração de filiação que motiva o pedido ' : 'Origem do sobrenome (opcional) ';
        if (h === 'I') $('#sobOp').value = 'incluir';
        if (h === 'III') $('#sobOp').value = 'excluir';
        $('#sobOp').disabled = h === 'I' || h === 'III';
        $('#sobSolteiroLbl').hidden = !(['II', 'III', 'UE'].includes(h) && $('#sobOp').value === 'excluir');
        $('#sobHipDica').textContent = h === 'II' ? 'A inclusão ou exclusão do sobrenome do cônjuge independe da anuência dele (art. 515-L do Código Nacional de Normas).' : '';
        sugerir(); verificarAsc();
      }
      let nomeEditado = false;
      function sugerir() {
        if (nomeEditado) return;
        const atual = up(limpo(req.el('nome').value)), s = up(limpo($('#sobSob').value)), op = $('#sobOp').value;
        if (!atual || !s || !op) { $('#sobNomeNovo').value = ''; return; }
        if (op === 'incluir') $('#sobNomeNovo').value = `${atual} ${s}`;
        else {
          const tira = s.split(' ').filter((w) => w.length > 0);
          let pal = atual.split(' ');
          tira.forEach((w) => { const k = pal.lastIndexOf(w); if (k > 0) pal.splice(k, 1); });
          pal = pal.filter((w, k, a) => !(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E'].includes(w) && (k === a.length - 1 || ['DE', 'DA', 'DO', 'DAS', 'DOS', 'E'].includes(a[k + 1]))));
          $('#sobNomeNovo').value = pal.join(' ');
        }
        verificarAsc();
      }
      function verificarAsc() {
        const h = hip(), op = $('#sobOp').value;
        const atual = up(limpo(req.el('nome').value)).split(' ').slice(1).filter((w) => w.length > 2);
        const novo = up(limpo($('#sobNomeNovo').value)).split(' ');
        $('#sobAvisoAsc').hidden = !(['II', 'UE'].includes(h) && op === 'incluir' && atual.length && novo.length > 1 && !atual.some((w) => novo.includes(w)));
      }
      $('#sobHip').addEventListener('change', atualizar);
      $('#sobOp').addEventListener('change', atualizar);
      [req.el('nome'), $('#sobSob')].forEach((e) => e.addEventListener('input', sugerir));
      $('#sobNomeNovo').addEventListener('input', () => { nomeEditado = true; verificarAsc(); });
      function verIdade() {
        const i = idade(req.el('nascimento').value);
        const menor = i !== null && i < 18;
        $('#sobMenorBox').hidden = !menor;
        $('#sobProcBox').hidden = menor;
        if (menor) { $('#sobProc').checked = false; $('#sobProcCampos').hidden = true; }
      }
      req.el('nascimento').addEventListener('change', verIdade);
      $('#sobProc').addEventListener('change', () => { $('#sobProcCampos').hidden = !$('#sobProc').checked; });
      $('#sobProcCpf').addEventListener('input', () => { $('#sobProcCpf').value = B.mascaraCPF($('#sobProcCpf').value); });
      $('#sobProcData').addEventListener('change', () => {
        const d = diasDesde($('#sobProcData').value), m = $('#sobProcVelha');
        if (d !== null && d > 90) { m.textContent = `A escritura foi lavrada há ${d} dias. A representação por procurador exige escritura pública lavrada há menos de 90 dias (art. 515-O do Código Nacional de Normas).`; m.hidden = false; } else m.hidden = true;
      });
      return { destino, req, rep, fech, texto, hip, atualizar, verIdade, campoChave: req.el('nome'), resetNome: () => { nomeEditado = false; } };
    },
    textoAuto(ctx) {
      const h = ctx.hip(), H = HIPOTESES[h];
      const r = ctx.req.ler(), g = (m, fe) => gx(r.sexo, m, fe);
      if (!H) return '';
      const op = $('#sobOp').value, sobn = up(limpo($('#sobSob').value)) || '[SOBRENOME]', novo = up(limpo($('#sobNomeNovo').value)) || '[NOME NOVO]';
      const conj = up(limpo($('#sobConj').value)) || '[NOME]', local = limpo($('#sobCasLocal').value) || '__', data = dataBR($('#sobCasData').value) || '__';
      const ref = `Livro ${h === 'UE' ? 'E' : 'B'}-${limpo($('#sobCasLivro').value) || '__'}, fls. ${limpo($('#sobCasFolha').value) || '__'}, termo nº ${limpo($('#sobCasTermo').value) || '__'}`;
      const refNasc = `Livro A-${limpo($('#sobNascLivro').value) || '__'}, fls. ${limpo($('#sobNascFolha').value) || '__'}, termo nº ${limpo($('#sobNascTermo').value) || '__'}`;
      const acao = `com vistas a ${op === 'excluir' ? 'EXCLUIR' : 'INCLUIR'} o(s) sobrenome(s) `;
      const solteiro = op === 'excluir' && $('#sobSolteiro').checked ? `, retornando ao uso do nome de ${g('solteiro', 'solteira')}` : '';
      let contexto;
      if (h === 'II') contexto = `${g('o', 'a')} requerente, ${g('casado', 'casada')} com ${conj}, cujo casamento realizou-se em ${local} aos ${data}, conforme ${ref}`;
      else if (h === 'UE') contexto = `${g('o', 'a')} requerente, convivente em união estável com ${conj}, registrada em ${local} aos ${data}, conforme ${ref}`;
      else if (h === 'III') contexto = `${g('o', 'a')} requerente, cujo casamento com ${conj}, realizado em ${local} aos ${data}, conforme ${ref}, foi dissolvido por ${$('#sobDiss').value}`;
      else if (h === 'I') contexto = `${g('o', 'a')} requerente, ${g('registrado', 'registrada')} conforme ${refNasc}${limpo($('#sobOrigem').value) ? ` (${limpo($('#sobOrigem').value)})` : ''}`;
      else contexto = `${g('o', 'a')} requerente, ${g('registrado', 'registrada')} conforme ${refNasc}, em razão de alteração das relações de filiação (${limpo($('#sobOrigem').value) || '___'})`;
      const extra = h === 'III' ? ', adquirido(s) em razão do casamento' : h === 'I' ? ' familiar(es)' : '';
      return `Com fulcro no disposto pelo artigo 57, ${H.inciso}, da Lei nº 6.015/1973, ${contexto}, vem, respeitosamente, requerer a V. Sa. a instauração de procedimento para alteração de nome, ${acao}${sobn}${extra}${solteiro}, passando a ser ${g('identificado', 'identificada')} como: ${novo}.`;
    },
    camposZerar: () => [$('#sobCasLivro'), $('#sobCasFolha'), $('#sobCasTermo'), $('#sobNascLivro'), $('#sobNascFolha'), $('#sobNascTermo')],
    limparExtra(ctx) {
      ctx.destino.limpar(); ctx.req.limpar(); ctx.rep.limpar(); ctx.fech.reiniciarData(); ctx.resetNome();
      $('#sobOp').disabled = false; $('#sobProcCampos').hidden = true; $('#sobProcVelha').hidden = true;
      ctx.atualizar(); ctx.verIdade();
    },
    gerar(ctx, erros) {
      const dest = ctx.destino.texto();
      if (!dest) { erros.push('Cartório de destino'); ctx.destino.el.classList.add('invalido'); }
      const h = ctx.hip();
      if (!h) { erros.push('Hipótese do art. 57'); $('#sobHip').classList.add('invalido'); }
      ctx.req.validar(erros, 'Requerente', ['nome', 'sexo', 'nacionalidade', 'estadoCivil', 'nascimento', 'logradouro', 'numero']);
      const r = ctx.req.ler();
      const i = idade(r.nascimento), menor = i !== null && i < 18;
      if (!menor) ctx.req.validar(erros, 'Requerente', ['cpf', 'rg']);
      if (menor) ctx.rep.validar(erros, 'Representante', ['nome', 'sexo', 'cpf', 'rg']);
      const proc = !menor && $('#sobProc').checked;
      if (proc) [['#sobProcNome', 'Nome do(a) procurador(a)'], ['#sobProcTab', 'Tabelionato da procuração'], ['#sobProcData', 'Data da escritura']].forEach(([s, rt]) => {
        if (!limpo($(s).value)) { erros.push(rt); $(s).classList.add('invalido'); }
      });
      [['#sobOp', 'Incluir ou excluir'], ['#sobSob', 'Sobrenome(s) a incluir/excluir'], ['#sobNomeNovo', 'Nome completo que passará a usar']].forEach(([s, rt]) => {
        if (!limpo($(s).value)) { erros.push(rt); $(s).classList.add('invalido'); }
      });
      const texto = ctx.texto.ler();
      if (!limpo(texto)) { erros.push('Texto do requerimento'); ctx.texto.ta.classList.add('invalido'); }
      if (/\[[A-Z ]+\]|-__,|fls\. __| aos __|em __ |\(___\)/.test(texto)) erros.push('O texto do requerimento ainda tem partes em branco: preencha os campos (livro, folha, termo, datas…) ou corrija o texto');
      ctx.fech.validar(erros);
      if (erros.length) return null;

      const f = ctx.fech.ler(), g = (m, fe) => gx(r.sexo, m, fe);
      const H = HIPOTESES[h];
      let qual = `${r.nome}, ${qualificacao(r)}`;
      const nomesExtra = [];
      if (menor) {
        const p = ctx.rep.ler(), qualRep = $('#sobRepQual').value === 'pai' ? 'seu pai' : 'sua mãe';
        qual += `, menor, neste ato ${g('representado', 'representada')} por ${qualRep}, ${p.nome}, ${qualificacao(p, { completo: false })}`;
        nomesExtra.push(p.nome);
      }
      if (proc) {
        const pn = up(limpo($('#sobProcNome').value)), pc = limpo($('#sobProcCpf').value);
        qual += `, neste ato ${g('representado', 'representada')} por seu(sua) procurador(a) ${pn}${pc ? `, inscrito(a) no CPF/MF sob o nº ${pc}` : ''}, conforme procuração lavrada no ${limpo($('#sobProcTab').value)}${limpo($('#sobProcLivro').value) ? `, Livro ${limpo($('#sobProcLivro').value)}` : ''}${limpo($('#sobProcFls').value) ? `, fls. ${limpo($('#sobProcFls').value)}` : ''}, em ${dataBR($('#sobProcData').value)}`;
        nomesExtra.push(pn);
      }
      const blocos = [
        enderecamento(dest),
        titulo('I – REQUERENTE:'),
        { p: [`${qual}.`], ind: RECUO },
        titulo('II – REQUERIMENTO:'),
        ...paragrafosDe(texto),
        titulo('III – DECLARAÇÕES SOB AS PENAS DA LEI:'),
        { p: [`${g('O', 'A')} requerente declara que a alteração ora requerida está de acordo com seu nome atual e que responde civil e criminalmente pela veracidade desta afirmação. Declara, ainda, que não é parte em ação judicial em trâmite sobre alteração de sobrenome ou, em caso de ação judicial com o referido escopo, que a mesma já foi devidamente arquivada, conforme certidão anexa.`], ind: RECUO },
        titulo('IV – FUNDAMENTO JURÍDICO:'),
        { p: [`O presente requerimento está fundamentado no artigo 57, ${H.inciso}, da Lei nº 6.015/1973.`], ind: RECUO },
      ];
      let ass;
      if (menor) { const p = ctx.rep.ler(); ass = assinaturaCentro(p.nome, [[`Representante legal de ${r.nome}`]]); }
      else if (proc) ass = assinaturaCentro(up(limpo($('#sobProcNome').value)), [[`Procurador(a) de ${r.nome}`]]);
      else ass = assinaturaCentro(r.nome);
      return {
        titulo: 'Requerimento de alteração de sobrenome', arquivo: nomeArquivo('alteracao-sobrenome', r.nome), chave: r.nome,
        nomes: [r.nome, r.pai, r.mae, up(limpo($('#sobConj').value)), up(limpo($('#sobSob').value)), up(limpo($('#sobNomeNovo').value)), ...nomesExtra],
        blocos: blocos.concat(fechamentoBlocos(f, [ass])),
      };
    },
  });

  window.MinutasNovas = { ret, pre, sob }; // para testes no navegador
})();
