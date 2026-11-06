var exec = require('cordova/exec');

exports.open = function (url, success, error, returned) {
    var opened = false;
    exec(function (mode) {
        if (mode === 'browser-returned') {
            if (returned) {
                returned();
            }
            return;
        }
        if (!opened) {
            opened = true;
            success(mode);
        }
    }, error, 'IfrnCustomTabs', 'open', [url]);
};
