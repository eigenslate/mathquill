// LimitOperator (\lim, \limsup, \liminf with an under slot) and Calligraphic
// (\mathcal{X} script letters). App spec/ux.md §5.1 "Limits" and
// "Calligraphic letters".
suite('limit operator', function () {
  const $ = window.test_only_jquery;
  var mq;

  setup(function () {
    mq = MQ.MathField($('<span></span>').appendTo('#mock')[0], {
      autoOperatorNames: 'sin lim limsup liminf sup inf injlim',
      autoSubscriptNumerals: true,
      charsThatBreakOutOfSupSub: '+-=<>',
    });
  });

  /**
   * The LimitOperator nodes directly in the root block.
   * @returns {Array} The root's LimitOperator children.
   */
  function rootLimits() {
    var out = [];
    mq.__controller.root.eachChild(function (child) {
      if (child instanceof LimitOperator) out.push(child);
      return undefined;
    });
    return out;
  }

  test('parses \\lim with and without a limit, round-tripping exactly', function () {
    mq.latex('\\lim_{x\\to0}f(x)');
    assert.equal(mq.latex(), '\\lim_{x\\to0}f(x)');
    assert.equal(rootLimits().length, 1);
    mq.latex('\\lim x');
    assert.equal(mq.latex(), '\\lim x');
    mq.latex('\\lim');
    assert.equal(mq.latex(), '\\lim');
    mq.latex('\\lim_x');
    assert.equal(mq.latex(), '\\lim_{x}');
    mq.latex('\\limsup_{n\\to\\infty}a_n+\\liminf_{n}b');
    assert.equal(mq.latex(), '\\limsup_{n\\to\\infty}a_{n}+\\liminf_{n}b');
    assert.equal(rootLimits().length, 2);
  });

  test('the limit is the command, not an operator-name letter run', function () {
    mq.latex('\\lim_{x\\to0}x');
    var lim = rootLimits()[0];
    assert.equal(lim.word, 'lim');
    assert.equal(lim.getEnd(L).latex(), 'x\\to 0');
    // Rendered under the word, in the large-operator layout.
    var el = lim.domFrag().oneElement();
    assert.ok(el.classList.contains('mq-limit'));
    assert.ok(el.querySelector('.mq-from'));
    assert.equal(el.querySelector('.mq-to'), null);
  });

  test('typing the word converts to the command; _ opens the under slot', function () {
    mq.typedText('lim');
    assert.equal(mq.latex(), '\\lim');
    assert.equal(rootLimits().length, 1);
    mq.typedText('_x');
    mq.cmd('\\to');
    mq.typedText('0');
    assert.equal(mq.latex(), '\\lim_{x\\to0}');
    mq.keystroke('Right').typedText('x');
    assert.equal(mq.latex(), '\\lim_{x\\to0}x');
  });

  test('typing limsup and liminf upgrades the empty-slot lim', function () {
    mq.typedText('limsup');
    assert.equal(mq.latex(), '\\limsup');
    assert.equal(rootLimits().length, 1);
    assert.equal(rootLimits()[0].word, 'limsup');
    mq.latex('');
    mq.typedText('liminf_n');
    assert.equal(mq.latex(), '\\liminf_{n}');
    mq.latex('');
    // A filled slot is not upgraded: the letters after it stay separate.
    mq.typedText('lim_n');
    mq.keystroke('Right').typedText('sup');
    assert.equal(mq.latex(), '\\lim_{n}\\sup');
  });

  test('longest auto operator name wins, so injlim is not split', function () {
    mq.typedText('injlim');
    assert.equal(mq.latex(), '\\injlim');
    assert.equal(rootLimits().length, 0);
    mq.latex('');
    mq.typedText('xlim');
    assert.equal(mq.latex(), 'x\\lim');
  });

  test('a limit word not in autoOperatorNames stays letters', function () {
    mq.config({ autoOperatorNames: 'sin' });
    mq.typedText('lim');
    assert.equal(mq.latex(), 'lim');
    assert.equal(rootLimits().length, 0);
  });

  test('no conversion directly in a subscript with the disable flag', function () {
    mq.config({ disableAutoSubstitutionInSubscripts: true });
    mq.typedText('x_lim');
    assert.equal(mq.latex(), 'x_{lim}');
  });

  test('letters spelling a limit word by other means stay plain', function () {
    mq.latex('\\operatorname{lim}');
    assert.equal(mq.latex(), 'lim');
  });

  test('backspace from the empty slot, and over the command, removes it', function () {
    mq.typedText('lim_');
    mq.keystroke('Backspace');
    assert.equal(mq.latex(), '');
    mq.typedText('lim');
    mq.keystroke('Backspace');
    assert.equal(mq.latex(), '');
  });

  test('an empty limit slot shows the empty-block box, like a sum', function () {
    mq.latex('\\lim');
    var slot = rootLimits()[0].getEnd(L).domFrag().oneElement();
    assert.ok(slot.classList.contains('mq-empty'));
    assert.ok(getComputedStyle(slot).display !== 'none');
    assert.ok(slot.offsetWidth > 0 && slot.offsetHeight > 0);
    // Same box as a sum's empty lower limit.
    var limBox = slot.getBoundingClientRect();
    mq.latex('\\sum');
    var sumSlot = mq.el().querySelector('.mq-from .mq-empty');
    var sumBox = sumSlot.getBoundingClientRect();
    assert.equal(Math.round(limBox.width), Math.round(sumBox.width));
    assert.equal(Math.round(limBox.height), Math.round(sumBox.height));
  });

  test('^ after the limit is an ordinary superscript', function () {
    mq.typedText('lim^2');
    assert.equal(mq.latex(), '\\lim^{2}');
    assert.equal(rootLimits()[0].getEnd(L).isEmpty(), true);
  });

  test('\\lim as an autoCommand is rejected like other operator names', function () {
    assert.throws(function () {
      MQ.config({ autoCommands: 'lim' });
    });
    assert.throws(function () {
      MQ.config({ autoCommands: 'limsup' });
    });
  });
});

suite('mathcal', function () {
  const $ = window.test_only_jquery;
  var mq;

  setup(function () {
    mq = MQ.MathField($('<span></span>').appendTo('#mock')[0]);
  });

  /**
   * The rendered script glyphs inside the field, in order.
   * @returns {string} The concatenated text of every .mq-script-letter.
   */
  function glyphs() {
    var out = '';
    var els = mq.el().querySelectorAll('.mq-script-letter');
    for (var i = 0; i < els.length; i += 1) out += els[i].textContent;
    return out;
  }

  test('script glyph table, including the BMP exceptions', function () {
    assert.equal(scriptLetterGlyph('A'), String.fromCharCode(0xd835, 0xdc9c));
    assert.equal(scriptLetterGlyph('L'), String.fromCharCode(0x2112));
    assert.equal(scriptLetterGlyph('e'), String.fromCharCode(0x212f));
    assert.equal(scriptLetterGlyph('a'), String.fromCharCode(0xd835, 0xdcb6));
    assert.equal(scriptLetterGlyph('z'), String.fromCharCode(0xd835, 0xdccf));
  });

  test('loads, renders script glyphs and round-trips', function () {
    mq.latex('\\mathcal{L}+x');
    assert.equal(mq.latex(), '\\mathcal{L}+x');
    assert.equal(glyphs(), String.fromCharCode(0x2112));
    mq.latex('\\mathcal{AB1}');
    assert.equal(mq.latex(), '\\mathcal{AB1}');
    assert.equal(
      glyphs(),
      String.fromCharCode(0xd835, 0xdc9c) + String.fromCharCode(0x212c)
    );
    mq.latex('\\mathcal L');
    assert.equal(mq.latex(), '\\mathcal{L}');
  });

  test('script glyphs come from the shipped MathQuill Script face', function () {
    mq.latex('\\mathcal{AL}');
    var el = mq.el().querySelector('.mq-script-letter');
    assert.equal(
      getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, ''),
      'MathQuill Script'
    );
    var probe =
      String.fromCharCode(0xd835, 0xdc9c) + String.fromCharCode(0x2112);
    return document.fonts
      .load('1em "MathQuill Script"', probe)
      .then(function (faces) {
        assert.equal(faces.length, 1);
        assert.equal(faces[0].status, 'loaded');
        assert.ok(document.fonts.check('1em "MathQuill Script"', probe));
      });
  });

  test('loading it never empties the field', function () {
    mq.latex('y=\\mathcal{F}');
    assert.equal(mq.latex(), 'y=\\mathcal{F}');
  });

  test('typed: \\mathcal, Enter, letters become script glyphs', function () {
    mq.typedText('\\mathcal');
    mq.keystroke('Enter');
    mq.typedText('L2');
    assert.equal(mq.latex(), '\\mathcal{L2}');
    // Only the letter is a script glyph; the digit stays plain.
    assert.equal(glyphs(), String.fromCharCode(0x2112));
    mq.keystroke('Right').typedText('x');
    assert.equal(mq.latex(), '\\mathcal{L2}x');
  });
});
