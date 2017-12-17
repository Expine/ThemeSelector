'use strict';

var electron = require('electron');
var app = electron.app;
var BrowserWindow = electron.BrowserWindow;

var mainWindow = null;

app.on('window-all-closed', function() {
    if(process.platform != 'darwin')
        app.quit();
});

app.on('ready', function() {
    mainWindow = new BrowserWindow({
        "width": 550,
        "height": 300,
        "transparent": true,
        "frame": false,
        "resizable": false,
        "always-on-top": true
    });    
    mainWindow.loadURL('file://' + __dirname + "./electron.html");
    mainWindow.setAlwaysOnTop(true);

    mainWindow.on('closed', function() {
        mainWindow = null;
    })
})

