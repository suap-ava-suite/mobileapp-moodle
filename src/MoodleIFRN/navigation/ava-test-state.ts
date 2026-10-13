const KEY = 'ifrn_ava_test_pending_until';
export function beginAvaTest(): void {
    sessionStorage.setItem(KEY, String(Date.now() + 180000));
}
export function endAvaTest(): void {
    sessionStorage.removeItem(KEY);
}
export function isAvaTestPending(): boolean {
    const until = Number(sessionStorage.getItem(KEY));
    return Number.isFinite(until) && until > Date.now();
}
