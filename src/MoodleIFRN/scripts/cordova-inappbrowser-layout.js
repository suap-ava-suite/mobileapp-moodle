'use strict';

const { patchPlugin } = require('./patch-inappbrowser-layout.cjs');

module.exports = context => {
    patchPlugin(context.opts.projectRoot);
};
