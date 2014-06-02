(function () {
    "use strict";
    //CUSTOM - by me
    CodeMirror.defineExtension("foldAll", function () {
        // var SW = new Date();
        this.operation(function () {
            for (var i = 0; i < editor.lineCount() ; i++) {
            	editor.foldCode({ line: i, ch: 0 }, { minFoldSize: 1 }, "fold");
            }
        });
        // LogSW(SW, 'FoldAll', true);
    });
    //CUSTOM - by me
    CodeMirror.defineExtension("unfoldAll", function () {
        // var SW = new Date();
        this.operation(function () {
            for (var i = 0; i < editor.lineCount() ; i++) {
            	editor.foldCode({ line: i, ch: 0 }, null, "unfold");
            }
        });
        // LogSW(SW, 'unfoldAll', true);
    });
    CodeMirror.defineExtension("foldSelection", function () {        
        this.operation(function () {
            var start = editor.getCursor(true).line;
            var end = editor.getCursor(false).line;
            for (var i = start; i <= end ; i++) {
            	editor.foldCode({ line: i, ch: 0 }, {minFoldSize:1}, "fold");
            }
        });        
    });
    CodeMirror.defineExtension("unfoldSelection", function () {
        this.operation(function () {
            var start = editor.getCursor(true).line;
            var end = editor.getCursor(false).line;
            for (var i = start; i <= end ; i++) {
            	editor.foldCode({ line: i, ch: 0 }, null, "unfold");
            }
        });
    });
    //Unfolds all code if nothing is selected, or unfolds selectio
    CodeMirror.defineExtension("unfoldSelectionOrAll", function () {
        if (this.getSelection() == '') {//nothing selected
            this.unfoldAll();
        }
        else {
            this.unfoldSelection();
        }
    });
    //folds all code if nothing is selected, or unfolds selectio
    CodeMirror.defineExtension("foldSelectionOrAll", function () {
        if (this.getSelection() == '') {//nothing selected
            this.foldAll();
        }
        else {
            this.foldSelection();
        }
    });

    /*
    //not published yet:https://github.com/marijnh/CodeMirror/commit/55223f6003d372d84e631e3b257d1392187e58ef
    CodeMirror.defineExtension("isFolded", function (pos) {
        var marks = this.findMarksAt(pos);
        for (var i = 0; i < marks.length; ++i)
            if (marks[i].__isFold) return true;
    });*/



    function doFold(cm, pos, options, force) {
        var finder = options && (options.call ? options : options.rangeFinder);
        if (!finder) finder = CodeMirror.fold.auto;
        if (typeof pos == "number") pos = CodeMirror.Pos(pos, 0);
        var minSize = options && options.minFoldSize || 0;

        function getRange(allowFolded) {
            var range = finder(cm, pos);
            if (!range || range.to.line - range.from.line < minSize) return null;
            var marks = cm.findMarksAt(range.from);
            for (var i = 0; i < marks.length; ++i) {
                if (marks[i].__isFold && force !== "fold") {
                    if (!allowFolded) return null;
                    range.cleared = true;
                    marks[i].clear();
                }
            }
            return range;
        }

        var range = getRange(true);
        if (options && options.scanUp) while (!range && pos.line > cm.firstLine()) {
            pos = CodeMirror.Pos(pos.line - 1, 0);
            range = getRange(false);
        }
        if (!range || range.cleared || force === "unfold") return;

        var myWidget = makeWidget(options);
        CodeMirror.on(myWidget, "mousedown", function () { myRange.clear(); });
        var myRange = cm.markText(range.from, range.to, {
            replacedWith: myWidget,
            clearOnEnter: true,
            __isFold: true
        });
        myRange.on("clear", function (from, to) {
            CodeMirror.signal(cm, "unfold", cm, from, to);
        });
        CodeMirror.signal(cm, "fold", cm, range.from, range.to);
    }

    function makeWidget(options) {
        var widget = (options && options.widget) || "\u2194";
        if (typeof widget == "string") {
            var text = document.createTextNode(widget);
            widget = document.createElement("span");
            widget.appendChild(text);
            widget.className = "CodeMirror-foldmarker";
        }
        return widget;
    }

    // Clumsy backwards-compatible interface
    CodeMirror.newFoldFunction = function (rangeFinder, widget) {
        return function (cm, pos) { doFold(cm, pos, { rangeFinder: rangeFinder, widget: widget }); };
    };

    // New-style interface
    CodeMirror.defineExtension("foldCode", function (pos, options, force) {
        doFold(this, pos, options, force);
    });
   
    

    CodeMirror.commands.fold = function (cm) {
        cm.foldCode(cm.getCursor());
    };

    CodeMirror.registerHelper("fold", "combine", function () {
        var funcs = Array.prototype.slice.call(arguments, 0);
        return function (cm, start) {
            for (var i = 0; i < funcs.length; ++i) {
                var found = funcs[i](cm, start);
                if (found) return found;
            }
        };
    });

    CodeMirror.registerHelper("fold", "auto", function (cm, start) {
        var helpers = cm.getHelpers(start, "fold");
        for (var i = 0; i < helpers.length; i++) {
            var cur = helpers[i](cm, start);
            if (cur) return cur;
        }
    });
})();
