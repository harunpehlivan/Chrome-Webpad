/*
 * binds editor toolbar (added by morgan)
 * 
 * NOT done
 * 
 * if trying to follow the mvc model, will need to add controller
 */


/**
 * @constructor
 */
function EditorToolbar(cm) {
    this.cm = cm;
    $('#broom-button').on('click', function () {
        cm.formatCode();//COMEBACK- add parameter for collapse on format
    })
}


