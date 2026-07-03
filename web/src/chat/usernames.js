/* ==========================================================
   CHAT USERNAMES — autocomplete + LT ignore list
========================================================== */

export function getChatUsernames() {
    const names = new Set();
    document.querySelectorAll('#userlist .userlist_item').forEach(item => {
        const spans = item.querySelectorAll('span');
        const nameSpan = spans.length >= 2 ? spans[1] : spans[0];
        const n = nameSpan?.textContent?.trim();
        if (n) names.add(n);
    });
    document.querySelectorAll('#messagebuffer .username').forEach(el => {
        const n = el.textContent.replace(/[:\s]+$/, '').trim();
        if (n) names.add(n);
    });
    return [...names];
}
