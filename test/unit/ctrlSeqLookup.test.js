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

  // The option dictionaries are built from names the host supplies, so they
  // can hold an entry called "hasOwnProperty". Reading them as
  // `dict.hasOwnProperty(key)` then calls that entry instead of the method
  // and throws; `hasOwn` (src/tree.ts) is the guard.
  suite('option dictionaries named after Object.prototype', function () {
    /**
     * Build a fresh MathField in the mock container.
     *
     * @param options The MathQuill config to construct it with.
     * @returns The MathField.
     */
    function fieldWith(options) {
      return MQ.MathField($('<span></span>').appendTo('#mock')[0], options);
    }

    test('autoCommands may be called hasOwnProperty', function () {
      // Control: the same field without the bogus entry. "hasOwnProperty"
      // names no registered command, so configuring it must change nothing.
      var control = fieldWith({ autoCommands: 'pi' });
      control.typedText('hasOwnProperty');
      var expected = control.latex();

      var field = fieldWith({ autoCommands: 'pi hasOwnProperty' });
      // Typing it must not throw, and must land exactly where the control
      // did: an unknown auto-command leaves the letters as typed (the
      // default autoOperatorNames still italicize "Pr" inside them).
      field.typedText('hasOwnProperty');
      assert.equal(field.latex(), expected);

      // A real auto-command in the same config still substitutes.
      field.latex('');
      field.typedText('pi');
      assert.equal(field.latex(), '\\pi');
    });

    test('autoOperatorNames may be called hasOwnProperty', function () {
      var field = fieldWith({ autoOperatorNames: 'ln hasOwnProperty' });
      field.typedText('hasOwnProperty');
      assert.equal(field.latex(), '\\operatorname{hasOwnProperty}');

      field.latex('');
      field.typedText('ln');
      assert.equal(field.latex(), '\\ln');
    });

    test('autoParenthesizedFunctions may be called hasOwnProperty', function () {
      var field = fieldWith({
        autoOperatorNames: 'ln hasOwnProperty',
        autoParenthesizedFunctions: 'hasOwnProperty',
      });
      field.typedText('hasOwnProperty');
      assert.equal(
        field.latex(),
        '\\operatorname{hasOwnProperty}\\left(\\right)'
      );
    });

    test('quietEmptyDelimiters may be called hasOwnProperty', function () {
      var field = fieldWith({ quietEmptyDelimiters: 'hasOwnProperty ()' });
      field.latex('\\left(\\right)');
      // Reading the delimiter dict must not throw.
      assert.ok(typeof field.mathspeak() === 'string');
    });

    test('config() tolerates an option named hasOwnProperty', function () {
      var field = fieldWith({});
      var options = { autoCommands: 'pi' };
      options.hasOwnProperty = 1;
      field.config(options);
      field.typedText('pi');
      assert.equal(field.latex(), '\\pi');
    });

    test('config() does not run an Object.prototype method as a processor', function () {
      var field = fieldWith({});
      var options = {};
      options.toString = 'not a processor';
      field.config(options);
      // `optionProcessors` is read with the caller's option name too. An
      // unguarded read finds Object.prototype.toString and runs it as this
      // option's processor, storing '[object Undefined]'; the value must be
      // stored verbatim instead.
      assert.equal(field.__options.toString, 'not a processor');
      field.typedText('x');
      assert.equal(field.latex(), 'x');
    });
  });
});
