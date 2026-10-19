(() => {
    const docs = [document,...[...document.querySelectorAll('iframe')].flatMap(f=>{try{return f.contentDocument?[f.contentDocument]:[];}catch{return [];}})];
    for (const doc of docs) {
        if (!doc.getElementById('dsgov-audit-privacy')) {
            const style=doc.createElement('style');style.id='dsgov-audit-privacy';
            style.textContent='[class*="user-name"],[class*="username"],[class*="user-info"],[class*="user-avatar"],[class*="profile"],[class*="matricula"],[class*="email"],.ava-header-user,.welcome__account{filter:blur(9px)!important}';
            doc.head.appendChild(style);
        }
        const walk=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);
        const nodes=[];while(walk.nextNode())nodes.push(walk.currentNode);
        for(const node of nodes) {
            if (['SCRIPT','STYLE'].includes(node.parentElement?.tagName)) continue;
            if (/\b\d{11,14}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(node.textContent)) node.textContent=node.textContent.replace(/\b\d{11,14}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[oculto]');
        }
    }
    return 'Proteção visual temporária aplicada; nenhum dado pessoal exportado.';
})()
