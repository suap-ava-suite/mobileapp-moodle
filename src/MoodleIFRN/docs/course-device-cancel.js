(() => {
 document.querySelector('.moodle-open-course__silent-back')?.click();
 const pending = JSON.parse(sessionStorage.getItem('ifrn_moodle_pending_open_course') || 'null');
 const error = document.querySelector('.moodle-open-course__error')?.textContent || '';
 return {path:location.pathname, pending:pending && {courseId:pending.courseId, siteUrl:pending.siteUrl},
 error:error.replace(/\d{5,}/g,'[redacted]'),
 loading:!!document.querySelector('.ifrn-course-handoff'),
 buttons:[...document.querySelectorAll('page-moodle-open-course ion-button')].map(b=>({text:b.textContent.trim(),disabled:b.disabled})),
 frames:[...document.querySelectorAll('iframe')].map(f=>({src:f.src.split('?')[0]})),
 profileAvailable:!!sessionStorage.getItem('ifrn_painel_profile'),
 dashboardAvailable:!!sessionStorage.getItem('ifrn_painel_dashboard')};
})()
