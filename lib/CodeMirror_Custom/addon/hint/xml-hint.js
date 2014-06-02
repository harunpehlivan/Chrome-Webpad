(function () {
    "use strict";

    var Pos = CodeMirror.Pos;

    function getHints(cm, options) {
        var tags = options && options.schemaInfo;
        var quote = (options && options.quoteChar) || '"';        
        if (!tags) return;//  logO(tags, 'tags');//gets tags from schema (html in this case)
        var cur = cm.getCursor(), token = cm.getTokenAt(cur);
        var inner = CodeMirror.innerMode(cm.getMode(), token.state);        
        if (inner.mode.name != "xml") return;//logO(inner.mode.name,'inner.mode.name'); //(still xml when in attribute quotes)
        var result = [], replaceToken = false, prefix;
        var isTag = token.string.charAt(0) == "<";
      
        //Gather custom completions from my plugin        //MY CUSTOM CODE          
        var word = token.string;//logO(word, 'word');        
        if (CodeMirrorCustomCompletions && CodeMirrorCustomCompletions.length > 0) {
            for (var n = 0; n < CodeMirrorCustomCompletions.length; n++) {
                var name = CodeMirrorCustomCompletions[n].name;
                if (name.toLowerCase().indexOf(word) !== -1) {
                    result.push(name);
                    replaceToken = true;   //IMPORTANT- I added this for custom completions to work, its possible that it may screw something up!
                }
            }
        }//end of my code
        //logO(result, 'result');

        if (!inner.state.tagName || isTag) { // Tag completion
            if (isTag) {
                prefix = token.string.slice(1);
                replaceToken = true;
            }
            var cx = inner.state.context, curTag = cx && tags[cx.tagName];
            var childList = cx ? curTag && curTag.children : tags["!top"];
            if (childList) {
                for (var i = 0; i < childList.length; ++i) if (!prefix || childList[i].lastIndexOf(prefix, 0) == 0)
                    result.push("<" + childList[i]);
            } else {
                for (var name in tags) if (tags.hasOwnProperty(name) && name != "!top" && (!prefix || name.lastIndexOf(prefix, 0) == 0))
                    result.push("<" + name);
            }
            if (cx && (!prefix || ("/" + cx.tagName).lastIndexOf(prefix, 0) == 0))
                result.push("</" + cx.tagName + ">");
        }
        else {  // Attribute completion          
            var curTag = tags[inner.state.tagName], attrs = curTag && curTag.attrs;
            if (!attrs) return;
            if (token.type == "string" || token.string == "=") { // A value
                var before = cm.getRange(Pos(cur.line, Math.max(0, cur.ch - 60)),
                                         Pos(cur.line, token.type == "string" ? token.start : token.end));
                var atName = before.match(/([^\s\u00a0=<>\"\']+)=$/), atValues;
                if (!atName || !attrs.hasOwnProperty(atName[1]) || !(atValues = attrs[atName[1]])) return;
                if (typeof atValues == 'function') atValues = atValues.call(this, cm); // Functions can be used to supply values for autocomplete widget
                if (token.type == "string") {
                    prefix = token.string;
                    if (/['"]/.test(token.string.charAt(0))) {
                        quote = token.string.charAt(0);
                        prefix = token.string.slice(1);
                    }
                    replaceToken = true;
                }
                for (var i = 0; i < atValues.length; ++i) if (!prefix || atValues[i].lastIndexOf(prefix, 0) == 0)
                    result.push(quote + atValues[i] + quote);
            }
            else { // An attribute name
            	if (token.type == "attribute") {
            		//logO(token, 'token xml-hint attribute');
                    prefix = token.string;
                    replaceToken = true;
                }
                for (var attr in attrs) if (attrs.hasOwnProperty(attr) && (!prefix || attr.lastIndexOf(prefix, 0) == 0))
                    result.push(attr);
            }
        }
        return {
            list: result,
            from: replaceToken ? Pos(cur.line, token.start) : cur,
            to: replaceToken ? Pos(cur.line, token.end) : cur
        };
    }

    CodeMirror.xmlHint = getHints; // deprecated
    CodeMirror.registerHelper("hint", "xml", getHints);
})();
