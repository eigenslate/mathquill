suite('matrix', function () {
  const $ = window.test_only_jquery;
  var mq, controller;

  setup(function () {
    mq = MQ.MathField($('<span></span>').appendTo('#mock')[0]);
    controller = mq.__controller;
  });

  /**
   * Find the Matrix node inside the field, so tests can drive it directly
   * rather than guessing at keystroke sequences.
   */
  function findMatrix() {
    var found = null;
    controller.root.postOrder(function (node) {
      if (node instanceof Matrix) found = node;
    });
    return found;
  }

  /**
   * Put the cursor inside a matrix cell. addColumn/deleteColumn read
   * cursor.parent.row to decide where to land afterwards, so they are only ever
   * valid with the cursor in the matrix.
   */
  function focusCell(matrix, row, col) {
    controller.cursor.insAtLeftEnd(matrix.cells[row][col]);
  }

  /**
   * Count reflow() calls on every ancestor of the matrix by wrapping them.
   * Structural matrix edits must bubble a reflow, because ancestors that size
   * themselves by MEASURING the matrix (stretchy brackets, the \iterate loop)
   * are otherwise left drawn from dimensions it no longer has.
   */
  function countAncestorReflows(matrix) {
    var count = 0;
    var node = matrix.parent;
    while (node) {
      (function (n) {
        var original = n.reflow;
        n.reflow = function () {
          count += 1;
          return original.apply(this, arguments);
        };
      })(node);
      node = node.parent;
    }
    return function () {
      return count;
    };
  }

  suite('structural edits bubble a reflow', function () {
    // Regression: rebuildDOM() is the single funnel every add/delete row or
    // column goes through, and it rebuilt the DOM without bubbling a reflow.
    // Ordinary edits bubble one via MathCommand.finalizeInsert, so only the
    // matrix mutations went stale — adding rows then deleting them left
    // measuring ancestors badly offset.
    test('addRow bubbles a reflow to ancestors', function () {
      controller.renderLatexMath('\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}');
      var matrix = findMatrix();
      assert.ok(matrix, 'matrix rendered');
      focusCell(matrix, 0, 0);

      var reflows = countAncestorReflows(matrix);
      matrix.addRow(0, controller);
      assert.ok(reflows() > 0, 'addRow bubbled a reflow');
    });

    test('deleteRow bubbles a reflow to ancestors', function () {
      controller.renderLatexMath(
        '\\begin{pmatrix}1&2\\\\3&4\\\\5&6\\end{pmatrix}'
      );
      var matrix = findMatrix();
      assert.ok(matrix, 'matrix rendered');
      focusCell(matrix, 0, 0);

      var reflows = countAncestorReflows(matrix);
      matrix.deleteRow(0, controller);
      assert.ok(reflows() > 0, 'deleteRow bubbled a reflow');
    });

    test('addColumn bubbles a reflow to ancestors', function () {
      controller.renderLatexMath('\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}');
      var matrix = findMatrix();
      assert.ok(matrix, 'matrix rendered');
      focusCell(matrix, 0, 0);

      var reflows = countAncestorReflows(matrix);
      matrix.addColumn(1, controller.cursor);
      assert.ok(reflows() > 0, 'addColumn bubbled a reflow');
    });

    test('deleteColumn bubbles a reflow to ancestors', function () {
      controller.renderLatexMath(
        '\\begin{pmatrix}1&2&3\\\\4&5&6\\end{pmatrix}'
      );
      var matrix = findMatrix();
      assert.ok(matrix, 'matrix rendered');
      focusCell(matrix, 0, 0);

      var reflows = countAncestorReflows(matrix);
      matrix.deleteColumn(1, controller);
      assert.ok(reflows() > 0, 'deleteColumn bubbled a reflow');
    });
  });

  // The editor is deliberately permissive about nesting: it parses, renders
  // and creates nested matrices. The calc engine is the only thing that
  // rejects them, and it does so at evaluation with its own error.
  suite('nested matrices', function () {
    /**
     * Count the \begin{...} environments in a latex string — one per matrix,
     * so 2 means one matrix nested inside another.
     */
    function countMatrices(latex) {
      return (latex.match(/\\begin\{/g) || []).length;
    }

    /**
     * Render a 2x2 matrix and leave the cursor at the right end of cell (0,0),
     * i.e. inside the matrix, where a nested matrix would be created.
     */
    function cursorInsideCell() {
      mq.latex('\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}');
      var matrix = findMatrix();
      assert.ok(matrix, 'matrix rendered');
      controller.cursor.insAtRightEnd(matrix.cells[0][0]);
      return matrix;
    }

    test('.cmd() inside a matrix cell nests a matrix', function () {
      cursorInsideCell();

      mq.cmd('\\pmatrix');

      assert.equal(
        countMatrices(mq.latex()),
        2,
        'inner matrix created, got ' + mq.latex()
      );
    });

    // The autocommand route consumes the typed trigger letters and inserts the
    // command in their place, inside a cell as anywhere else.
    test('typing the "pmat" autocommand inside a cell nests a matrix', function () {
      mq.config({ autoCommands: 'pmat' });
      cursorInsideCell();

      mq.typedText('pmat');

      var latex = mq.latex();
      assert.equal(
        countMatrices(latex),
        2,
        'inner matrix created, got ' + latex
      );
      // Don't search for a leftover 'pmat' — it is a substring of
      // '\begin{pmatrix}'. The '1' the cursor sat after is what must survive.
      assert.ok(latex.indexOf('1\\begin{pmatrix}') > -1, 'got ' + latex);
    });

    // Regression pin: nested-matrix latex from a saved document or a paste
    // must keep parsing and rendering, or saved content would silently vanish.
    test('nested-matrix latex parses and round-trips', function () {
      var nested =
        '\\begin{pmatrix}\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}&5\\\\6&7\\end{pmatrix}';
      mq.latex(nested);

      var latex = mq.latex();
      assert.equal(
        countMatrices(latex),
        2,
        'inner matrix parsed, got ' + latex
      );
      assert.equal(
        latex,
        '\\begin{pmatrix}\\begin{pmatrix}1 & 2 \\\\ 3 & 4\\end{pmatrix} & 5 \\\\ 6 & 7\\end{pmatrix}',
        'serializes with the nesting intact'
      );

      // Re-parsing what it serialized must be stable, since that is what a
      // saved document round-trip actually does.
      mq.latex(latex);
      assert.equal(mq.latex(), latex, 'round-trips unchanged');
    });
  });
});
