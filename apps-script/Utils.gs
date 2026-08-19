/**
 * Funções utilitárias: normalização de texto, conversão de números,
 * formatação em padrão brasileiro e valor por extenso.
 */

/** Remove acentos, espaços duplicados e caixa, para comparar rótulos. */
function normalizar(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** true para células vazias, traço ou marcadores de ausência de dado. */
function vazio(valor) {
  var n = normalizar(valor);
  return n === '' || n === '-' || n === 'n/d' || n === 'null' || n === 'undefined';
}

/**
 * Converte para número aceitando os dois padrões que aparecem no relatório:
 * "1234.56" (padrão da API) e "1.234,56" (padrão brasileiro).
 */
function paraNumero(valor) {
  if (typeof valor === 'number') return valor;
  if (vazio(valor)) return 0;

  var s = String(valor).replace(/R\$/gi, '').replace(/\s/g, '');

  var temVirgula = s.indexOf(',') >= 0;
  var temPonto = s.indexOf('.') >= 0;

  if (temVirgula && temPonto) {
    // "1.234.567,89" -> ponto é separador de milhar
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (temVirgula) {
    // "1234,56" -> vírgula é decimal
    s = s.replace(',', '.');
  } else if (temPonto) {
    // Ambíguo: "1.234" (milhar) ou "1234.56" (decimal da API).
    // Duas casas após o último ponto => decimal.
    var partes = s.split('.');
    var ultima = partes[partes.length - 1];
    if (partes.length > 2 || ultima.length === 3) {
      s = s.replace(/\./g, '');
    }
  }

  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** Formata em real brasileiro: 1808100.42 -> "R$ 1.808.100,42". */
function formatarBRL(valor) {
  var n = paraNumero(valor);
  var negativo = n < 0;
  n = Math.abs(n);

  var inteiro = Math.floor(n);
  var centavos = Math.round((n - inteiro) * 100);
  if (centavos === 100) {
    inteiro += 1;
    centavos = 0;
  }

  var s = String(inteiro).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  var c = centavos < 10 ? '0' + centavos : String(centavos);
  return (negativo ? '-' : '') + 'R$ ' + s + ',' + c;
}

var _UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito',
  'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis',
  'dezessete', 'dezoito', 'dezenove'];
var _DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta',
  'setenta', 'oitenta', 'noventa'];
var _CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
  'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

/** Escreve por extenso um grupo de 0 a 999. */
function _grupoPorExtenso(n) {
  if (n === 0) return '';
  if (n === 100) return 'cem';

  var partes = [];
  var centena = Math.floor(n / 100);
  var resto = n % 100;

  if (centena > 0) partes.push(_CENTENAS[centena]);

  if (resto > 0) {
    if (resto < 20) {
      partes.push(_UNIDADES[resto]);
    } else {
      var dezena = Math.floor(resto / 10);
      var unidade = resto % 10;
      partes.push(unidade > 0 ? _DEZENAS[dezena] + ' e ' + _UNIDADES[unidade] : _DEZENAS[dezena]);
    }
  }

  return partes.join(' e ');
}

/**
 * Valor monetário por extenso.
 * 3102000 -> "três milhões e cento e dois mil reais"
 */
function porExtenso(valor) {
  var n = paraNumero(valor);
  var inteiro = Math.floor(Math.abs(n));
  var centavos = Math.round((Math.abs(n) - inteiro) * 100);

  if (inteiro === 0 && centavos === 0) return 'zero reais';

  var escalas = [
    { singular: 'trilhão', plural: 'trilhões', valor: 1e12 },
    { singular: 'bilhão', plural: 'bilhões', valor: 1e9 },
    { singular: 'milhão', plural: 'milhões', valor: 1e6 },
    { singular: 'mil', plural: 'mil', valor: 1e3 },
    { singular: '', plural: '', valor: 1 }
  ];

  var blocos = [];
  var restante = inteiro;

  for (var i = 0; i < escalas.length; i++) {
    var escala = escalas[i];
    var quantidade = Math.floor(restante / escala.valor);
    restante = restante % escala.valor;
    if (quantidade === 0) continue;

    var texto = _grupoPorExtenso(quantidade);
    if (escala.valor === 1e3) {
      // "mil" não leva "um" antes: 1000 -> "mil", 2000 -> "dois mil"
      texto = quantidade === 1 ? 'mil' : texto + ' mil';
    } else if (escala.valor > 1) {
      texto += ' ' + (quantidade === 1 ? escala.singular : escala.plural);
    }
    blocos.push(texto);
  }

  var extenso = _juntarComE(blocos);
  if (inteiro > 0) extenso += inteiro === 1 ? ' real' : ' reais';

  if (centavos > 0) {
    var textoCentavos = _grupoPorExtenso(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
    extenso = inteiro > 0 ? extenso + ' e ' + textoCentavos : textoCentavos;
  }

  return extenso;
}

/** Junta ["a","b","c"] como "a, b e c". */
function _juntarComE(lista) {
  if (lista.length === 0) return '';
  if (lista.length === 1) return lista[0];
  return lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1];
}

/** Aplica a máscara 00.000.000/0000-00 quando houver 14 dígitos. */
function formatarCNPJ(valor) {
  var d = String(valor === null || valor === undefined ? '' : valor).replace(/\D/g, '');
  if (d.length !== 14) return String(valor || '');
  return d.substring(0, 2) + '.' + d.substring(2, 5) + '.' + d.substring(5, 8) +
    '/' + d.substring(8, 12) + '-' + d.substring(12);
}

/** Aplica a máscara 000.000.000-00 quando houver 11 dígitos. */
function formatarCPF(valor) {
  var d = String(valor === null || valor === undefined ? '' : valor).replace(/\D/g, '');
  if (d.length !== 11) return String(valor || '');
  return d.substring(0, 3) + '.' + d.substring(3, 6) + '.' + d.substring(6, 9) + '-' + d.substring(9);
}

/** Documento com máscara automática conforme o tamanho (CPF ou CNPJ). */
function formatarDocumento(valor) {
  var d = String(valor === null || valor === undefined ? '' : valor).replace(/\D/g, '');
  if (d.length === 11) return formatarCPF(d);
  if (d.length === 14) return formatarCNPJ(d);
  return String(valor || '');
}

/**
 * Normaliza datas para dd/MM/yyyy. Aceita objeto Date, ISO
 * ("2002-03-22T00:00:00.000Z") e o formato brasileiro já pronto.
 */
function formatarData(valor) {
  if (vazio(valor)) return '';

  if (Object.prototype.toString.call(valor) === '[object Date]') {
    return Utilities.formatDate(valor, 'America/Sao_Paulo', 'dd/MM/yyyy');
  }

  var s = String(valor).trim();

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

  var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[3] + '/' + iso[2] + '/' + iso[1];

  return s;
}

/** Extrai o ID de uma URL do Drive; se já for um ID, devolve como está. */
function extrairId(entrada) {
  var s = String(entrada || '').trim();
  if (!s) return '';
  var m = s.match(/[-\w]{25,}/);
  return m ? m[0] : s;
}

/** Escapa caracteres especiais para uso em replaceText (que recebe regex). */
function escaparRegex(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Pluraliza de forma simples: (1,'processo') -> "1 processo". */
function pluralizar(quantidade, singular, plural) {
  var p = plural || singular + 's';
  return quantidade + ' ' + (quantidade === 1 ? singular : p);
}
