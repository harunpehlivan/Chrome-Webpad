/**
 * @constructor
 */
function TextApp() {
    this.editor_ = null;
    this.settings_ = null;
    this.tabs_ = null;
    this.dialogController_ = null;
    this.hotkeysController_ = null;
    this.menuController_ = null;
    this.searchController_ = null;
    this.settingsController_ = null;
    this.windowController_ = null;
    this.hasFrame_ = false;
}

/**
 * Called when all the resources have loaded. All initializations should be done
 * here.
 */
TextApp.prototype.init = function () {
    var td = 'TO DO LIST';
    td += '\n -' + 'fix css lint';
    td += '\n -' + 'add code cleanup (beautify)';
    td += '\n -' + 'add toolbar buttons';
    td += '\n -' + 'add context menu';
    td += '\n -' + 'add code tree';
    td += '\n -' + 'add tern based on modes (will be tricky as which docs get added to server)';
    td += '\n -' + '     ' + ' TERN IS WORKING! add proper functions and hotkeys (and fix error being thrown by a logO existing somewhere)';
    td += '\n -' + '     ' + ' start by making tern work per file (keep it simple)';
    td += '\n -' + '     ' + ' add tern plugins and defs (need to turn script files to json to add defs in startServer)';
    td += '\n -' + 'add serach/replace';
    console.log(td);
    
    this.settings_ = new Settings();
    this.analytics_ = new Analytics();
    //NOTE: Editor = EditorCodeMirror (set in editor-cm.js)
    this.editor_ = new Editor($('#editor')[0], this.settings_);

    //added by morgan
    this.editorToolbar = new EditorToolbar(this.editor_);
    
    //Added by morgan
    try {
        window.editor = this.editor_.cm_;//for quick debugging
        // setTimeout(function () { throw ('WindowController');}, 0);
    }
    catch (ex) {
        console.log(ex, 'error when setting editor to global prop');
    }

    this.dialogController_ = new DialogController($('#dialog-container'),
                                                  this.editor_);
    this.tabs_ = new Tabs(this.editor_, this.dialogController_, this.settings_);

    this.menuController_ = new MenuController(this.tabs_);
    this.searchController_ = new SearchController(this.editor_.getSearch());
    this.settingsController_ = new SettingsController(this.settings_);
    this.windowController_ = new WindowController(
        this.editor_, this.settings_, this.analytics_);
    this.hotkeysController_ = new HotkeysController(this.windowController_,
        this.tabs_, this.editor_, this.settings_, this.analytics_);

    if (this.settings_.isReady()) {
        this.onSettingsReady_();
    } else {
        $(document).bind('settingsready', this.onSettingsReady_.bind(this));
    }
    $(document).bind('settingschange', this.onSettingsChanged_.bind(this));

    chrome.runtime.getBackgroundPage(function (bg) {
        bg.background.onWindowReady(this);
    }.bind(this));
};

/**
 * @param {Array.<FileEntry>} entries The file entries to be opened.
 *
 * Open one tab per file. Usually called from the background page.
 */
TextApp.prototype.openEntries = function (entries) {
    for (var i = 0; i < entries.length; i++) {
        this.tabs_.openFileEntry(entries[i]);
    }
    this.windowController_.focus_();
};

TextApp.prototype.openNew = function () {
    this.tabs_.newTab();
};

TextApp.prototype.setHasChromeFrame = function (hasFrame) {
    this.hasFrame_ = hasFrame;
    this.windowController_.windowControlsVisible(!hasFrame);
};

/**
 * @return {Array.<FileEntry>}
 */
TextApp.prototype.getFilesToRetain = function () {
    return this.tabs_.getFilesToRetain();
};

TextApp.prototype.setTheme = function () {
    var theme = this.settings_.get('theme');
    this.windowController_.setTheme(theme);
    this.editor_.setTheme(theme);
};

/**
 * Called when all the services have started and settings are loaded.
 */
TextApp.prototype.onSettingsReady_ = function () {
    this.setTheme();
    this.editor_.setFontSize(this.settings_.get('fontsize'));
    this.editor_.showHideLineNumbers(this.settings_.get('linenumbers'));
    this.editor_.showHideMargin(this.settings_.get('margin'),
                                this.settings_.get('margincol'));
    this.editor_.setSmartIndent(this.settings_.get('smartindent'));
    this.editor_.replaceTabWithSpaces(this.settings_.get('spacestab'));
    this.editor_.setTabSize(this.settings_.get('tabsize'));
    this.editor_.setWrapLines(this.settings_.get('wraplines'));
    this.analytics_.setEnabled(this.settings_.get('analytics'));
    this.analytics_.reportSettings(this.settings_);
    this.windowController_.setAlwaysOnTop(this.settings_.get('alwaysontop'));
};

/**
 * @param {Event} e
 * @param {string} key
 * @param {*} value
 */
TextApp.prototype.onSettingsChanged_ = function (e, key, value) {
    switch (key) {
        case 'alwaysontop':
            this.windowController_.setAlwaysOnTop(value);
            break;

        case 'fontsize':
            this.editor_.setFontSize(value);
            break;

        case 'linenumbers':
            this.editor_.showHideLineNumbers(value);
            break;

        case 'margin':
        case 'margincol':
            this.editor_.showHideMargin(this.settings_.get('margin'),
                                        this.settings_.get('margincol'));
            break;

        case 'smartindent':
            this.editor_.setSmartIndent(value);
            break;

        case 'spacestab':
            this.editor_.replaceTabWithSpaces(this.settings_.get('spacestab'));
            break;

        case 'tabsize':
            this.editor_.setTabSize(value);
            break;

        case 'theme':
            this.setTheme();
            break;

        case 'wraplines':
            this.editor_.setWrapLines(value);
            break;
    }
};

var textApp = new TextApp();

$(document).ready(textApp.init.bind(textApp));

/**
* Logs to console and footer 
* @param {object} object - something to log
* @param {string} [str_Description=''] - descirption of item to log
* @param {bool} [bool_DoNotSetVar=false] - pass true to prevent setting global var for debugging object
*/
TextApp.prototype.log = function (object, str_Description, bool_DoNotSetVar) {
    if (window.logOtempCount == undefined) {
        window.logOtempCount = 0;
    }
    setTimeout(function () {
        try {
            var globalVarName = '';
            if (bool_DoNotSetVar !== true) {
                logOtempCount++;
                if (logOtempCount > 99) { logOtempCount = 1; }//max of 99 temp vars
                globalVarName = 'tmp' + logOtempCount;
                window[globalVarName] = object;
                if (str_Description == undefined) { str_Description = ''; }
                str_Description = globalVarName + ' --- ' + str_Description;
            }
            if (str_Description && str_Description != '') {
                console.log('\n       ' + str_Description + '  (next logged object)   ' + textApp.CurrentTime(true));
            }
            console.log(object);
            /* no need for footer logging right now....
            //add to footer for quick debugging
            var el = $('#footercontent');
            var objectStr = '';
            try{
                objectStr= RemoveHtml(object.toString());
            }
            catch(ex){}
            objectStr= objectStr.substring(0,100);
            el.html("<div style='color:blue;'>"+str_Description + "</div>" + objectStr + "<hr/>" + el.html());*/
        }
        catch (ex) {
            setTimeout(function () {
                throw (ex);
            }, 0);
        }
    }, 0);
}

//gets current time with special format
TextApp.prototype.CurrentTime = function (bool_IncMilliSeconds) {
    return new Date().timeNow(bool_IncMilliSeconds);
}
//For the time now (used by CurrentTime() function)
Date.prototype.timeNow = function (bool_IncMilliSeconds) {
    var ms = '';
    if (bool_IncMilliSeconds === true) {
        ms = ":";
        ms += (this.getMilliseconds() < 10) ? "0" : "";
        ms += this.getMilliseconds();
    }
    return ((this.getHours() < 10) ? "0" : "") + this.getHours() + ":" + ((this.getMinutes() < 10) ? "0" : "") + this.getMinutes() + ":" + ((this.getSeconds() < 10) ? "0" : "") + this.getSeconds() + ms;
};

//set global window.log for quick access
window.log = textApp.log;
//removes html from a string
function RemoveHtml(str_Html) {
    var tmp = document.createElement("DIV");
    tmp.innerHTML = str_Html;
    return tmp.textContent || tmp.innerText || "";
}