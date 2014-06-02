var EditSession = CodeMirror.Doc;

/**
 * @constructor
 * @param {DOM} elementId
 * @param {Settings} settings
 */
function EditorCodeMirror(editorElement, settings) {
    this.element_ = editorElement;
    this.settings_ = settings;
    this.cm_ = CodeMirror(
        editorElement,
        {
            'value': '',
            'autofocus': true,
            'matchBrackets': true,
            'highlightSelectionMatches': {
                minChars: 1,
                delay: 0,
                caseInsensitive: true
            },
            /*ops below added by morgan.. NOTE: this does not seem to work here as the settings get overriden*/
            foldGutter: true,
            gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter", "CodeMirror-lint-markers"],
            styleActiveLine: true,
            autoCloseTags: false,
            scrollPastEnd: true,
            dragDrop: false,
            autoCloseBrackets: true,
            showTrailingSpace: false,
            cursorScrollMargin: 200,
            scrollPastEnd: true,
            extraKeys: {
                "Ctrl-I": function (cm) {
                    server.showType(cm);
                },
                "Ctrl-Space": function (cm) {
                    cmAutoComplete(cm);
                },
                "Alt-.": function (cm) {
                    server.jumpToDef(cm);
                },
                "Alt-,": function (cm) {
                    server.jumpBack(cm);
                },
                "Ctrl-Q": function (cm) {
                    server.rename(cm);
                },
                "Alt-0": function (cm) {
                    //console.log(cm, 'cm');
                    cm.foldSelectionOrAll();
                },
                "Shift-Alt-0": function (cm) {
                    cm.unfoldSelectionOrAll();
                },
                "Shift-Tab": function (cm) {
                    cm.execCommand('indentLess');
                },
                "Ctrl-K": function (cm) {
                    cm.autoFormatRange(cm.getCursor(true), cm.getCursor(false));
                },
                "Ctrl-L": function (cm) {
                    //cm.goToLine();
                    console.log('need to implement this');
                }                
            },
        });
    this.cm_.setSize(null, 'auto');
    this.cm_.on('change', this.onChange.bind(this));
    this.setTheme();
    this.search_ = new Search(this.cm_);
    this.defaultTabHandler_ = CodeMirror.commands.defaultTab;

    /*below: added by morgan*/
    //log(this.cm_, 'this.cm_');
    //This is signalled when the editor's document is replaced using the swapDoc method.    
    //this.cm_.on('swapDoc', function () { log('swapdoc'); });
    this.cm_.on('swapDoc', this.onSwapDoc.bind(this));


    //https://groups.google.com/forum/#!searchin/codemirror/autocomplete/codemirror/QPRoe05BNxM/VpZqon5E5W4J
    var debounce;
    this.cm_.on("inputRead", function (cm) {
        clearTimeout(debounce);
        if (!cm.state.completionActive) debounce = setTimeout(function () {
            cmAutoComplete(cm, true);
        }, 50);
    });

    //testing tern....
    window.server = new CodeMirror.TernServer({       
        useWorker: true
    });
}


//cust auto complete handler for ctrl+space and on typing
function cmAutoComplete(cm, bool_HotKeyNotPressed) {
    var curToken = cm.getTokenAt(cm.getCursor()); //what user is currently typing 
    var lastTypedChar = curToken.string.substring(curToken.string.length - 1);
    if (bool_HotKeyNotPressed === true) { //only show auto complete if current string allows 
        if (curToken.type === "comment") {
            return;
        }
    }
    var mode = cm.getModeAt(cm.getCursor());
    var options = {
        completeSingle: false,
        closeOnUnfocus: true
    };
    if (mode.name === "javascript") {
        if (bool_HotKeyNotPressed === true) { //only show if user just typed a period
            if (lastTypedChar !== ".") {
                return;
            }
        }
        server.complete(cm);
    }
    else if (mode.name === "xml") {
        if (bool_HotKeyNotPressed === true) { //do not show if current char is a space
            if (lastTypedChar !== "<") {
                return;
            }
        }
        if (curToken.state.htmlState.state.name == "attrContinuedState") { //hack for inline style tags-
            // CodeMirror.showHint(cm, CodeMirror.hint.css, options);
            //need to mess with css-hint.js to finalize this hack (its complicated)
            CodeMirror.showHint(cm, CodeMirror.hint.html, options); //COMEBACK-- when css is fixed, remove this 
        }
        else {
            CodeMirror.showHint(cm, CodeMirror.hint.html, options);
        }
    }
    else if (mode.name === "css") {
        if (bool_HotKeyNotPressed === true) { //do not show if current char is a space
            if (lastTypedChar == " " || lastTypedChar == ";") {
                return;
            }
        }
        CodeMirror.showHint(cm, CodeMirror.hint.css, options);
    }
    // console.log(mode.name);
}



/**
 * Added by morgan.  
 * This is signalled when the editor's document is replaced using the swapDoc method.
 *  {@link http://codemirror.net/doc/manual.html#swapdoc}
 */
EditorCodeMirror.prototype.onSwapDoc = function () {
    //log('doc swapped event fired');
    //log('onSwapDoc calling autoSetMode');
    this.autoSetModeAddOns();
}
/**
 * Added by morgan. 
 * Called by onSwapDoc AND when setMode is called because onSwapDoc doesn't know the current mode when a new doc is added (so setMode call is needed) and setMode is NOT called when a new doc is added (but swapDoc is). Could make this work better in future by finding correct event
 */
EditorCodeMirror.prototype.autoSetModeAddOns = function () {
    //By Morgan- auto add some features for certain mode    
    var mode = this.cm_.getMode().name;
    if (mode == 'null') {//mode is null first time doc is loaded (but not when swapped back)
        return;
    }    
    var DBG = 'setting mode to: ' + mode;
    if (mode == 'javascript' || mode == 'htmlmixed') {
        this.cm_.setOption('lint', CodeMirror.lint.javascript)
        DBG += '; --- turning on javscript lint';
    }
    else if (mode == 'css') {
        this.cm_.setOption('lint', CodeMirror.lint.css)
        DBG += '; --- turning on css lint';
    }
    else if (mode == 'yaml') {
        this.cm_.setOption('lint', CodeMirror.lint.json)
        DBG += '; --- turning on json lint';
    }
    else {
        this.cm_.setOption('lint', '')
        DBG += '; --- turning off lint';
    }
    console.log(DBG);
};
/**
 * Added by morgan. Cleans code using beautify
 */
EditorCodeMirror.prototype.formatCode = function (bool_DoNotCollapse) {
    var mode = this.cm_.getMode().name;
    if (mode != 'javascript' && mode != 'htmlmixed' && mode != 'css' && mode != 'xml' && mode != 'yaml') {
        console.log('formatCode called bu exiting because mode is: ' + mode);
        return;
    }
    //get current cursor posistion
    var row = editor.getCursor().line;
    var col = editor.getCursor().ch;
    //Options documentation: https://www.npmjs.org/package/js-beautify
    var source = this.cm_.getValue();
    var opts = {};
    opts.indent_size = '4';
    opts.indent_char = ' ';
    opts.max_preserve_newlines = '0';
    opts.preserve_newlines = opts.max_preserve_newlines !== -1;
    opts.keep_array_indentation = false;
    opts.break_chained_methods = false;
    opts.indent_scripts = 'normal';
    opts.brace_style = 'end-expand'; /*[collapse|expand|end-expand]*/
    opts.space_before_conditional = true;
    opts.unescape_strings = false;
    opts.wrap_line_length = '0';
    opts.space_after_anon_function = true;

    var output = '';
    if (mode == 'htmlmixed' || mode == 'xml') {
        output =html_beautify(source, opts);
    }
    else if (mode == 'javascript' || mode == 'yaml') {
        output = js_beautify(source, opts);
    }
    else if (mode == 'css') {
        output = css_beautify(source, opts);
    }
    this.cm_.setValue(output);
    if (bool_DoNotCollapse !== true) {        
        this.cm_.foldSelectionOrAll();        
    }
    this.cm_.setCursor(row, col);
}
















/**
 * @param {string} [opt_content=''] - Content to load in the editor
 * @return {EditSession}
 * Create an edit session for a new file. Each tab should have its own session.
 * {@link http://codemirror.net/doc/manual.html#api_doc} 
 */
EditorCodeMirror.prototype.newSession = function (opt_content) {
    //log(opt_content,'new sesssion')
    var session = new CodeMirror.Doc(opt_content || '');
    return session;
};
/**
 * @param {EditSession} session
 * Change the current session, usually to switch to another tab.
 */
EditorCodeMirror.prototype.setSession = function (session) {
    //log(session, 'session from setSession');
    this.cm_.swapDoc(session);
};

/**
 * @return {Search}
 * Return search object.
 */
EditorCodeMirror.prototype.getSearch = function () {
    return this.search_;
};

EditorCodeMirror.prototype.onChange = function () {
    $.event.trigger('docchange', this.cm_.getDoc());
};

EditorCodeMirror.prototype.undo = function () {
    this.cm_.undo();
};

EditorCodeMirror.prototype.redo = function () {
    this.cm_.redo();
};

EditorCodeMirror.prototype.focus = function () {
    this.cm_.focus();
};
/**
 * Sets mode for document. Called by NewTab and Switch Tab functions
 * @param {Session} session
 * @param {string} extension
 */
EditorCodeMirror.prototype.setMode = function (session, extension) {
    var mode = EditorCodeMirror.EXTENSION_TO_MODE[extension];
    if (mode) {
        var currentSession = null;
        if (session !== this.cm_.getDoc()) {
            currentSession = this.cm_.swapDoc(session);
        }
        this.cm_.setOption('mode', mode);
        if (currentSession !== null) {
            this.cm_.swapDoc(currentSession);
        }
        //Log('setMode calling autoSetMode');
        //CALL THIS: as first time doc is added, this needs to be fired because SwapDoc doesn't know mode yet
        this.autoSetModeAddOns();
    }
};

/**
 * @param {number} fontSize
 * Update font size from settings.
 */
EditorCodeMirror.prototype.setFontSize = function (fontSize) {
    $('.CodeMirror').css('font-size', fontSize + 'px');
    this.cm_.refresh();
};

/**
 * @param {number} size
 */
EditorCodeMirror.prototype.setTabSize = function (size) {
    this.cm_.setOption('tabSize', size);
    this.replaceTabWithSpaces(this.settings_.get('spacestab'));
};

/**
 * @param {string} theme
 */
EditorCodeMirror.prototype.setTheme = function (theme) {
    this.cm_.setOption('theme', theme || 'default');
};

/**
 * @param {boolean} val
 */
EditorCodeMirror.prototype.showHideLineNumbers = function (val) {
    this.cm_.setOption('lineNumbers', val);
};

/**
 * @param {boolean} val
 */
EditorCodeMirror.prototype.setWrapLines = function (val) {
    this.cm_.setOption('lineWrapping', val);
};

/**
 * @param {boolean} val
 */
EditorCodeMirror.prototype.setSmartIndent = function (val) {
    this.cm_.setOption('smartIndent', val);
};

/**
 * @param {boolean} val
 */
EditorCodeMirror.prototype.replaceTabWithSpaces = function (val) {
    if (val) {
        // Need to update this closure once the tabsize has changed. So, have to
        // call this method when it happens.
        var tabsize = this.settings_.get('tabsize');
        CodeMirror.commands.defaultTab = function (cm) {
            if (cm.somethingSelected()) {
                cm.indentSelection("add");
            } else {
                var nspaces = tabsize - cm.getCursor().ch % tabsize;
                var spaces = Array(nspaces + 1).join(" ");
                cm.replaceSelection(spaces, "end", "+input");
            }
        };
    } else {
        CodeMirror.commands.defaultTab = this.defaultTabHandler_;
    }
};

/**
 * @param {boolean} show
 * @param {number} col
 */
EditorCodeMirror.prototype.showHideMargin = function (show, col) {
};

/**
 * Make the textarea unfocusable and hide cursor.
 */
EditorCodeMirror.prototype.disable = function () {
    this.cm_.setOption('readOnly', 'nocursor');
};

EditorCodeMirror.prototype.enable = function () {
    this.cm_.setOption('readOnly', false);
    this.cm_.focus();
};

//already here- this is what gets initalized
var Editor = EditorCodeMirror;





EditorCodeMirror.EXTENSION_TO_MODE = {
    'bash': 'shell',
    'coffee': 'coffeescript',
    'c': 'clike',
    'c++': 'clike',
    'cc': 'clike',
    'cs': 'clike',
    'css': 'css',
    'cpp': 'clike',
    'cxx': 'clike',
    'diff': 'diff',
    'gemspec': 'ruby',
    'go': 'go',
    'h': 'clike',
    'hh': 'clike',
    'hpp': 'clike',
    'htm': 'htmlmixed',
    'html': 'htmlmixed',
    'java': 'clike',
    'js': 'javascript',
    'json': 'yaml',
    'latex': 'stex',
    'less': 'less',
    'ltx': 'stex',
    'lua': 'lua',
    'markdown': 'markdown',
    'md': 'markdown',
    'ml': 'ocaml',
    'mli': 'ocaml',
    'patch': 'diff',
    'pgsql': 'sql',
    'pl': 'perl',
    'pm': 'perl',
    'php': 'php',
    'phtml': 'php',
    'py': 'python',
    'rb': 'ruby',
    'rdf': 'xml',
    'rs': 'rust',
    'rss': 'xml',
    'ru': 'ruby',
    'sh': 'shell',
    'sql': 'sql',
    'svg': 'xml',
    'tex': 'stex',
    'xhtml': 'htmlmixed',
    'xml': 'xml',
    'xq': 'xquery',
    'yaml': 'yaml'
};