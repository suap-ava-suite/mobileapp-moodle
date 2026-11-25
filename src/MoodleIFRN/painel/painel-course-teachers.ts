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

import type { CoreSite } from '@classes/sites/site';
import type { CoreUserParticipant } from '@features/user/services/user';
import { CoreSites } from '@services/sites';
import { CoreWS } from '@services/ws';
import { resolveCourseSite } from '../mobilemoodle/core_mobile/course-target';
import type { NativePainelCourse } from './painel-native-model';

const PARTICIPANTS_WS = 'core_enrol_get_enrolled_users';
const PARTICIPANTS_PER_PAGE = 100;
const MAX_PARTICIPANT_PAGES = 5;
const MOODLE_TEACHER_ROLES = new Set(['editingteacher', 'teacher']);

/**
 * Looks up the teaching roles in the participants list of a single Moodle course.
 *
 * @param site Authorized Moodle site for the course.
 * @param courseId Moodle course ID.
 * @param isCurrent Whether the session and card still accept results.
 * @returns Display names of teachers available to the student.
 */
async function readCourseTeachers(site: CoreSite, courseId: number, isCurrent: () => boolean): Promise<string> {
    const names = new Set<string>();
    for (let page = 0; page < MAX_PARTICIPANT_PAGES && isCurrent(); page++) {
        // Optional metadata must not start a login or change the active Moodle session.
        // This Moodle token is used only by the official WS transport for its own site.
        const participants = await CoreWS.call<CoreUserParticipant[]>(PARTICIPANTS_WS, {
            courseid: courseId,
            options: [
                { name: 'userfields', value: 'id,fullname,roles' },
                { name: 'limitfrom', value: String(page * PARTICIPANTS_PER_PAGE) },
                { name: 'limitnumber', value: String(PARTICIPANTS_PER_PAGE) },
            ],
        }, { siteUrl: site.getURL().replace(/\/$/, ''), wsToken: site.getToken() });
        if (!Array.isArray(participants)) {
            return '';
        }
        for (const person of participants) {
            if (typeof person?.fullname === 'string' && Array.isArray(person.roles)
                && person.roles.some(role => MOODLE_TEACHER_ROLES.has(role?.shortname))) {
                const name = person.fullname.trim();
                if (name) {
                    names.add(name);
                }
            }
        }
        if (participants.length < PARTICIPANTS_PER_PAGE) {
            break;
        }
    }

    return isCurrent() ? [...names].join(', ') : '';
}

/**
 * Resolves missing teachers through existing Moodle sessions of the same Panel account.
 *
 * @param courses Diários already authorized by the Panel.
 * @param panelIdentity Identity of the current Panel account.
 * @param isCurrent Whether the Panel is still showing that account and set of courses.
 * @returns Teacher names by card key.
 */
export async function loadMoodleTeacherNames(
    courses: readonly NativePainelCourse[],
    panelIdentity: string,
    isCurrent: () => boolean,
): Promise<ReadonlyMap<string, string>> {
    const owner = panelIdentity.trim().toLowerCase();
    const targets = new Map<string, Map<number, string[]>>();
    const names = new Map<string, string>();
    for (const course of courses) {
        const siteUrl = resolveCourseSite(course);
        const courseId = course.moodle_course_id;
        if (course.teacherNames !== undefined || !course.is_enrolled || !siteUrl || siteUrl !== course.moodle_site_url
            || !courseId || !Number.isSafeInteger(courseId) || courseId <= 1) {
            continue;
        }
        const byId = targets.get(siteUrl) ?? new Map<number, string[]>();
        const keys = byId.get(courseId) ?? [];
        keys.push(course.key);
        byId.set(courseId, keys);
        targets.set(siteUrl, byId);
    }
    if (!owner || !targets.size || !isCurrent()) {
        return names;
    }

    const savedSites = await CoreSites.getSites();
    await Promise.all([...targets].map(async ([siteUrl, byId]) => {
        const saved = savedSites.find(candidate => !candidate.loggedOut
            && candidate.siteUrl.replace(/\/$/, '') === siteUrl
            && candidate.info?.username?.trim().toLowerCase() === owner);
        if (!saved || !isCurrent()) {
            return;
        }
        // getSite retrieves the saved session without activating it.
        const site = await CoreSites.getSite(saved.id).catch(() => undefined);
        if (!site || !site.wsAvailable(PARTICIPANTS_WS)) {
            return;
        }
        const userId = site.getUserId();
        const canRead = (): boolean => isCurrent() && !site.isLoggedOut() && !!site.getToken()
            && Number.isSafeInteger(userId) && userId > 0 && site.getUserId() === userId
            && site.getURL().replace(/\/$/, '') === siteUrl && site.getInfo()?.username?.trim().toLowerCase() === owner;
        for (const [courseId, keys] of byId) {
            if (!canRead()) {
                return;
            }
            const teachers = await readCourseTeachers(site, courseId, canRead).catch(() => '');
            if (teachers && canRead()) {
                keys.forEach(key => names.set(key, teachers));
            }
        }
    }));

    return isCurrent() ? names : new Map();
}
