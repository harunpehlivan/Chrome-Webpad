# Webpad (Chrome App)

A code editor as a Chrome App. Built on top of [text-app](https://github.com/GoogleChrome/text-app)

## Current Status
 - Beta, needs a lot of work still

## Features
 - Supports many languages (including non-web languages) (using [CodeMirror][1])
 - Advanced features for web files (xml, html, json, css, javascript)
    - Code Formatting  (using [js-beautify][2])
    - Html and css: auto complete for standard tags
    - Javascript only: Intelligent auto complete (like Visual Studio Intellisense, using [tern][3]) 
    - Javascript only: error detection (using [JSHint][4])
    
## To Do
 - Add Code Tree for Javscript (using tern's abstract sytanx tree)
 - Add detailed context menu and operations similiar to NotePad++
 - Figure out how to make tern work for only one file at a time, and how to make it optionally provide hints for all open files
 - Add ability to open entire folders and save a project file (and later read the project file)

    


  [1]: https://github.com/marijnh/CodeMirror
  [2]: https://github.com/einars/js-beautify
  [3]: https://github.com/marijnh/tern
  [4]: https://github.com/jshint/jshint/
