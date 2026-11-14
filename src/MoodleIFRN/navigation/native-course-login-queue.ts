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

/** Serializes non-cancellable Moodle callbacks without changing the Moodle persistence layer. */
export class NativeCourseLoginQueue {

    private settled: Promise<void> = Promise.resolve();

    run(action: () => Promise<void>, assertCurrent: () => void): Promise<void> {
        const task = this.settled.then(async () => {
            assertCurrent();
            await action();
            assertCurrent();

            return undefined;
        });
        // Failure/cancellation cannot poison the lane or release it before native work settles.
        this.settled = task.catch(() => undefined);

        return task;
    }

    idle(): Promise<void> {
        return this.settled;
    }

}
