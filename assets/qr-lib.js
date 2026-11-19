/* Comly QR — compact, dependency-free QR encoder (byte mode, versions 1-10).
 * Runs in the browser (window.ComlyQR) and in Node (globalThis.ComlyQR).
 * No network calls, no canvas required: output is crisp SVG.
 */
(function (root) {
  'use strict';

  /* Galois field GF(256), primitive polynomial 0x11d ----------------- */
  var EXP = new Uint8Array(512);
  var LOG = new Uint8Array(256);
  (function () {
    var i;
    for (i = 0; i < 8; i++) EXP[i] = 1 << i;
    for (i = 8; i < 256; i++) EXP[i] = EXP[i - 4] ^ EXP[i - 5] ^ EXP[i - 6] ^ EXP[i - 8];
    for (i = 0; i < 255; i++) LOG[EXP[i]] = i;
    for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  function mul(a, b) {
    return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];
  }

  function generator(n) {
    var g = [1];
    for (var i = 0; i < n; i++) {
      var next = new Array(g.length + 1).fill(0);
      for (var j = 0; j < g.length; j++) {
        next[j] ^= g[j];
        next[j + 1] ^= mul(g[j], EXP[i]);
      }
      g = next;
    }
    return g;
  }

  function ecc(data, gen) {
    var res = new Array(gen.length - 1).fill(0);
    for (var i = 0; i < data.length; i++) {
      var factor = data[i] ^ res[0];
      res.shift();
      res.push(0);
      for (var j = 0; j < res.length; j++) res[j] ^= mul(gen[j + 1], factor);
    }
    return res;
  }

  /* Spec tables: [blockCount, totalCodewords, dataCodewords, ...] ---- */
  var RS = {
    L: [
      [1, 26, 19], [1, 44, 34], [1, 70, 55], [1, 100, 80], [1, 134, 108],
      [2, 86, 68], [2, 98, 78], [2, 121, 97], [2, 146, 116], [2, 86, 68, 2, 87, 69]
    ],
    M: [
      [1, 26, 16], [1, 44, 28], [1, 70, 44], [2, 50, 32], [2, 67, 43],
      [4, 43, 27], [4, 49, 31], [2, 60, 38, 2, 61, 39], [3, 58, 36, 2, 59, 37], [4, 69, 43, 1, 70, 44]
    ],
    Q: [
      [1, 26, 13], [1, 44, 22], [2, 35, 17], [2, 50, 24], [2, 33, 15, 2, 34, 16],
      [4, 43, 19], [2, 32, 14, 4, 33, 15], [4, 40, 18, 2, 41, 19], [4, 36, 16, 4, 37, 17], [6, 43, 19, 2, 44, 20]
    ],
    H: [
      [1, 26, 9], [1, 44, 16], [2, 35, 13], [4, 25, 9], [2, 33, 11, 2, 34, 12],
      [4, 43, 15], [4, 39, 13, 1, 40, 14], [4, 40, 14, 2, 41, 15], [4, 36, 12, 4, 37, 13], [6, 43, 15, 2, 44, 16]
    ]
  };

  var ALIGN = [
    [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
    [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]
  ];

  var EC_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  function blocks(version, level) {
    var row = RS[level][version - 1];
    var out = [];
    for (var i = 0; i < row.length; i += 3) {
      for (var n = 0; n < row[i]; n++) out.push({ total: row[i + 1], data: row[i + 2] });
    }
    return out;
  }

  function dataCapacity(version, level) {
    return blocks(version, level).reduce(function (sum, b) { return sum + b.data; }, 0);
  }

  /* BCH check bits --------------------------------------------------- */
  function digit(n) {
    var d = 0;
    while (n !== 0) { d++; n >>>= 1; }
    return d;
  }

  function bch(data, g) {
    var d = data;
    while (digit(d) - digit(g) >= 0) d ^= g << (digit(d) - digit(g));
    return d;
  }

  function formatBits(ec, mask) {
    var data = (EC_BITS[ec] << 3) | mask;
    return (((data << 10) | bch(data << 10, 0x537)) ^ 0x5412) & 0x7fff;
  }

  function versionBits(version) {
    return (((version << 12) | bch(version << 12, 0x1F25)) & 0x3ffff);
  }

  /* UTF-8 bytes ------------------------------------------------------ */
  function utf8(text) {
    if (typeof TextEncoder !== 'undefined') return Array.prototype.slice.call(new TextEncoder().encode(text));
    var out = [];
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < text.length) {
        var c2 = text.charCodeAt(++i);
        var cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
        out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      } else out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  /* Codeword stream -------------------------------------------------- */
  function codewords(version, level, bytes) {
    var cap = dataCapacity(version, level);
    var bits = [];
    function put(num, len) {
      for (var i = len - 1; i >= 0; i--) bits.push((num >>> i) & 1);
    }
    put(4, 4);                                  // byte mode
    put(bytes.length, version <= 9 ? 8 : 16);   // character count
    for (var i = 0; i < bytes.length; i++) put(bytes[i], 8);
    put(0, Math.min(4, Math.max(0, cap * 8 - bits.length)));
    while (bits.length % 8) put(0, 1);

    var out = [];
    for (var b = 0; b < bits.length; b += 8) {
      var v = 0;
      for (var j = 0; j < 8; j++) v = (v << 1) | bits[b + j];
      out.push(v);
    }
    var pad = 0xEC;
    while (out.length < cap) { out.push(pad); pad = (pad === 0xEC) ? 0x11 : 0xEC; }
    return out;
  }

  function interleave(version, level, data) {
    var list = blocks(version, level);
    var genCache = {};
    var dc = [];
    var ec = [];
    var offset = 0;
    list.forEach(function (block) {
      var n = block.total - block.data;
      if (!genCache[n]) genCache[n] = generator(n);
      var chunk = data.slice(offset, offset + block.data);
      offset += block.data;
      dc.push(chunk);
      ec.push(ecc(chunk, genCache[n]));
    });
    var out = [];
    var maxData = Math.max.apply(null, dc.map(function (a) { return a.length; }));
    var maxEc = Math.max.apply(null, ec.map(function (a) { return a.length; }));
    for (var i = 0; i < maxData; i++) dc.forEach(function (a) { if (i < a.length) out.push(a[i]); });
    for (var k = 0; k < maxEc; k++) ec.forEach(function (a) { if (k < a.length) out.push(a[k]); });
    return out;
  }

  /* Matrix construction --------------------------------------------- */
  var MASKS = [
    function (r, c) { return (r + c) % 2 === 0; },
    function (r) { return r % 2 === 0; },
    function (r, c) { return c % 3 === 0; },
    function (r, c) { return (r + c) % 3 === 0; },
    function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
    function (r, c) { return ((r * c) % 2) + ((r * c) % 3) === 0; },
    function (r, c) { return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; },
    function (r, c) { return (((r * c) % 3) + ((r + c) % 2)) % 2 === 0; }
  ];

  function Matrix(version, level) {
    this.version = version;
    this.level = level;
    this.size = version * 4 + 17;
    this.m = [];
    this.fixed = [];
    for (var r = 0; r < this.size; r++) {
      this.m.push(new Array(this.size).fill(false));
      this.fixed.push(new Array(this.size).fill(false));
    }
  }

  Matrix.prototype.set = function (r, c, dark) {
    if (r < 0 || c < 0 || r >= this.size || c >= this.size) return;
    this.m[r][c] = !!dark;
    this.fixed[r][c] = true;
  };

  Matrix.prototype.finder = function (row, col) {
    for (var r = -1; r <= 7; r++) {
      for (var c = -1; c <= 7; c++) {
        var dark = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                   (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                   (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        this.set(row + r, col + c, dark);
      }
    }
  };

  Matrix.prototype.alignment = function (row, col) {
    for (var r = -2; r <= 2; r++) {
      for (var c = -2; c <= 2; c++) {
        this.set(row + r, col + c,
          r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0));
      }
    }
  };

  Matrix.prototype.timing = function () {
    for (var i = 8; i < this.size - 8; i++) {
      if (!this.fixed[i][6]) this.set(i, 6, i % 2 === 0);
      if (!this.fixed[6][i]) this.set(6, i, i % 2 === 0);
    }
  };

  Matrix.prototype.typeInfo = function (mask) {
    var bits = formatBits(this.level, mask);
    for (var i = 0; i < 15; i++) {
      var dark = ((bits >> i) & 1) === 1;
      if (i < 6) this.set(i, 8, dark);
      else if (i < 8) this.set(i + 1, 8, dark);
      else this.set(this.size - 15 + i, 8, dark);

      if (i < 8) this.set(8, this.size - i - 1, dark);
      else if (i === 8) this.set(8, 7, dark);
      else this.set(8, 15 - i - 1, dark);
    }
    this.set(this.size - 8, 8, true); // fixed dark module
  };

  Matrix.prototype.typeNumber = function () {
    if (this.version < 7) return;
    var bits = versionBits(this.version);
    for (var i = 0; i < 18; i++) {
      var dark = ((bits >> i) & 1) === 1;
      var a = Math.floor(i / 3);
      var b = (i % 3) + this.size - 8 - 3;
      this.set(a, b, dark);
      this.set(b, a, dark);
    }
  };

  Matrix.prototype.place = function (bytes, mask) {
    var inc = -1;
    var row = this.size - 1;
    var bit = 7;
    var byte = 0;
    var flip = MASKS[mask];
    for (var col = this.size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      while (true) {
        for (var c = 0; c < 2; c++) {
          if (!this.fixed[row][col - c]) {
            var dark = byte < bytes.length ? ((bytes[byte] >>> bit) & 1) === 1 : false;
            if (flip(row, col - c)) dark = !dark;
            this.set(row, col - c, dark);
            bit--;
            if (bit === -1) { byte++; bit = 7; }
          }
        }
        row += inc;
        if (row < 0 || row >= this.size) { row -= inc; inc = -inc; break; }
      }
    }
  };

  Matrix.prototype.penalty = function () {
    var n = this.size;
    var m = this.m;
    var score = 0;
    var r, c, i, run, dark;

    function penaltyRun(len) { return len >= 5 ? 3 + (len - 5) : 0; }

    // N1 + N3: rows and columns
    for (i = 0; i < n; i++) {
      run = 1;
      for (c = 1; c < n; c++) {
        if (m[i][c] === m[i][c - 1]) run++;
        else { score += penaltyRun(run); run = 1; }
      }
      score += penaltyRun(run);
      run = 1;
      for (r = 1; r < n; r++) {
        if (m[r][i] === m[r - 1][i]) run++;
        else { score += penaltyRun(run); run = 1; }
      }
      score += penaltyRun(run);

      for (c = 0; c + 10 < n; c++) {
        if ((m[i][c] && !m[i][c + 1] && m[i][c + 2] && m[i][c + 3] && m[i][c + 4] &&
             !m[i][c + 5] && m[i][c + 6] && !m[i][c + 7] && !m[i][c + 8] && !m[i][c + 9] && !m[i][c + 10]) ||
            (!m[i][c] && !m[i][c + 1] && !m[i][c + 2] && !m[i][c + 3] && m[i][c + 4] &&
             !m[i][c + 5] && m[i][c + 6] && m[i][c + 7] && m[i][c + 8] && m[i][c + 9] && m[i][c + 10])) score += 40;
        if ((m[c][i] && !m[c + 1][i] && m[c + 2][i] && m[c + 3][i] && m[c + 4][i] &&
             !m[c + 5][i] && m[c + 6][i] && !m[c + 7][i] && !m[c + 8][i] && !m[c + 9][i] && !m[c + 10][i]) ||
            (!m[c][i] && !m[c + 1][i] && !m[c + 2][i] && !m[c + 3][i] && m[c + 4][i] &&
             !m[c + 5][i] && m[c + 6][i] && m[c + 7][i] && m[c + 8][i] && m[c + 9][i] && m[c + 10][i])) score += 40;
      }
    }

    // N2: same-colour 2x2 blocks
    for (r = 0; r < n - 1; r++) {
      for (c = 0; c < n - 1; c++) {
        dark = m[r][c];
        if (dark === m[r][c + 1] && dark === m[r + 1][c] && dark === m[r + 1][c + 1]) score += 3;
      }
    }

    // N4: dark module ratio
    dark = 0;
    for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (m[r][c]) dark++;
    score += Math.floor(Math.abs((dark * 100 / (n * n)) - 50) / 5) * 10;
    return score;
  };

  /* Public API ------------------------------------------------------- */
  function matrix(text, options) {
    options = options || {};
    var level = String(options.level || 'M').toUpperCase();
    if (!RS[level]) throw new Error('QR_BAD_LEVEL');
    var str = String(text);
    var bytes = utf8(str);
    var version = 1;
    while (version <= 10 && (4 + (version <= 9 ? 8 : 16) + bytes.length * 8) > dataCapacity(version, level) * 8) version++;
    if (version > 10) throw new Error('QR_TOO_LONG');

    var data = interleave(version, level, codewords(version, level, bytes));
    var best = null;
    for (var mask = 0; mask < 8; mask++) {
      var qr = new Matrix(version, level);
      qr.finder(0, 0);
      qr.finder(0, qr.size - 7);
      qr.finder(qr.size - 7, 0);
      var pos = ALIGN[version - 1];
      for (var a = 0; a < pos.length; a++) {
        for (var b = 0; b < pos.length; b++) {
          if (!qr.fixed[pos[a]][pos[b]]) qr.alignment(pos[a], pos[b]);
        }
      }
      qr.timing();
      qr.typeNumber();
      qr.typeInfo(mask);
      qr.place(data, mask);
      var penalty = qr.penalty();
      if (!best || penalty < best.penalty) best = { penalty: penalty, mask: mask, modules: qr.m.map(function (row) { return row.slice(); }) };
    }
    return { size: best.modules.length, version: version, level: level, mask: best.mask, modules: best.modules };
  }

  function svg(text, options) {
    options = options || {};
    var res = matrix(text, options);
    var scale = options.scale || 4;
    var quiet = options.quiet == null ? 4 : options.quiet;
    var fg = options.foreground || '#09090b';
    var bg = options.background || '#ffffff';
    var dim = (res.size + quiet * 2) * scale;
    var d = [];
    for (var r = 0; r < res.size; r++) {
      for (var c = 0; c < res.size; c++) {
        if (res.modules[r][c]) {
          d.push('M' + ((c + quiet) * scale) + ' ' + ((r + quiet) * scale) + 'h' + scale + 'v' + scale + 'h-' + scale + 'z');
        }
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + dim + '" height="' + dim +
      '" viewBox="0 0 ' + dim + ' ' + dim + '" shape-rendering="crispEdges" role="img" aria-label="QR code">' +
      '<rect width="' + dim + '" height="' + dim + '" fill="' + bg + '"/>' +
      '<path d="' + d.join('') + '" fill="' + fg + '"/></svg>';
  }

  function dataUrl(text, options) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(text, options));
  }

  var api = {
    matrix: matrix,
    svg: svg,
    dataUrl: dataUrl,
    maxLength: function (level) { return dataCapacity(10, level || 'M') - 3; },
    levels: ['L', 'M', 'Q', 'H']
  };

  root.ComlyQR = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
