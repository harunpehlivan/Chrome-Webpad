// declare global: tern, server
/*
 * modified by morgan- this is not acutally used as a web worker
 * Instead its used to post messages back to the normal environment (this is laoded in the sandbox)
 * 
 */



//set when message is received, used to post message back to secure
var secureEventSource = null;
//set when message is received, used to post message back to secure
var secureEventOrigin = null;
//add event listener to imitate web worker receiving message
window.addEventListener('message', function (e) {
    //console.log(e,'event receieved in sandbox');
    secureEventSource = e.source;
    secureEventOrigin = e.origin;
    onmessage(e);//call fake worker on message event    
    //event.source.postMessage({ 'result': result }, event.origin);
});
//call this instead of postMessage- this calls secure app (repalces webworkers postmessage code)
function postMessageToSecure(e) {
    //console.log('posting message to secure from fake worker', e);
    secureEventSource.postMessage(e, secureEventOrigin);
}



//message received
function onmessage(e) {
    //console.log(e, 'event receieved in fake sandbox worker');
    var data = e.data;
    //console.log('message received in fake worker', data);
    switch (data.type) {
        case "init": return startServer(data.defs, data.plugins, data.scripts);
        case "add": return server.addFile(data.name, data.text);
        case "del": return server.delFile(data.name);
        case "req": return server.request(data.body, function (err, reqData) {
            postMessageToSecure({ id: data.id, body: reqData, err: err && String(err) });
        });
        case "getFile":
            var c = pending[data.id];
            delete pending[data.id];
            return c(data.err, data.text);
        default: throw new Error("Unknown message type: " + data.type);
    }
};


var server;
var nextId = 0, pending = {};
function getFile(file, c) {
    //console.log('getFile',c);
    postMessageToSecure({ type: "getFile", name: file, id: ++nextId });
    pending[nextId] = c;
}

function startServer(defs, plugins, scripts) {
    console.log('starting tern server');
    if (scripts) importScripts.apply(null, scripts);
    server = new tern.Server({
        getFile: getFile,
        async: true,
        defs: defs,
        plugins:plugins
    });
}

//auto start the server once this loads
document.addEventListener('DOMContentLoaded', function () {
    startServer('', { requirejs: {}, doc_comment: true }, '');
});

/* dont need this as its not used in a web worker!
var console = {
    log: function (v) { postMessageToSecure({ type: "debug", message: v }); }
};*/


//REMOVE THIS WHEN DONE-- something is referencing it
function logO(a, b, c) {
    console.log('logO called... find where and remove',a, b, c);
}



/*copied from formatting.js -- need to clean this up! */
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