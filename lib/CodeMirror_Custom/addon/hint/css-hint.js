(function () {
    "use strict";

    var pseudoClasses = {
        link: 1, visited: 1, active: 1, hover: 1, focus: 1,
        "first-letter": 1, "first-line": 1, "first-child": 1,
        before: 1, after: 1, lang: 1
    };

    CodeMirror.registerHelper("hint", "css", function (cm) {
        var cur = cm.getCursor(), token = cm.getTokenAt(cur);
        var inner = CodeMirror.innerMode(cm.getMode(), token.state);

        // console.log('token=');        console.log(token);
        // console.log('inner=');        console.log(inner);
        //inner mode is XML for my inline style hack-- better hack would be to fix xml mode to recognize inline style, but that seems more difficult as it requires regex
        //if (inner.mode.name != "css") return;
        if (inner.mode.name != "css" && inner.mode.name !== "xml") return;//my hack

        var word = token.string, start = token.start, end = token.end;
        if (/[^\w$_-]/.test(word)) {
            word = ""; start = end = cur.ch;
        }

        /* LEFT OFF HERE: this works up unti the point where it has to replace the typed text with the autofill, because it doesnt know exactly what to replace since I'm hacking it up below.
        //Hack the word for XMl mode because it contains the entire contents of the style tag, just want to get last part
        if (inner.mode.name == "xml") {
            console.log('string=' + token.string);
            var w=token.string.replace(/"/g, '').replace(/'/g, '').trim();//remove all single/double quotes(at end of style tag)
            word = w.substring(w.lastIndexOf(';') + 1);//start after last semi-colon
            console.log('word after ;=' + word);
            if (word == ' ') {
                word =w.substring(w.lastIndexOf(' ') + 1);//start after last space
                console.log('word space applied=' + word);
            }
            word = word.trim();
            console.log('word='+word);
        }
 */


        // console.log(word);
        var spec = CodeMirror.resolveMode("text/css");

        var result = [];
        function add(keywords) {//Adds words from css mode definition for copmletion
            for (var name in keywords)
                if (!word || name.lastIndexOf(word, 0) == 0) {
                    result.push(name);
                    //console.log('pushing name: ' + name);
                }
                else {
                    //  console.log('NOT pushing name: ' + name+ '; word='+word);
                }
        }
        //Gather custom completions from my plugin        //MY CUSTOM CODE
        function addCustomCompletions() {                                 
            if (CodeMirrorCustomCompletions && CodeMirrorCustomCompletions.length > 0) {
                for (var n = 0; n < CodeMirrorCustomCompletions.length; n++) {
                    var name = CodeMirrorCustomCompletions[n].name.toLowerCase();
                    if(!word || name.indexOf(word) !== -1) {
                        result.push(name);
                    }
                }
            }
        }//end of my code

        var st = token.state.state;
        //lines below is MYCODE
        try {
            //for HTML Mixed inside of <style>, need to use local state
            if (!st) { st = token.state.localState.state; }
        }
        catch (ex) {
            //ghetto hack for inline style, default it to maybeprop
            st = "getto_inline_style_hack";
        }

        if (st == "pseudo" || token.type == "variable-3") {
            add(pseudoClasses);
        }
        else if (st == "block" || st == "maybeprop") {
            add(spec.propertyKeywords);
        }
        else if (st == "prop" || st == "parens" || st == "at" || st == "params") {
            add(spec.valueKeywords);
            add(spec.colorKeywords);
        }
        else if (st == "media" || st == "media_parens") {
            add(spec.mediaTypes);
            add(spec.mediaFeatures);
        }
        else if (st == "getto_inline_style_hack") {
            add(spec.propertyKeywords);
            add(spec.valueKeywords);
            add(spec.colorKeywords);
            console.log('ghetto inline style hack. word=' + word);
        }
        addCustomCompletions();//MY CODE

        if (result.length) return {
            list: result,
            from: CodeMirror.Pos(cur.line, start),
            to: CodeMirror.Pos(cur.line, end)
        };
    });
})();