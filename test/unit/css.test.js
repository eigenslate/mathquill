suite('CSS', function () {
  const $ = window.test_only_jquery;
  test("math field doesn't fuck up ancestor's .scrollWidth", function () {
    var container = $('<div>')
      .css({
        fontSize: '16px',
        height: '25px', // must be greater than font-size * 115% + 2 * 2px (padding) + 2 * 1px (border)
        width: '25px',
      })
      .appendTo('#mock')[0];
    assert.equal(container.scrollHeight, 25);
    assert.equal(container.scrollWidth, 25);

    var mq = MQ.MathField(
      $(
        '<span style="box-sizing:border-box;height:100%;width:100%"></span>'
      ).appendTo(container)[0]
    );
    assert.equal(container.scrollHeight, 25);
    assert.equal(container.scrollWidth, 25);
  });

  test('empty root block does not collapse', function () {
    var testEl = $('<span></span>').appendTo('#mock');
    var mq = MQ.MathField(testEl[0]);
    var rootEl = testEl.find('.mq-root-block');

    assert.ok(
      rootEl.hasClass('mq-empty'),
      'Empty root block should have the mq-empty class name.'
    );
    assert.ok(
      rootEl.height() > 0,
      'Empty root block height should be above 0.'
    );
  });

  test('empty block does not collapse', function () {
    var testEl = $('<span>\\frac{}{}</span>').appendTo('#mock');
    var mq = MQ.MathField(testEl[0]);
    var numeratorEl = testEl.find('.mq-numerator');

    assert.ok(
      numeratorEl.hasClass('mq-empty'),
      'Empty numerator should have the mq-empty class name.'
    );
    assert.ok(
      numeratorEl.height() > 0,
      'Empty numerator height should be above 0.'
    );
  });

  test('test florin spacing', function () {
    var mq,
      mock = $('#mock');

    mq = MQ.MathField($('<span></span>').appendTo(mock)[0]);
    mq.typedText("f'");

    var mqF = $(mq.el()).find('.mq-f');
    var testVal =
      parseFloat(mqF.css('margin-right')) - parseFloat(mqF.css('margin-left'));
    assert.ok(testVal > 0, 'this should be truthy');
  });

  test('unary PlusMinus before separator', function () {
    var mq = MQ.MathField($('<span></span>').appendTo('#mock')[0]);
    mq.latex('(-1,-1-1)-1,(+1;+1+1)+1,(\\pm1,\\pm1\\pm1)\\pm1');
    var spans = $(mq.el()).find('.mq-root-block').find('span');
    assert.equal(spans.length, 35, 'PlusMinus expression parsed incorrectly');
    function isBinaryOperator(i) {
      return $(spans[i]).hasClass('mq-binary-operator');
    }
    function assertBinaryOperator(i, s) {
      assert.ok(isBinaryOperator(i), '"' + s + '" should be binary');
    }
    function assertUnaryOperator(i, s) {
      assert.ok(!isBinaryOperator(i), '"' + s + '" should be unary');
    }

    assertUnaryOperator(1, '(-');
    assertUnaryOperator(4, '(-1,-');
    assertBinaryOperator(6, '(-1,-1-');
    assertBinaryOperator(9, '(-1,-1-1)-');
    assertUnaryOperator(13, '(-1,-1-1)-1,(+');
    assertUnaryOperator(16, '(-1,-1-1)-1,(+1;+');
    assertBinaryOperator(18, '(-1,-1-1)-1,(+1;+1+');
    assertBinaryOperator(21, '(-1,-1-1)-1,(+1;+1+1)+');
    assertUnaryOperator(25, '(-1,-1-1)-1,(+1;+1+1)+1,(pm');
    assertUnaryOperator(28, '(-1,-1-1)-1,(+1;+1+1)+1,(pm1,pm');
    assertBinaryOperator(30, '(-1,-1-1)-1,(+1;+1+1)+1,(pm1,pm1pm');
    assertBinaryOperator(33, '(-1,-1-1)-1,(+1;+1+1)+1,(pm1,pm1pm1)pm');
  });

  test('proper unary/binary within style block', function () {
    var mq = MQ.MathField($('<span></span>').appendTo('#mock')[0]);
    mq.latex('\\class{dummy}{-}2\\class{dummy}{+}4');
    var spans = $(mq.el()).find('.mq-root-block').find('span');
    assert.equal(spans.length, 6, 'PlusMinus expression parsed incorrectly');

    function isBinaryOperator(i) {
      return $(spans[i]).hasClass('mq-binary-operator');
    }
    function assertBinaryOperator(i, s) {
      assert.ok(isBinaryOperator(i), '"' + s + '" should be binary');
    }
    function assertUnaryOperator(i, s) {
      assert.ok(!isBinaryOperator(i), '"' + s + '" should be unary');
    }

    assertUnaryOperator(1, '\\class{dummy}{-}');
    assertBinaryOperator(4, '\\class{dummy}{-}2\\class{dummy}{+}');

    mq.latex('\\textcolor{red}{-}2\\textcolor{green}{+}4');
    spans = $(mq.el()).find('.mq-root-block').find('span');
    assert.equal(spans.length, 6, 'PlusMinus expression parsed incorrectly');

    assertUnaryOperator(1, '\\textcolor{red}{-}');
    assertBinaryOperator(4, '\\textcolor{red}{-}2\\textcolor{green}{+}');

    //test recursive depths
    mq.latex(
      '\\textcolor{red}{\\class{dummy}{-}}2\\textcolor{green}{\\class{dummy}{+}}4'
    );
    spans = $(mq.el()).find('.mq-root-block').find('span');
    assert.equal(spans.length, 8, 'PlusMinus expression parsed incorrectly');

    assertUnaryOperator(2, '\\textcolor{red}{\\class{dummy}{-}}');
    assertBinaryOperator(
      6,
      '\\textcolor{red}{\\class{dummy}{-}}2\\textcolor{green}{\\class{dummy}{+}}'
    );
  });

  test('operator name spacing e.g. sin x', function () {
    var mq = MQ.MathField($('<span></span>').appendTo(mock)[0]);

    mq.typedText('sin');
    var n = $('#mock var.mq-operator-name:last');
    assert.equal(n.text(), 'n');
    assert.ok(!n.is('.mq-last'));

    mq.typedText('x');
    assert.ok(n.is('.mq-last'));

    mq.keystroke('Left').typedText('(');
    assert.ok(!n.is('.mq-last'));

    mq.keystroke('Backspace').typedText('^');
    assert.ok(!n.is('.mq-last'));
    var supsub = $('#mock .mq-supsub');
    assert.ok(supsub.is('.mq-after-operator-name'));

    mq.typedText('2').keystroke('Tab').typedText('(');
    assert.ok(!supsub.is('.mq-after-operator-name'));

    $(mq.el()).empty();
  });

  suite('type scale', function () {
    /**
     * Renders `latex` as a StaticMath in #mock and returns the computed
     * font-size in px of the root block and of every `.mq-supsub` /
     * `.mq-fraction` inside it, in document order.
     *
     * @param {string} latex expression to render
     * @returns {{root: number, supsubs: number[], fractions: number[]}}
     */
    function scaleOf(latex) {
      var mq = MQ.StaticMath(
        $('<span>' + latex + '</span>').appendTo('#mock')[0]
      );
      var el = mq.el();
      /**
       * @param {Element} node
       * @returns {number} computed font-size in px
       */
      function px(node) {
        return parseFloat(window.getComputedStyle(node).fontSize);
      }
      /**
       * @param {string} sel CSS selector to collect sizes for
       * @returns {number[]} computed font-sizes in document order
       */
      function sizes(sel) {
        return Array.prototype.map.call(el.querySelectorAll(sel), px);
      }
      return {
        root: px(el.querySelector('.mq-root-block')),
        supsubs: sizes('.mq-supsub'),
        fractions: sizes('.mq-fraction'),
      };
    }

    test('a script shrinks once and a top-level fraction is untouched', function () {
      // Plain `x^2` and a plain fraction must keep the 90% shrink; the two
      // capping rules below must not reach them.
      var sup = scaleOf('x^2');
      assert.equal(Math.round((sup.supsubs[0] / sup.root) * 1000), 900);

      var frac = scaleOf('\\frac{a}{b}');
      assert.equal(Math.round((frac.fractions[0] / frac.root) * 1000), 900);
    });

    test('a fraction inside a script is not re-shrunk', function () {
      var s = scaleOf('x^{\\frac{a}{b}}');
      assert.equal(s.supsubs.length, 1);
      assert.equal(s.fractions.length, 1);
      // The script's own 90% is the only shrink the fraction gets.
      assert.equal(Math.round((s.supsubs[0] / s.root) * 1000), 900);
      assert.equal(s.fractions[0], s.supsubs[0]);
    });

    test('nested scripts floor at the first level', function () {
      var s = scaleOf('x^{y^{z}}');
      assert.equal(s.supsubs.length, 2);
      assert.equal(Math.round((s.supsubs[0] / s.root) * 1000), 900);
      assert.equal(s.supsubs[1], s.supsubs[0]);

      // Three deep is still the first level's size.
      var deep = scaleOf('a^{b^{c^{d}}}');
      assert.equal(deep.supsubs.length, 3);
      assert.equal(deep.supsubs[1], deep.supsubs[0]);
      assert.equal(deep.supsubs[2], deep.supsubs[0]);
    });
  });
});
