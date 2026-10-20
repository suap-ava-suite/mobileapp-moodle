(() => ({path:location.pathname,ready:document.readyState,
 bodyTags:[...document.body.children].map(e=>e.tagName),
 hasCordova:!!window.cordova,platform:window.cordova?.platformId,
 angular:!!document.querySelector('[ng-version]'),
 scriptPaths:[...document.scripts].map(s=>{try{return new URL(s.src).pathname}catch{return ''}}),
 failedResources:performance.getEntriesByType('resource').filter(e=>e.responseStatus>=400).map(e=>({path:new URL(e.name).pathname,status:e.responseStatus}))}))()
