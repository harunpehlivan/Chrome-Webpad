/*
 * Secure version of tern that can run with the app security policy that prevents eval and new function()
 * 
 * This communicates with the sandbox.html page using messaging to interact witht the real tern server that does the work
 * 
 * This interacts with tern-insecure.js that runs in the sandboxed environment
 */

/**
 * Call sandbox
 * @param {object} message - message to pass to sandbox
 * @param {string} type - a type that will be parsed when the sandbox calls back to secure, which will then call a function based on the type
 */
/*  TEST FUNCTIONS BELOW-- should now be replaced by proper functions at bottom of this page
function callSB(message, type) {
    var args = {};
    args.message = message;
    args.type = type;
    document.getElementById('sandboxFrame').contentWindow.postMessage(args, '*');//2nd param allows any origin
}
//DOMContentLoaded  
document.addEventListener('DOMContentLoaded', function () { 

    //bind listenger for message returned from sandbox
    window.addEventListener('message', function (event) {
        //receives a MessageEvent object

        console.log(event);

        var result = event.data.result;//this can be a json object
        var message = result.message;
        var type = result.type;//determine what function to call based on the type

    });
});
//The load event is fired when a resource and its dependent resources have finished loading.
document.addEventListener('load', function () {
    callSB('some data', 'testType');
});
*/









// Modified version of tern.js that is in the CodeMirror/addon/tern folder (by Morgan)
// - this interfacts with tern-secure.js that runs in the normal environment (which doesn't allow eval and new function())
//
//Glue code between CodeMirror and Tern.
//
// Create a CodeMirror.TernServer to wrap an actual Tern server,
// register open documents (CodeMirror.Doc instances) with it, and
// call its methods to activate the assisting functions that Tern
// provides.
//
// Options supported (all optional):
// * defs: An array of JSON definition data structures.
// * plugins: An object mapping plugin names to configuration
//   options.
// * getFile: A function(name, c) that can be used to access files in
//   the project that haven't been loaded yet. Simply do c(null) to
//   indicate that a file is not available.
// * fileFilter: A function(value, docName, doc) that will be applied
//   to documents before passing them on to Tern.
// * switchToDoc: A function(name) that should, when providing a
//   multi-file view, switch the view or focus to the named file.
// * showError: A function(editor, message) that can be used to
//   override the way errors are displayed.
// * completionTip: Customize the content in tooltips for completions.
//   Is passed a single argument—the completion's data as returned by
//   Tern—and may return a string, DOM node, or null to indicate that
//   no tip should be shown. By default the docstring is shown.
// * typeTip: Like completionTip, but for the tooltips shown for type
//   queries.
// * responseFilter: A function(doc, query, request, error, data) that
//   will be applied to the Tern responses before treating them
//
//
// It is possible to run the Tern server in a web worker by specifying
// these additional options:
// * useWorker: Set to true to enable web worker mode. You'll probably
//   want to feature detect the actual value you use here, for example
//   !!window.Worker.
// * workerScript: The main script of the worker. Point this to
//   wherever you are hosting worker.js from this directory.
// * workerDeps: An array of paths pointing (relative to workerScript)
//   to the Acorn and Tern libraries and any Tern plugins you want to
//   load. Or, if you minified those into a single script and included
//   them in the workerScript, simply leave this undefined.


// TO DO-- have to work with this and insecure version to split functionality between two files that can pass messages with each other
(function () {
    "use strict";
    // declare global: tern
    //THIS IS THE FULL FEATURED SECURE VERSION THAT INTERACTS WITH CODEMIRROR
    CodeMirror.TernServer = function (options) {
        var self = this;
        this.options = options || {};
        var plugins = this.options.plugins || (this.options.plugins = {});
        if (!plugins.doc_comment) plugins.doc_comment = true;
        if (this.options.useWorker) {
            this.server = new WorkerServer(this);
        } 
        else {
            this.server = new tern.Server({
                getFile: function (name, c) { return getFile(self, name, c); },
                async: true,
                defs: this.options.defs || [],
                plugins: plugins
            });
        }
        this.docs = Object.create(null);
        this.trackChange = function (doc, change) { trackChange(self, doc, change); };

        this.cachedArgHints = null;
        this.activeArgHints = null;
        this.jumpStack = [];
    };

    CodeMirror.TernServer.prototype = {
        addDoc: function (name, doc) {
            var data = { doc: doc, name: name, changed: null };
            this.server.addFile(name, docValue(this, data));
            CodeMirror.on(doc, "change", this.trackChange);
            return this.docs[name] = data;
        },

        delDoc: function (name) {
            var found = this.docs[name];
            if (!found) return;
            CodeMirror.off(found.doc, "change", this.trackChange);
            delete this.docs[name];
            this.server.delFile(name);
        },

        hideDoc: function (name) {
            closeArgHints(this);
            var found = this.docs[name];
            if (found && found.changed) sendDoc(this, found);
        },

        complete: function (cm) {
            var self = this;
            //console.log('complete entered');
            CodeMirror.showHint(cm, function (cm, c) { return hint(self, cm, c); }, { async: true });
        },

        getHint: function (cm, c) { return hint(this, cm, c); },

        showType: function (cm, pos) { showType(this, cm, pos); },

        updateArgHints: function (cm) { updateArgHints(this, cm); },

        jumpToDef: function (cm) { jumpToDef(this, cm); },

        jumpBack: function (cm) { jumpBack(this, cm); },

        rename: function (cm) { rename(this, cm); },

        request: function (cm, query, c, pos) {
            var self = this;
            var doc = findDoc(this, cm.getDoc());
            var request = buildRequest(this, doc, query, pos);
            //  logO(request,'request');//Gets File, LinecharPositions, Type:"completions"
            this.server.request(request, function (error, data) {
                if (!error && self.options.responseFilter)
                    data = self.options.responseFilter(doc, query, request, error, data);
                c(error, data);
            });
        },
        //Making this public for testing
        _findContext: function (doc, data) {
            return findContext(doc, data);
        }


    };

    var Pos = CodeMirror.Pos;
    var cls = "CodeMirror-Tern-";
    var bigDoc = 250;

    function getFile(ts, name, c) {
        var buf = ts.docs[name];
        if (buf)
            c(docValue(ts, buf));
        else if (ts.options.getFile)
            ts.options.getFile(name, c);
        else
            c(null);
    }

    function findDoc(ts, doc, name) {
        for (var n in ts.docs) {
            var cur = ts.docs[n];
            if (cur.doc == doc) return cur;
        }
        if (!name) for (var i = 0; ; ++i) {
            n = "[doc" + (i || "") + "]";
            if (!ts.docs[n]) { name = n; break; }
        }
        return ts.addDoc(name, doc);
    }

    function trackChange(ts, doc, change) {
        var data = findDoc(ts, doc);

        var argHints = ts.cachedArgHints;
        if (argHints && argHints.doc == doc && cmpPos(argHints.start, change.to) <= 0)
            ts.cachedArgHints = null;

        var changed = data.changed;
        if (changed == null)
            data.changed = changed = { from: change.from.line, to: change.from.line };
        var end = change.from.line + (change.text.length - 1);
        if (change.from.line < changed.to) changed.to = changed.to - (change.to.line - end);
        if (end >= changed.to) changed.to = end + 1;
        if (changed.from > change.from.line) changed.from = change.from.line;

        if (doc.lineCount() > bigDoc && change.to - changed.from > 100) setTimeout(function () {
            if (data.changed && data.changed.to - data.changed.from > 100) sendDoc(ts, data);
        }, 200);
    }

    function sendDoc(ts, doc) {
        ts.server.request({ files: [{ type: "full", name: doc.name, text: docValue(ts, doc) }] }, function (error) {
            if (error) console.error(error);
            else doc.changed = null;
        });
    }

    // Completion

    function hint(ts, cm, c) {
        //ts = TernServer. //cm =CodeMirror, c=Callback function      
        ts.request(cm, { type: "completions", types: true, docs: true, urls: true }, function (error, data) {
            //logO(data,'data');//Contains array of completeions that are filtered to the current text from CodeMirro
            if (error) return showError(ts, cm, error);
            var completions = [], after = "";
            var from = data.start, to = data.end;
            if (cm.getRange(Pos(from.line, from.ch - 2), from) == "[\"" && cm.getRange(to, Pos(to.line, to.ch + 2)) != "\"]") {
                after = "\"]";
            }
            for (var i = 0; i < data.completions.length; ++i) {
                var completion = data.completions[i], className = typeToIcon(completion.type);
                //logO(completion, 'completion');//contains a single completion object
                if (data.guess) className += " " + cls + "guess";
                completions.push({
                    text: completion.name + after,
                    displayText: completion.name,
                    className: className,
                    data: completion
                });
            }

            var obj = { from: from, to: to, list: completions };
            var tooltip = null;
            CodeMirror.on(obj, "close", function () { remove(tooltip); });
            CodeMirror.on(obj, "update", function () { remove(tooltip); });
            CodeMirror.on(obj, "select", function (cur, node) {
                remove(tooltip);
                var content = ts.options.completionTip ? ts.options.completionTip(cur.data) : cur.data.doc;
                if (content) {
                    tooltip = makeTooltip(node.parentNode.getBoundingClientRect().right + window.pageXOffset,
                                          node.getBoundingClientRect().top + window.pageYOffset, content);
                    tooltip.className += " " + cls + "hint-doc";
                }
            });
            c(obj);
        });
    }

    function typeToIcon(type) {
        var suffix;
        if (type == "?") suffix = "unknown";
        else if (type == "number" || type == "string" || type == "bool") suffix = type;
        else if (/^fn\(/.test(type)) suffix = "fn";
        else if (/^\[/.test(type)) suffix = "array";
        else suffix = "object";
        return cls + "completion " + cls + "completion-" + suffix;
    }

    // Type queries

    function showType(ts, cm, pos) {
        ts.request(cm, "type", function (error, data) {
            if (error) return showError(ts, cm, error);
            if (ts.options.typeTip) {
                var tip = ts.options.typeTip(data);
            } else {
                var tip = elt("span", null, elt("strong", null, data.type || "not found"));
                if (data.doc)
                    tip.appendChild(document.createTextNode(" — " + data.doc));
                if (data.url) {
                    tip.appendChild(document.createTextNode(" "));
                    tip.appendChild(elt("a", null, "[docs]")).href = data.url;
                }
            }
            tempTooltip(cm, tip);
        }, pos);
    }

    // Maintaining argument hints

    function updateArgHints(ts, cm) {        
        closeArgHints(ts);

        if (cm.somethingSelected()) return;
        var state = cm.getTokenAt(cm.getCursor()).state;
        var inner = CodeMirror.innerMode(cm.getMode(), state);
        if (inner.mode.name != "javascript") return;
        var lex = inner.state.lexical;
        if (lex.info != "call") return;
        
        var ch, argPos = lex.pos || 0, tabSize = cm.getOption("tabSize");
        for (var line = cm.getCursor().line, e = Math.max(0, line - 9), found = false; line >= e; --line) {
            var str = cm.getLine(line), extra = 0;
            for (var pos = 0; ;) {
                var tab = str.indexOf("\t", pos);
                if (tab == -1) break;
                extra += tabSize - (tab + extra) % tabSize - 1;
                pos = tab + 1;
            }
            ch = lex.column - extra;
            if (str.charAt(ch) == "(") { found = true; break; }
        }
        if (!found) return;

        var start = Pos(line, ch);
        var cache = ts.cachedArgHints;
        if (cache && cache.doc == cm.getDoc() && cmpPos(start, cache.start) == 0)
            return showArgHints(ts, cm, argPos);

        ts.request(cm, { type: "type", preferFunction: true, end: start }, function (error, data) {
            if (error || !data.type || !(/^fn\(/).test(data.type)) return;
            ts.cachedArgHints = {
                start: pos,
                type: parseFnType(data.type),
                name: data.exprName || data.name || "fn",
                guess: data.guess,
                doc: cm.getDoc()
            };
            showArgHints(ts, cm, argPos);
        });
    }

    function showArgHints(ts, cm, pos) {
        closeArgHints(ts);

        var cache = ts.cachedArgHints, tp = cache.type;
        var tip = elt("span", cache.guess ? cls + "fhint-guess" : null,
                      elt("span", cls + "fname", cache.name), "(");
        for (var i = 0; i < tp.args.length; ++i) {
            if (i) tip.appendChild(document.createTextNode(", "));
            var arg = tp.args[i];
            tip.appendChild(elt("span", cls + "farg" + (i == pos ? " " + cls + "farg-current" : ""), arg.name || "?"));
            if (arg.type != "?") {
                tip.appendChild(document.createTextNode(":\u00a0"));
                tip.appendChild(elt("span", cls + "type", arg.type));
            }
        }
        tip.appendChild(document.createTextNode(tp.rettype ? ") ->\u00a0" : ")"));
        if (tp.rettype) tip.appendChild(elt("span", cls + "type", tp.rettype));
        var place = cm.cursorCoords(null, "page");
        ts.activeArgHints = makeTooltip(place.right + 1, place.bottom, tip);
    }

    function parseFnType(text) {
        var args = [], pos = 3;

        function skipMatching(upto) {
            var depth = 0, start = pos;
            for (; ;) {
                var next = text.charAt(pos);
                if (upto.test(next) && !depth) return text.slice(start, pos);
                if (/[{\[\(]/.test(next))++depth;
                else if (/[}\]\)]/.test(next))--depth;
                ++pos;
            }
        }

        // Parse arguments
        if (text.charAt(pos) != ")") for (; ;) {
            var name = text.slice(pos).match(/^([^, \(\[\{]+): /);
            if (name) {
                pos += name[0].length;
                name = name[1];
            }
            args.push({ name: name, type: skipMatching(/[\),]/) });
            if (text.charAt(pos) == ")") break;
            pos += 2;
        }

        var rettype = text.slice(pos).match(/^\) -> (.*)$/);
        //logO(args, 'args'); logO(rettype, 'rettype');//nothing
        return { args: args, rettype: rettype && rettype[1] };
    }

    // Moving to the definition of something

    function jumpToDef(ts, cm) {
        function inner(varName) {
            var req = { type: "definition", variable: varName || null };
            var doc = findDoc(ts, cm.getDoc());
            //logO(varName, 'varName'); //null            

            //BUILD REQUEST -- this builds the query to send to tern (query has the node defnition that we are looking for, so buidRequest must look at codemirrot and find the object the cursor is on and then looks for it)
            //  logO(buildRequest(ts, doc, req), 'buildRequest result that is sent to tern') //NEVERMIND- this contains the line position currently, but it does NOT contain the node definition we are looking for

            //this calls  function findDef(srv, query, file) {
            ts.server.request(buildRequest(ts, doc, req), function (error, data) {
                if (error) return showError(ts, cm, error);
                if (!data.file && data.url) { window.open(data.url); return; }

                if (data.file) {
                    var localDoc = ts.docs[data.file], found;
                    // logO(localDoc.doc, 'localDoc.doc'); logO(data, 'data');
                    if (localDoc && (found = findContext(localDoc.doc, data))) {
                        ts.jumpStack.push({
                            file: doc.name,
                            start: cm.getCursor("from"),
                            end: cm.getCursor("to")
                        });
                        moveTo(ts, doc, localDoc, found.start, found.end);
                        return;
                    }
                }
                showError(ts, cm, "Could not find a definition.");
            });
        }

        if (!atInterestingExpression(cm))
            dialog(cm, "Jump to variable", function (name) { if (name) inner(name); });
        else
            inner();
    }

    function jumpBack(ts, cm) {
        var pos = ts.jumpStack.pop(), doc = pos && ts.docs[pos.file];
        if (!doc) return;
        moveTo(ts, findDoc(ts, cm.getDoc()), doc, pos.start, pos.end);
    }

    function moveTo(ts, curDoc, doc, start, end) {
        doc.doc.setSelection(end, start);
        if (curDoc != doc && ts.options.switchToDoc) {
            closeArgHints(ts);
            //logO(doc, 'moveto.doc');logO(start, 'moveto.start'); logO(end, 'moveto.end');
            //5.23.2014- added start  parameter to pass to child
            //console.log(ts.options.switchToDoc, start);
            ts.options.switchToDoc(doc.name, start);
        }
    }

    // The {line,ch} representation of positions makes this rather awkward.
    function findContext(doc, data) {
        // logO(doc, 'doc'); logO(data, 'data');
        var before = data.context.slice(0, data.contextOffset).split("\n");
        var startLine = data.start.line - (before.length - 1);
        var start = Pos(startLine, (before.length == 1 ? data.start.ch : doc.getLine(startLine).length) - before[0].length);

        var text = doc.getLine(startLine).slice(start.ch);
        for (var cur = startLine + 1; cur < doc.lineCount() && text.length < data.context.length; ++cur)
            text += "\n" + doc.getLine(cur);
        if (text.slice(0, data.context.length) == data.context) return data;

        var cursor = doc.getSearchCursor(data.context, 0, false);
        var nearest, nearestDist = Infinity;
        while (cursor.findNext()) {
            var from = cursor.from(), dist = Math.abs(from.line - start.line) * 10000;
            if (!dist) dist = Math.abs(from.ch - start.ch);
            if (dist < nearestDist) { nearest = from; nearestDist = dist; }
        }
        if (!nearest) return null;

        if (before.length == 1)
            nearest.ch += before[0].length;
        else
            nearest = Pos(nearest.line + (before.length - 1), before[before.length - 1].length);
        if (data.start.line == data.end.line)
            var end = Pos(nearest.line, nearest.ch + (data.end.ch - data.start.ch));
        else
            var end = Pos(nearest.line + (data.end.line - data.start.line), data.end.ch);
        return { start: nearest, end: end };
    }

    function atInterestingExpression(cm) {
        var pos = cm.getCursor("end"), tok = cm.getTokenAt(pos);
        if (tok.start < pos.ch && (tok.type == "comment" || tok.type == "string")) return false;
        return /\w/.test(cm.getLine(pos.line).slice(Math.max(pos.ch - 1, 0), pos.ch + 1));
    }

    // Variable renaming

    function rename(ts, cm) {
        var token = cm.getTokenAt(cm.getCursor());
        if (!/\w/.test(token.string)) showError(ts, cm, "Not at a variable");
        dialog(cm, "New name for " + token.string, function (newName) {
            ts.request(cm, { type: "rename", newName: newName, fullDocs: true }, function (error, data) {
                if (error) return showError(ts, cm, error);
                applyChanges(ts, data.changes);
            });
        });
    }

    var nextChangeOrig = 0;
    function applyChanges(ts, changes) {
        var perFile = Object.create(null);
        for (var i = 0; i < changes.length; ++i) {
            var ch = changes[i];
            (perFile[ch.file] || (perFile[ch.file] = [])).push(ch);
        }
        for (var file in perFile) {
            var known = ts.docs[file], chs = perFile[file];;
            if (!known) continue;
            chs.sort(function (a, b) { return cmpPos(b.start, a.start); });
            var origin = "*rename" + (++nextChangeOrig);
            for (var i = 0; i < chs.length; ++i) {
                var ch = chs[i];
                known.doc.replaceRange(ch.text, ch.start, ch.end, origin);
            }
        }
    }

    // Generic request-building helper

    function buildRequest(ts, doc, query, pos) {
        var files = [], offsetLines = 0, allowFragments = !query.fullDocs;
        if (!allowFragments) delete query.fullDocs;
        if (typeof query == "string") query = { type: query };
        query.lineCharPositions = true;
        if (query.end == null) {
            query.end = pos || doc.doc.getCursor("end");
            if (doc.doc.somethingSelected())
                query.start = doc.doc.getCursor("start");
        }
        var startPos = query.start || query.end;
        //logO(startPos,'startPos'); logO(query,'query');//contains end pos    

        if (doc.changed) {//This pushes the current document to the tern server for getting autocomplete if it has changed (by user typing)
            if (doc.doc.lineCount() > bigDoc && allowFragments !== false && doc.changed.to - doc.changed.from < 100 && doc.changed.from <= startPos.line && doc.changed.to > query.end.line) {
                files.push(getFragmentAround(doc, startPos, query.end));
                query.file = "#0";
                var offsetLines = files[0].offsetLines;
                if (query.start != null) query.start = Pos(query.start.line - -offsetLines, query.start.ch);
                query.end = Pos(query.end.line - offsetLines, query.end.ch);
            }
            else {
                files.push({
                    type: "full",
                    name: doc.name,
                    text: docValue(ts, doc)
                });
                query.file = doc.name;
                doc.changed = null;
            }
        }
        else {
            query.file = doc.name;
        }
        //Loop all documents in the tern server that are used for autocomplete
        for (var name in ts.docs) {
            var cur = ts.docs[name];
            if (cur.changed && cur != doc) {
                files.push({ type: "full", name: cur.name, text: docValue(ts, cur) });
                cur.changed = null;
            }
        }
        return { query: query, files: files };
    }

    function getFragmentAround(data, start, end) {
        var doc = data.doc;
        var minIndent = null, minLine = null, endLine, tabSize = 4;
        for (var p = start.line - 1, min = Math.max(0, p - 50) ; p >= min; --p) {
            var line = doc.getLine(p), fn = line.search(/\bfunction\b/);
            if (fn < 0) continue;
            var indent = CodeMirror.countColumn(line, null, tabSize);
            if (minIndent != null && minIndent <= indent) continue;
            minIndent = indent;
            minLine = p;
        }
        if (minLine == null) minLine = min;
        var max = Math.min(doc.lastLine(), end.line + 20);
        if (minIndent == null || minIndent == CodeMirror.countColumn(doc.getLine(start.line), null, tabSize))
            endLine = max;
        else for (endLine = end.line + 1; endLine < max; ++endLine) {
            var indent = CodeMirror.countColumn(doc.getLine(endLine), null, tabSize);
            if (indent <= minIndent) break;
        }
        var from = Pos(minLine, 0);

        return {
            type: "part",
            name: data.name,
            offsetLines: from.line,
            text: doc.getRange(from, Pos(endLine, 0))
        };
    }

    // Generic utilities

    function cmpPos(a, b) { return a.line - b.line || a.ch - b.ch; }

    function elt(tagname, cls /*, ... elts*/) {
        var e = document.createElement(tagname);
        if (cls) e.className = cls;
        //console.log('elt', e, cls);
        for (var i = 2; i < arguments.length; ++i) {
            var elt = arguments[i];
            if (typeof elt == "string") elt = document.createTextNode(elt);
            e.appendChild(elt);
        }
        return e;
    }

    function dialog(cm, text, f) {
        if (cm.openDialog)
            cm.openDialog(text + ": <input type=text>", f);
        else
            f(prompt(text, ""));
    }

    // Tooltips

    function tempTooltip(cm, content) {
        var where = cm.cursorCoords();
        var tip = makeTooltip(where.right + 1, where.bottom, content);
        function clear() {
            if (!tip.parentNode) return;
            cm.off("cursorActivity", clear);
            fadeOut(tip);
        }
        setTimeout(clear, 1700);
        cm.on("cursorActivity", clear);
    }

    function makeTooltip(x, y, content) {
        var node = elt("div", cls + "tooltip", content);
        node.style.left = x + "px";
        node.style.top = y + "px";
        document.body.appendChild(node);
        return node;
    }

    function remove(node) {
        var p = node && node.parentNode;
        if (p) p.removeChild(node);
    }

    function fadeOut(tooltip) {
        tooltip.style.opacity = "0";
        setTimeout(function () { remove(tooltip); }, 1100);
    }

    function showError(ts, cm, msg) {
        if (ts.options.showError)
            ts.options.showError(cm, msg);
        else
            tempTooltip(cm, String(msg));
    }

    function closeArgHints(ts) {
        if (ts.activeArgHints) { remove(ts.activeArgHints); ts.activeArgHints = null; }
    }

    function docValue(ts, doc) {
        var val = doc.doc.getValue();
        if (ts.options.fileFilter) val = ts.options.fileFilter(val, doc.name, doc.doc);
        return val;
    }



    // Worker wrapper
    // modified to send messages to sandbox using fake web worker class
    function WorkerServer(ts) {        
        //fake web worker that communicates with sandbox instead of web worker
        function fakeWorker() {
            var self = this;
            //post message (just like web worker)
            this.postMessage = function (message) {
                document.getElementById('sandboxFrame').contentWindow.postMessage(message, '*');//2nd param allows any origin
            }
            //message received
            this.onmessage = null;
            //error .. not sure how this should be implemented
            this.error = null;
            //bind message returned and call onmessage event
            //document.addEventListener('DOMContentLoaded', function () {
                //console.log('adding message received event listenter to secure');
                //bind listenger for message returned from sandbox
                window.addEventListener('message', function (event) {                  
                    //console.log('secure received message from tern', event, 'self.onmessage=', self.onmessage);
                    if (typeof (self.onmessage === 'function')) {      
                        //console.log('secure received message from tern', event);
                        self.onmessage(event);
                    }

                });
            //});
        }
        
        var worker = new fakeWorker();//var worker = new Worker(ts.options.workerScript); //- use fake worker

      /*
    // dont need to start the server as it starts automatically in the sandbox      
    //NOTE: could come back and make this start server to make it more efficient, didnt do this in first place because this gets loaded before the fake worker is done loading (in the sandbox iframe) -- should use load even of sandbox to start..
        worker.postMessage({
            type: "init",
            defs: ts.options.defs,
            plugins: ts.options.plugins,
            scripts: ts.options.workerDeps
        });*/
        var msgId = 0, pending = {};
        //send data to worker
        function send(data, c) {
            if (c) {
                data.id = ++msgId;
                pending[msgId] = c;
            }
            worker.postMessage(data);
        }
        //The Worker.onmessage property represents an EventHandler, that is a function to be called when the message event occurs. These events are of type MessageEvent and will be called when the worker calls its own postMessage() method: it is the way that a Worker has to give back information to the thread that created it.
        worker.onmessage = function (e) {
            var data = e.data;
            if (data.type == "getFile") {
                getFile(ts, data.name, function (err, text) {
                    send({ type: "getFile", err: String(err), text: text, id: data.id });
                });
            }
            else if (data.type == "debug") {
                console.log(data.message);
            }
            else if (data.id && pending[data.id]) {
               // console.log('pending', pending);
                pending[data.id](data.err, data.body);
                delete pending[data.id];
            }
        };
        worker.onerror = function (e) {
            for (var id in pending) pending[id](e);
            pending = {};
        };

        this.addFile = function (name, text) { send({ type: "add", name: name, text: text }); };
        this.delFile = function (name) { send({ type: "del", name: name }); };
        this.request = function (body, c) { send({ type: "req", body: body }, c); };
    }
})();
