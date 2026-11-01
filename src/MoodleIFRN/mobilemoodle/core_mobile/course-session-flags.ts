// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/** Estado transitório do curso na aba/origem atual; não contém credenciais Moodle. */
export const COURSE_SESSION_EPOCH_KEY = 'ifrn_moodle_session_epoch';

const COURSE_SESSION_FLAGS = [
    'ifrn_moodle_oauth_pending',
    'ifrn_moodle_resume_oauth',
    'ifrn_moodle_poc_oauth_pending',
    'ifrn_moodle_poc_resume_oauth',
    'ifrn_moodle_pending_open_course',
    'ifrn_moodle_identity_mismatch',
    'ifrn_course_origin',
    'ifrn_course_id',
];

/** Invalida tentativas anteriores ao logout sem apagar preferências ou sites nativos salvos. */
export function clearCourseSessionFlags(): void {
    if (COURSE_SESSION_FLAGS.some(key => sessionStorage.getItem(key) !== null)) {
        const epoch = Number(sessionStorage.getItem(COURSE_SESSION_EPOCH_KEY)) || 0;
        sessionStorage.setItem(COURSE_SESSION_EPOCH_KEY, String(epoch + 1));
    }
    for (const key of COURSE_SESSION_FLAGS) {
        sessionStorage.removeItem(key);
    }
}
