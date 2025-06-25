export let breadcrumb = $state<string[]>([]);

export function setBreadcrumb(path: string | undefined) {
    const newPath = path ? path.split('/') : [];
    breadcrumb.length = 0;
    breadcrumb.push(...newPath);
}