suite('autoSubscript', function () {
  const $ = window.test_only_jquery;
  var mq;
  setup(function () {
    mq = MQ.MathField($('<span></span>').appendTo('#mock')[0], {
      autoSubscriptNumerals: true,
    });
    rootBlock = mq.__controller.root;
    controller = mq.__controller;
    cursor = controller.cursor;
  });

  test('auto subscripting variables', function () {
    mq.latex('x');
    mq.typedText('2');
    assert.equal(mq.latex(), 'x_{2}');
    mq.typedText('3');
    assert.equal(mq.latex(), 'x_{23}');
  });

  test('do not autosubscript functions', function () {
    mq.latex('sin');
    mq.typedText('2');
    assert.equal(mq.latex(), '\\sin2');
    mq.typedText('3');
    assert.equal(mq.latex(), '\\sin23');
  });

  test('autosubscript exponentiated variables', function () {
    mq.latex('x^2');
    mq.typedText('2');
    assert.equal(mq.latex(), 'x_{2}^{2}');
    mq.typedText('3');
    assert.equal(mq.latex(), 'x_{23}^{2}');
  });

  test('do not autosubscript exponentiated functions', function () {
    mq.latex('sin^{2}');
    mq.typedText('2');
    assert.equal(mq.latex(), '\\sin^{2}2');
    mq.typedText('3');
    assert.equal(mq.latex(), '\\sin^{2}23');
  });

  test('do not autosubscript subscripted functions', function () {
    mq.latex('sin_{10}');
    mq.typedText('2');
    assert.equal(mq.latex(), '\\sin_{10}2');
  });

  test('backspace through compound subscript', function () {
    mq.latex('x_{2_2}');

    //first backspace moves to cursor in subscript and peels it off
    mq.keystroke('Backspace');
    assert.equal(mq.latex(), 'x_{2}');

    //second backspace clears out remaining subscript
    mq.keystroke('Backspace');
    assert.equal(mq.latex(), 'x_{ }');

    //unpeel subscript
    mq.keystroke('Backspace');
    assert.equal(mq.latex(), 'x');
  });

  test('backspace through simple subscript', function () {
    mq.latex('x_{2+3}');

    assert.equal(cursor.parent, rootBlock, 'start in the root block');

    //backspace peels off subscripts but stays at the root block level
    mq.keystroke('Backspace');
    assert.equal(mq.latex(), 'x_{2+}');
    assert.equal(
      cursor.parent,
      rootBlock,
      'backspace keeps us in the root block'
    );
    mq.keystroke('Backspace');
    assert.equal(mq.latex(), 'x_{2}');
    assert.equal(
      cursor.parent,
      rootBlock,
      'backspace keeps us in the root block'
    );

    //second backspace clears out remaining subscript and unpeels
    mq.keystroke('Backspace');
    assert.equal(mq.latex(), 'x');
  });

  test('backspace through subscript & superscript with autosubscripting on', function () {
    mq.latex('x_2^{32}');

    //first backspace peels off the subscript
    mq.keystroke('Backspace');
    assert.equal(mq.latex(), 'x^{32}');

    //second backspace goes into the exponent
    mq.keystroke('Backspace');
    assert.equal(mq.latex(), 'x^{32}');

    //clear out exponent
    mq.keystroke('Backspace');
    mq.keystroke('Backspace');
    assert.equal(mq.latex(), 'x^{ }');

    //unpeel exponent
    mq.keystroke('Backspace');
    assert.equal(mq.latex(), 'x');
  });

  // `charsThatBreakOutOfSupSub` is tested BEFORE the auto-subscript branch, so
  // a break-out character wins even inside an auto-subscript. Upstream ran the
  // auto-subscript branch first and it returns early for every subscript, so
  // `=` used to stay inside (`x_{2=}`). See CLAUDE.md "SupSub typing".
  suite('break-out characters inside an auto-subscript', function () {
    var mqBreak;
    setup(function () {
      mqBreak = MQ.MathField($('<span></span>').appendTo('#mock')[0], {
        autoSubscriptNumerals: true,
        charsThatBreakOutOfSupSub: '+-=<>',
      });
    });

    test('= leaves the auto-subscript', function () {
      assert.equal(mqBreak.typedText('x2=').latex(), 'x_{2}=');
      assert.equal(mqBreak.typedText('3').latex(), 'x_{2}=3');
      mqBreak.latex('');
      assert.equal(mqBreak.typedText('x23=').latex(), 'x_{23}=');
    });

    // The case the reorder actually fixes: an explicitly typed `_` leaves the
    // caret INSIDE the subscript (unlike the auto-subscript path, which ejects
    // it), so the write patch is what has to break out — and with the
    // auto-subscript branch running first it never got the chance.
    test('= leaves an explicitly typed subscript', function () {
      assert.equal(mqBreak.typedText('x_2=').latex(), 'x_{2}=');
      mqBreak.latex('');
      assert.equal(mqBreak.typedText('x_ab+').latex(), 'x_{ab}+');
      mqBreak.latex('');
      assert.equal(mqBreak.typedText('x_2-y').latex(), 'x_{2}-y');
    });

    test('+ leaves the auto-subscript', function () {
      assert.equal(mqBreak.typedText('x2+y').latex(), 'x_{2}+y');
    });

    test('- leaves the auto-subscript', function () {
      assert.equal(mqBreak.typedText('x2-3').latex(), 'x_{2}-3');
    });

    test('< and > leave the auto-subscript', function () {
      assert.equal(mqBreak.typedText('x2<y').latex(), 'x_{2}<y');
      mqBreak.latex('');
      assert.equal(mqBreak.typedText('x2>y').latex(), 'x_{2}>y');
    });

    test('digits still auto-subscript', function () {
      assert.equal(mqBreak.typedText('x23').latex(), 'x_{23}');
    });

    test('first character of a subscript never breaks out', function () {
      assert.equal(mqBreak.typedText('x_-1').latex(), 'x_{-1}');
    });

    test('first character of a superscript never breaks out', function () {
      assert.equal(mqBreak.typedText('x^-1').latex(), 'x^{-1}');
      mqBreak.latex('');
      assert.equal(mqBreak.typedText('x^=2n').latex(), 'x^{=2n}');
    });

    test('mid-subscript caret does not break out', function () {
      assert.equal(mqBreak.typedText('x_23').latex(), 'x_{23}');
      assert.equal(mqBreak.keystroke('Left').typedText('+').latex(), 'x_{2+3}');
    });

    test('superscripts break out with auto-subscripting on', function () {
      assert.equal(mqBreak.typedText('x^2=3').latex(), 'x^{2}=3');
    });
  });
});
