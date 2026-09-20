/**
 * Control-sequence lookups must only find OWN entries of LatexCmds/CharCmds.
 *
 * The command tables are plain objects, so an unguarded `LatexCmds[name]`
 * also reaches Object.prototype: `\constructor` used to resolve to `Object`
 * and `\toString` to a function, and the parser then constructed or called
 * them as if they were registered commands. `lookUpCmd` (src/tree.ts) is the
 * guard; these tests pin the behaviour at every user-reachable entry point.
 */
suite('control sequence lookup', function () {
  const $ = window.test_only_jquery;

  // Every Object.prototype member whose name the LaTeX parser can actually
  // spell: the control-sequence parser takes `[a-z]+` after the backslash,
  // so only the alphabetic ones are reachable.
  const PROTO_NAMES = [
    'constructor',
    'toString',
    'toLocaleString',
    'valueOf',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
  ];

  var mq;
  setup(function () {
    mq = MQ.MathField($('<span></span>').appendTo('#mock')[0]);
  });

  suite('latexMathParser', function () {
    /**
     * Parse a LaTeX string the way the field does and hand back its latex.
     *
     * @param str The LaTeX source to parse.
     * @returns The re-serialized latex of the parse result.
     */
    function parseToLatex(str) {
      return latexMathParser
        .parse(str)
        .postOrder(function (node) {
          node.finalizeTree(Options.prototype);
        })
        .join('latex');
    }

    test('a prototype name is an unknown command, not a hit', function () {
      PROTO_NAMES.forEach(function (name) {
        var err;
        try {
          parseToLatex('\\' + name);
        } catch (e) {
          err = e;
        }
        assert.ok(err, '\\' + name + ' should not parse');
        // Specifically a parser failure at that control sequence. An
        // unguarded lookup instead blows up constructing or calling the
        // inherited member, which is also a throw but a TypeError, not a
        // parse error.
        assert.ok(
          /^Parse Error/.test(String(err)) &&
            String(err).indexOf('\\' + name) > -1,
          '\\' + name + ' should fail to parse, got: ' + err
        );
      });
    });

    test('a registered command still resolves', function () {
      assert.equal(parseToLatex('\\frac{1}{2}'), '\\frac{1}{2}');
      assert.equal(parseToLatex('\\alpha'), '\\alpha ');
    });

    test('escaped punctuation still resolves via its backslash key', function () {
      // LatexCmds['\\,'] — the backslash-prefixed key lookUpCtrlSeq tries
      // first. A bare comma must stay a comma.
      assert.equal(parseToLatex('\\,'), '\\, ');
      assert.equal(parseToLatex('5\\,\\text{m}'), '5\\, \\text{m}');
      assert.equal(parseToLatex(','), ',');
    });
  });

  suite('.latex() round trip', function () {
    test('a prototype name renders as nothing, and does not throw', function () {
      PROTO_NAMES.forEach(function (name) {
        mq.latex('\\' + name);
        assert.equal(mq.latex(), '', '\\' + name + ' should render empty');
      });
    });

    test('a registered command round trips', function () {
      mq.latex('\\frac{1}{2}');
      assert.equal(mq.latex(), '\\frac{1}{2}');
      mq.latex('a\\,b');
      assert.equal(mq.latex(), 'a\\, b');
    });
  });

  suite('typed LaTeX', function () {
    /**
     * Type `\name` into the field and commit it with Enter.
     *
     * @param name The command name to type after the backslash.
     */
    function typeCommand(name) {
      mq.typedText('\\' + name);
      mq.keystroke('Enter');
    }

    test('a typed prototype name behaves like any unknown command', function () {
      // The unknown-command fallback turns the typed text into a TextBlock.
      mq.latex('');
      typeCommand('notacommandatall');
      var unknown = mq.latex();
      assert.equal(unknown, '\\text{notacommandatall}');

      PROTO_NAMES.forEach(function (name) {
        mq.latex('');
        typeCommand(name);
        assert.equal(
          mq.latex(),
          '\\text{' + name + '}',
          '\\' + name + ' should fall back to text'
        );
      });
    });

    test('a typed registered command still resolves', function () {
      mq.latex('');
      typeCommand('sqrt');
      assert.equal(mq.latex(), '\\sqrt{ }');
    });
  });

  suite('.cmd()', function () {
    test('a prototype name inserts nothing', function () {
      PROTO_NAMES.forEach(function (name) {
        mq.latex('');
        mq.cmd('\\' + name);
        assert.equal(mq.latex(), '', '\\' + name + ' should insert nothing');
      });
    });

    test('a registered command still resolves', function () {
      mq.latex('');
      mq.cmd('\\frac');
      assert.equal(mq.latex(), '\\frac{ }{ }');
    });
  });
});
