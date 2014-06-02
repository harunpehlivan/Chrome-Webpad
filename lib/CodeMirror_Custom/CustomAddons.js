/*got this source from http://codemirror.net/2/demo/formatting.html (it was not in the source).

    Also, using this file to add generic extensions
*/


//Global var to hold custom snips for my plugin (sort of ghetto, but it works)
var CodeMirrorCustomCompletions = [];

(function () {

	//Get javscript text and keeps line numbers. Returns all script when mode is javscript, and only that in script tags for htmlmixed, and empty string for other modes
    CodeMirror.defineExtension("getScriptValue", function (bool_debug) {        
        var curMode = this.getMode().name;      
        if (curMode === 'javascript') {
            return this.getValue();
        }
        else if (curMode === 'htmlmixed') {
            return GetJsFromMixedHtml(this.getValue(), bool_debug);
        }
        return '';		
	});
	//Get value inside script tags in mixed html (keeps linen numbers)
	CodeMirror.defineExtension("getStyleValue", function (bool_debug) {
		return GetCssFromMixedHtml(this.getValue(), bool_debug);
	});
	//custom method to extract javscript from html and keep line numbers
	function GetJsFromMixedHtml(s,bool_debug) {
		var r = ''; var d = ''; var inScript = false;
		var lines = s.split('\n');
		for (var i = 0; i < lines.length; i++) {
			var l = lines[i];
			d += '\n inScript=' + inScript + '; ' + i + '. ' + l;
			if (inScript) {
				if (l.match(/\s*\/script/)) {
					inScript = false;
					r += "\n";
					continue;
				}
				r += "\n" + l;
			}
			else {
				if (l.match(/\s*<script/)) {
					if(!l.match(/src="/)){//dont add <scirpt src lines
						inScript = true;
					}
				}
				r += "\n";
			}
			if (i === 0) {
				r = r.replace("\n", "");//dont add break for first line
			}
		}
		if (bool_debug) { log(d); }
		return r;
	}
	//custom method to extract css from html and keep line numbers
	function GetCssFromMixedHtml(s, bool_debug) {
		var r = ''; var d = ''; var inStyle = false;
		var lines = s.split('\n');
		for (var i = 0; i < lines.length; i++) {
			var l = lines[i];
			d += '\n inStyle=' + inStyle + '; ' + i + '. ' + l;
			if (inStyle) {
				if (l.match(/\s*\/style/)) {
					inStyle = false;
					r += "\n";
					continue;
				}
				r += "\n" + l;
			}
			else {
				if (l.match(/\s*<style/)) {
					inStyle = true;
				}
				r += "\n";
			}
			if (i === 0) {
				r = r.replace("\n", "");//dont add break for first line
			}
		}
		if (bool_debug) { log(d); }
		return r;
	}

    //
    CodeMirror.defineExtension("addCompletion", function (name, comments) {
        CodeMirrorCustomCompletions.push({ doc: comments, name: name });
    });

    //find line- all created by me (only works if editor global var is set)
    CodeMirror.defineExtension("goToLine", function () {
        var line = prompt('Enter line number');
        this.setCursor(parseInt(line), 0);
    });
    
    //Added by from form- doesn't work well - https://gist.github.com/marijnh/3632766
    CodeMirror.defineExtension("centerOnCursor", function () {
        //editor.cursorCoords({line:200,ch:0})
        //editor.scrollIntoView({line:200,ch:0})
        var coords = this.cursorCoords(null, "local");
        this.scrollTo(null, (coords.y + coords.yBot) / 2 - (this.getScrollerElement().clientHeight / 2));
        editor.scrollTo(null, (coords.y + coords.yBot) / 2 - (editor.getScrollerElement().clientHeight / 2));
    });

    CodeMirror.extendMode("css", {
        commentStart: "/*",
        commentEnd: "*/",
        newlineAfterToken: function (type, content) {
            return /^[;{}]$/.test(content);
        }
    });

    CodeMirror.extendMode("javascript", {
        commentStart: "/*",
        commentEnd: "*/",
        // FIXME semicolons inside of for
        newlineAfterToken: function (type, content, textAfter, state) {
            if (this.jsonMode) {
                return /^[\[,{]$/.test(content) || /^}/.test(textAfter);
            } else {
                if (content == ";" && state.lexical && state.lexical.type == ")") return false;
                return /^[;{}]$/.test(content) && !/^;/.test(textAfter);
            }
        }
    });

    CodeMirror.extendMode("xml", {
        commentStart: "<!--",
        commentEnd: "-->",
        newlineAfterToken: function (type, content, textAfter) {
            return type == "tag" && />$/.test(content) || /^</.test(textAfter);
        }
    });

    // Comment/uncomment the specified range
    CodeMirror.defineExtension("commentRange", function (isComment, from, to) {
        var cm = this, curMode = CodeMirror.innerMode(cm.getMode(), cm.getTokenAt(from).state).mode;
        cm.operation(function () {
            if (isComment) { // Comment range
                cm.replaceRange(curMode.commentEnd, to);
                cm.replaceRange(curMode.commentStart, from);
                if (from.line == to.line && from.ch == to.ch) // An empty comment inserted - put cursor inside
                    cm.setCursor(from.line, from.ch + curMode.commentStart.length);
            } else { // Uncomment range
                var selText = cm.getRange(from, to);
                var startIndex = selText.indexOf(curMode.commentStart);
                var endIndex = selText.lastIndexOf(curMode.commentEnd);
                if (startIndex > -1 && endIndex > -1 && endIndex > startIndex) {
                    // Take string till comment start
                    selText = selText.substr(0, startIndex)
                    // From comment start till comment end
                      + selText.substring(startIndex + curMode.commentStart.length, endIndex)
                    // From comment end till string end
                      + selText.substr(endIndex + curMode.commentEnd.length);
                }
                cm.replaceRange(selText, from, to);
            }
        });
    });

    // Applies automatic mode-aware indentation to the specified range
    CodeMirror.defineExtension("autoIndentRange", function (from, to) {
        var cmInstance = this;
        this.operation(function () {
            for (var i = from.line; i <= to.line; i++) {
                cmInstance.indentLine(i, "smart");
            }
        });
    });

    // Applies automatic formatting to the specified range
    CodeMirror.defineExtension("autoFormatRange", function (from, to) {
        var cm = this;
        var outer = cm.getMode(), text = cm.getRange(from, to).split("\n");
        var state = CodeMirror.copyState(outer, cm.getTokenAt(from).state);
        var tabSize = cm.getOption("tabSize");

        var out = "", lines = 0, atSol = from.ch == 0;
        function newline() {
            out += "\n";
            atSol = true;
            ++lines;
        }

        for (var i = 0; i < text.length; ++i) {
            var stream = new CodeMirror.StringStream(text[i], tabSize);
            while (!stream.eol()) {
                var inner = CodeMirror.innerMode(outer, state);
                var style = outer.token(stream, state), cur = stream.current();
                stream.start = stream.pos;
                if (!atSol || /\S/.test(cur)) {
                    out += cur;
                    atSol = false;
                }
                if (!atSol && inner.mode.newlineAfterToken &&
                    inner.mode.newlineAfterToken(style, cur, stream.string.slice(stream.pos) || text[i + 1] || "", inner.state))
                    newline();
            }
            if (!stream.pos && outer.blankLine) outer.blankLine(state);
            if (!atSol) newline();
        }

        cm.operation(function () {
            cm.replaceRange(out, from, to);
            for (var cur = from.line + 1, end = from.line + lines; cur <= end; ++cur)
                cm.indentLine(cur, "smart");
            cm.setSelection(from, cm.getCursor(false));
        });
    });
})();

//Scroll Past End : http://codemirror.net/addon/scroll/scrollpastend.js
(function () {
    "use strict";

    CodeMirror.defineOption("scrollPastEnd", false, function (cm, val, old) {
        if (old && old != CodeMirror.Init) {
            cm.off("change", onChange);
            cm.off("refresh", updateBottomMargin);
            cm.display.lineSpace.parentNode.style.paddingBottom = "";
            cm.state.scrollPastEndPadding = null;
        }
        if (val) {
            cm.on("change", onChange);
            cm.on("refresh", updateBottomMargin);
            updateBottomMargin(cm);
        }
    });

    function onChange(cm, change) {
        if (CodeMirror.changeEnd(change).line == cm.lastLine())
            updateBottomMargin(cm);
    }

    function updateBottomMargin(cm) {
        var padding = "";
        if (cm.lineCount() > 1) {
            var totalH = cm.display.scroller.clientHeight - 30,
                lastLineH = cm.getLineHandle(cm.lastLine()).height;
            padding = (totalH - lastLineH) + "px";
        }
        if (cm.state.scrollPastEndPadding != padding) {
            cm.state.scrollPastEndPadding = padding;
            cm.display.lineSpace.parentNode.style.paddingBottom = padding;
            cm.setSize();
        }
    }
})();


//FUNCTIONS BELOW COPIED FROM STANDARD SCRIPTS 
/**
Checks if string contains another string while ignoring certain characters (returns bool)
@param {(string)} [str_Contains=] - string to check if contains.
@param {(string[])} [arr_CharsToIgnore=('_',' ','-')] - array of chars to ignore in contains check.
@param {(bool)} [bool_CaseSensitive=false] - pass true to make check case sensitive.
*/
String.prototype.ContainsIgnoreChars = function (str_Contains, arr_CharsToIgnore, bool_CaseSensitive) {
    var search = this.toString();
    if (bool_CaseSensitive !== true) {
        search = search.toLowerCase();
        str_Contains = str_Contains.toString().toLowerCase();
    }
    if (!arr_CharsToIgnore) {
        arr_CharsToIgnore = new Array('_', ' ', '-');
    }
    if (arr_CharsToIgnore && arr_CharsToIgnore.length > 1) {
        for (var i = 0; i < arr_CharsToIgnore.length; i++) {
            search = search.replace(new RegExp(arr_CharsToIgnore[i], 'g'), '');
            str_Contains = str_Contains.replace(new RegExp(arr_CharsToIgnore[i], 'g'), '');
        }
    }    
    if (search.indexOf(str_Contains) !== -1) {
       // log('search=' + search + '; str_Contains=' + str_Contains);
        return true;
    }
    return false;
}
//Checks if string contains another using intellisense like algorithim:
//    Searches distinct chars, with no regard to char placement, case, or non-alphanumeric chars
//@param {string} [str_Contains] - string to check if contains
//@param {int} [int_missingThreshold=0] - number of acceptable missing chars before returning false
String.prototype.smartContains = function (str_Contains, int_missingThreshold, bool_Debug) {
	var SW; if (bool_Debug) { SW = new Date(); }
	if (ToInt(int_missingThreshold) === -1) { int_missingThreshold = 0; }
	var totalMissing = 0;
	//Remove non-alphanumeric from strings -http://stackoverflow.com/questions/9364400/remove-not-alphanumeric-characters-from-string-having-trouble-with-the-char
	var search = this.toLowerCase().replace(/[^a-z0-9]/gi, '');
	str_Contains = str_Contains.toString().toLowerCase().replace(/[^a-z0-9]/gi, '');
	str_Contains = getDistinctChars(str_Contains);//get distinct chars
	var r = true;
	for (var i = 0; i < str_Contains.length; i++) {
		var c = str_Contains.substr(i, 1);
		if (search.indexOf(c) === -1) {
			totalMissing++;
			if (totalMissing > int_missingThreshold) { r = false; break; }
		}
	}
	if (bool_Debug) { LogSW(SW, 'smartContains total time'); }
	return r;
	//gets distinct chars in the string
	function getDistinctChars(s) {
		s = s.toLowerCase();
		var ar = [];
		if (s.length < 1) { return s; }
		for (var i = 0; i < s.length; i++) {
			var c = s.substr(i, 1);
			if (ar.indexOf(c) === -1) {
				ar.push(c);
			}
		}
		return ar.join("");
	}
};
var FilteredList = function (array, filterText, mutateData) {
	this.all = array;
	this.filtered = array;
	this.filterText = filterText || "";

	//@param [str] - the string to filter by (what user is currently typing that needs to be copmleted)
	this.setFilter = function (str) {
		//logO(str, 'str');
		//logO(this.filterText, 'this.filterText ');//empty at first, but as user keeps typing with auto complete open, this contains the previous filter text. Exmaple: I type 'F' and start auto complete, this is empty, i then type 'U' (total text is 'FU'), this now contains 'F'- the previous filter text
		if (str.length > this.filterText && str.lastIndexOf(this.filterText, 0) === 0) {
			//this.filtered contains already filtered list based on what user has already entered, this is only when auto complete is open and the user keeps typing to further filter the list. This prevents re-filtering the entire list every time the user presses a new key while auto complete is open
			var matches = this.filtered;
		}
		else {
			//user just started auto complete, or hit backspace so previously filtered list is not valid
			var matches = this.all;
		}
		this.filterText = str;//the text to filter the list by

		//filter completions
		matches = this.filterCompletions(matches, this.filterText);

		//sort matches based on exact match or score
		matches = matches.sort(function (a, b) {
			return b.exactMatch - a.exactMatch || b.score - a.score;
		});
		var prev = null;
		matches = matches.filter(function (item) {
			var caption = item.name || item.value || item.caption || item.snippet;
			if (caption === prev) return false;
			prev = caption;
			return true;
		});
		//logO(matches, 'matches');
		this.filtered = matches;//matches= FILTERED completions!
	};
	//filters copmletions
	//@param items - array of objects to filter. each item must have a text property to filter on that is either value|caption|snippet
	//@param needle  - the 'filterText'
	this.filterCompletions = function (items, needle) {
		//logO(items, 'items'); logO(needle, 'needle');
		var results = [];
		var upper = needle.toUpperCase();
		var lower = needle.toLowerCase();
		loop: for (var i = 0, item; item = items[i]; i++) {
			var caption = item.name || item.value || item.caption || item.snippet;//added item.name for CM
			// log('caption=' + caption);
			if (!caption) continue;
			var lastIndex = -1;
			var matchMask = 0;
			var penalty = 0;
			var index, distance;
			for (var j = 0; j < needle.length; j++) {
				var i1 = caption.indexOf(lower[j], lastIndex + 1);
				var i2 = caption.indexOf(upper[j], lastIndex + 1);
				index = (i1 >= 0) ? ((i2 < 0 || i1 < i2) ? i1 : i2) : i2;
				if (index < 0) { continue loop; }
				distance = index - lastIndex - 1;
				if (distance > 0) {
					if (lastIndex === -1)
						penalty += 10;
					penalty += distance;
				}
				matchMask = matchMask | (1 << index);
				lastIndex = index;
			}
			item.matchMask = matchMask;
			item.exactMatch = penalty ? 0 : 1;
			item.score = (item.score || 0) - penalty;
			results.push(item);
		}
		return results;
	};
};