suite('cases (piecewise)', function () {
  const $ = window.test_only_jquery;
  var mq, controller;

  setup(function () {
    mq = MQ.MathField($('<span></span>').appendTo('#mock')[0]);
    controller = mq.__controller;
  });

  /**
   * Find the (single) Matrix node in the field so tests can inspect its
   * shape and place the cursor in a chosen row.
   */
  function findMatrix() {
    var found = null;
    controller.root.postOrder(function (node) {
      if (node instanceof Matrix) found = node;
    });
    return found;
  }

  /**
   * Put the cursor at the left end of row `row` of a cases block.
   */
  function focusRow(matrix, row) {
    controller.cursor.insAtLeftEnd(matrix.cells[row][0]);
  }

  /**
   * Row index of the cell the cursor currently sits in, or -1 when the
   * cursor is not inside a matrix cell.
   */
  function cursorRow() {
    var parent = controller.cursor.parent;
    return parent instanceof MatrixCell ? parent.row : -1;
  }

  suite('parsing and serialisation', function () {
    test('\\begin{cases} round-trips with rows split on \\\\ and no &', function () {
      // MathQuill drops insignificant spaces inside a row (`x>0: x^{2}` reads
      // back as `x>0:x^{2}`), as it does everywhere; the row structure is what
      // must survive.
      mq.latex('\\begin{cases}x>0: x^{2} \\\\ -x\\end{cases}');
      var m = findMatrix();
      assert.ok(m, 'cases rendered');
      assert.equal(m.environment, 'cases');
      assert.equal(m.nRows, 2);
      assert.equal(m.nCols, 1);
      var latex = '\\begin{cases}x>0:x^{2} \\\\ -x\\end{cases}';
      assert.equal(mq.latex(), latex);
      mq.latex(latex);
      assert.equal(mq.latex(), latex, 'stable on re-parse');
    });

    test('an empty interior row survives a reload; a trailing \\\\ does not add one', function () {
      mq.latex('\\begin{cases}a \\\\  \\\\ c \\\\ \\end{cases}');
      var m = findMatrix();
      assert.equal(m.nRows, 3, 'blank middle row kept, trailing part dropped');
      var latex = '\\begin{cases}a \\\\   \\\\ c\\end{cases}';
      assert.equal(mq.latex(), latex);
      mq.latex(latex);
      assert.equal(findMatrix().nRows, 3, 'round-trips with the empty case');
    });

    test('a bare & is kept as a literal symbol, not a column split', function () {
      mq.latex('\\begin{cases}a & b\\end{cases}');
      var m = findMatrix();
      assert.ok(m, 'cases rendered');
      assert.equal(m.nCols, 1, 'still one column');
      // The ampersand is MathQuill's `\&` symbol, so it serialises as such.
      assert.equal(mq.latex(), '\\begin{cases}a\\&b\\end{cases}');
    });

    test('renders one left brace, no right delimiter, with the cases class', function () {
      mq.latex('\\begin{cases}1 \\\\ 2\\end{cases}');
      var root = controller.root.domFrag().oneElement();
      assert.equal(root.querySelectorAll('.mq-matrix-cases').length, 1);
      assert.equal(root.querySelectorAll('.mq-matrix-delim-left').length, 1);
      assert.equal(root.querySelectorAll('.mq-matrix-delim-right').length, 0);
    });

    test('text() and mathspeak() name the cases', function () {
      mq.latex('\\begin{cases}1 \\\\ 2\\end{cases}');
      var m = findMatrix();
      assert.equal(m.text(), '{1; 2}');
      assert.equal(
        m.mathspeak(),
        'Start 2 cases, Case 1: 1; Case 2: 2, End cases'
      );
    });
  });

  suite('creation', function () {
    test('\\cases + Enter creates a block with a single row', function () {
      mq.typedText('\\cases');
      mq.keystroke('Enter');
      var m = findMatrix();
      assert.ok(m, 'cases created');
      assert.equal(m.environment, 'cases');
      assert.equal(m.nRows, 1);
      assert.equal(m.nCols, 1);
      assert.equal(cursorRow(), 0, 'cursor starts in the first row');
    });

    test('the "cases" autocommand creates the same block', function () {
      mq.config({ autoCommands: 'cases' });
      mq.typedText('cases');
      var m = findMatrix();
      assert.ok(m, 'cases created');
      assert.equal(m.nRows, 1);
      assert.equal(mq.latex(), '\\begin{cases} \\end{cases}');
    });
  });

  suite('keystrokes', function () {
    test('Enter adds a row below the current one', function () {
      mq.latex('\\begin{cases}a \\\\ b\\end{cases}');
      var m = findMatrix();
      focusRow(m, 0);
      mq.keystroke('Enter');
      assert.equal(m.nRows, 3);
      assert.equal(cursorRow(), 1, 'cursor lands in the new row');
      mq.typedText('c');
      assert.equal(mq.latex(), '\\begin{cases}a \\\\ c \\\\ b\\end{cases}');
    });

    test('comma is a literal comma', function () {
      mq.latex('\\begin{cases}a \\\\ b\\end{cases}');
      var m = findMatrix();
      controller.cursor.insAtRightEnd(m.cells[0][0]);
      mq.typedText(',');
      assert.equal(m.nCols, 1, 'no column added');
      assert.equal(mq.latex(), '\\begin{cases}a, \\\\ b\\end{cases}');
    });

    test('Ctrl-, does not add a column', function () {
      mq.latex('\\begin{cases}a \\\\ b\\end{cases}');
      var m = findMatrix();
      focusRow(m, 0);
      mq.keystroke('Ctrl-,');
      assert.equal(m.nCols, 1);
      assert.equal(mq.latex(), '\\begin{cases}a \\\\ b\\end{cases}');
    });

    test('Up / Down / Tab move between rows', function () {
      mq.latex('\\begin{cases}a \\\\ b \\\\ c\\end{cases}');
      var m = findMatrix();
      focusRow(m, 0);
      mq.keystroke('Down');
      assert.equal(cursorRow(), 1);
      mq.keystroke('Down');
      assert.equal(cursorRow(), 2);
      mq.keystroke('Up');
      assert.equal(cursorRow(), 1);
      mq.keystroke('Tab');
      assert.equal(cursorRow(), 2);
      // On the last row Tab falls through to the default: leave the block.
      mq.keystroke('Tab');
      assert.equal(cursorRow(), -1, 'left the block');
    });

    test('Backspace in an empty row removes that row', function () {
      mq.latex('\\begin{cases}a \\\\  \\\\ c\\end{cases}');
      var m = findMatrix();
      assert.equal(m.nRows, 3);
      focusRow(m, 1);
      mq.keystroke('Backspace');
      assert.equal(m.nRows, 2);
      assert.equal(mq.latex(), '\\begin{cases}a \\\\ c\\end{cases}');
      assert.equal(cursorRow(), 0, 'cursor moves to the row above');
      assert.ok(!controller.cursor[R], 'at the end of that row');
    });

    test('Backspace in the last remaining empty row removes the whole block', function () {
      mq.latex('x\\begin{cases} \\end{cases}y');
      var m = findMatrix();
      assert.ok(m, 'cases rendered');
      assert.equal(m.nRows, 1);
      focusRow(m, 0);
      mq.keystroke('Backspace');
      assert.equal(findMatrix(), null, 'block removed');
      assert.equal(mq.latex(), 'xy');
      mq.typedText('z');
      assert.equal(mq.latex(), 'xzy', 'caret stayed where the block was');
    });

    test('Backspace at the start of a non-empty row moves to the end of the row above', function () {
      mq.latex('\\begin{cases}a \\\\ b\\end{cases}');
      var m = findMatrix();
      focusRow(m, 1);
      mq.keystroke('Backspace');
      assert.equal(m.nRows, 2, 'nothing deleted');
      assert.equal(mq.latex(), '\\begin{cases}a \\\\ b\\end{cases}');
      assert.equal(cursorRow(), 0);
      assert.ok(!controller.cursor[R], 'at the end of row 0');
    });

    test('Backspace at the start of the first non-empty row leaves the block leftward', function () {
      mq.latex('x\\begin{cases}a \\\\ b\\end{cases}');
      var m = findMatrix();
      focusRow(m, 0);
      mq.keystroke('Backspace');
      assert.equal(
        mq.latex(),
        'x\\begin{cases}a \\\\ b\\end{cases}',
        'nothing deleted'
      );
      assert.equal(cursorRow(), -1, 'outside the block');
      assert.equal(controller.cursor[R], m, 'immediately left of the block');
    });

    test('Backspace inside row content still deletes a character', function () {
      mq.latex('\\begin{cases}ab \\\\ c\\end{cases}');
      var m = findMatrix();
      controller.cursor.insAtRightEnd(m.cells[0][0]);
      mq.keystroke('Backspace');
      assert.equal(mq.latex(), '\\begin{cases}a \\\\ c\\end{cases}');
    });
  });

  // The generalisation must leave ordinary matrices exactly as they were.
  suite('matrices are unchanged', function () {
    test('comma in a pmatrix still adds a column', function () {
      mq.latex('\\begin{pmatrix}a\\end{pmatrix}');
      var m = findMatrix();
      controller.cursor.insAtRightEnd(m.cells[0][0]);
      mq.typedText(',');
      assert.equal(m.nCols, 2);
      mq.typedText('b');
      assert.equal(mq.latex(), '\\begin{pmatrix}a & b\\end{pmatrix}');
    });

    test('Ctrl-, in a pmatrix still adds a column', function () {
      mq.latex('\\begin{pmatrix}a\\end{pmatrix}');
      var m = findMatrix();
      controller.cursor.insAtRightEnd(m.cells[0][0]);
      mq.keystroke('Ctrl-,');
      assert.equal(m.nCols, 2);
    });

    test('pmatrix keeps both delimiters and centred cells', function () {
      mq.latex('\\begin{pmatrix}a & b\\end{pmatrix}');
      var root = controller.root.domFrag().oneElement();
      assert.equal(root.querySelectorAll('.mq-matrix-cases').length, 0);
      assert.equal(root.querySelectorAll('.mq-matrix-delim-left').length, 1);
      assert.equal(root.querySelectorAll('.mq-matrix-delim-right').length, 1);
    });
  });

  // A cases block is a single column, so Up/Down are its ONLY vertical
  // navigation — and before the fix the first and last rows swallowed the key
  // (MatrixCell.upOutOf/downOutOf returned undefined instead of leaving the
  // block), trapping the caret exactly as in a matrix.
  suite('up/down navigation', function () {
    /**
     * Render a three-row cases block with content on both sides of it, so
     * "immediately before/after the block" is a distinguishable position.
     * @returns The Matrix node for the block.
     */
    function casesWithNeighbours() {
      mq.latex('x+\\begin{cases}a \\\\ b \\\\ c\\end{cases}+y');
      var m = findMatrix();
      assert.ok(m, 'cases rendered');
      assert.equal(m.nRows, 3, 'three cases');
      return m;
    }

    test('Up from an interior row steps to the row above', function () {
      var m = casesWithNeighbours();
      focusRow(m, 1);

      mq.keystroke('Up');

      assert.equal(cursorRow(), 0, 'cursor is in the row above');
    });

    test('Down from an interior row steps to the row below', function () {
      var m = casesWithNeighbours();
      focusRow(m, 1);

      mq.keystroke('Down');

      assert.equal(cursorRow(), 2, 'cursor is in the row below');
    });

    test('Up from the first row leaves the block, landing before it', function () {
      var m = casesWithNeighbours();
      focusRow(m, 0);

      mq.keystroke('Up');

      assert.equal(controller.cursor.parent, controller.root, 'left the block');
      assert.equal(
        controller.cursor[R],
        m,
        'cursor is immediately before the block'
      );
    });

    test('Down from the last row leaves the block, landing after it', function () {
      var m = casesWithNeighbours();
      focusRow(m, 2);

      mq.keystroke('Down');

      assert.equal(controller.cursor.parent, controller.root, 'left the block');
      assert.equal(
        controller.cursor[L],
        m,
        'cursor is immediately after the block'
      );
    });

    // The host app steps between its boxes on the field's own handlers, so
    // leaving the block must not consume the press.
    test('leaving the block still reaches the field handlers on the same press', function () {
      var ups = 0,
        downs = 0;
      var field = MQ.MathField($('<span></span>').appendTo('#mock')[0], {
        handlers: {
          upOutOf: function () {
            ups += 1;
          },
          downOutOf: function () {
            downs += 1;
          },
        },
      });
      var fieldCtrlr = field.__controller;
      field.latex('\\begin{cases}a \\\\ b\\end{cases}');
      var block = null;
      fieldCtrlr.root.postOrder(function (node) {
        if (node instanceof Matrix) block = node;
      });
      assert.ok(block, 'cases rendered');

      fieldCtrlr.cursor.insAtLeftEnd(block.cells[0][0]);
      field.keystroke('Up');
      assert.equal(ups, 1, 'the field saw upOutOf');
      assert.equal(fieldCtrlr.cursor[R], block, 'caret sits before the block');

      fieldCtrlr.cursor.insAtLeftEnd(block.cells[1][0]);
      field.keystroke('Down');
      assert.equal(downs, 1, 'the field saw downOutOf');
      assert.equal(fieldCtrlr.cursor[L], block, 'caret sits after the block');
    });

    test('Left/Right still walk in and out sideways', function () {
      var m = casesWithNeighbours();
      focusRow(m, 1);

      mq.keystroke('Left');
      assert.equal(
        controller.cursor.parent,
        controller.root,
        'Left from the start of a row leaves the block'
      );
      assert.equal(controller.cursor[R], m, 'landing before it');

      controller.cursor.insAtRightEnd(m.cells[1][0]);
      mq.keystroke('Right');
      assert.equal(
        controller.cursor.parent,
        controller.root,
        'Right from the end of a row leaves the block'
      );
      assert.equal(controller.cursor[L], m, 'landing after it');
    });
  });
});
