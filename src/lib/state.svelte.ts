export let breadcrumb = $state<string[]>([]);

export function setBreadcrumb(path: string | undefined) {
    breadcrumb.length = 0;

    if (!path) return;

    const pathParts = path.split('/');
    let currentPath = '';

    for (let i = 0; i < pathParts.length; i++) {
        if (i === 0) {
            breadcrumb.push('');
            currentPath = pathParts[i];
        } else {
            breadcrumb.push(currentPath);
            currentPath = `${currentPath}/${pathParts[i]}`;
        }
    }
}