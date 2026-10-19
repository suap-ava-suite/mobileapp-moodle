JSON.stringify((() => {
    const el=[...document.querySelectorAll('page-moodle-open-course,page-marketplace-ifrn')].find(e=>!e.closest('.ion-page-hidden') && e.getClientRects().length);
    const component=el && window.ng?.getComponent(el);
    if(!component)return {component:false};
    const text=String(component.formError || component.error || component.statusMessage || '');
    return {page:el.tagName,loading:!!component.loading,error:!!(component.formError || component.error),accountIssue:!!component.accountIssue,
        flags:{timeout:/timeout|tempo.*esgot|demor/i.test(text),session:/sess[aã]o|expir/i.test(text),loading:/carreg|abrind|prepar/i.test(text)},
        modal:!!document.querySelector('ion-loading')};
})())
