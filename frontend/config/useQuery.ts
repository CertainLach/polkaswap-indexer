import { useRouter } from "next/router";

export function useQuery<T>(
    name: string,
    defaultValue: T,
    isValidState: (query: string | string[] | undefined) => boolean,
    parse: (query: string | string[] | undefined) => T,
    serialize: (value: T) => string | string[] | undefined,
    isDefaultValue: (value: T) => boolean,
): [T, (value: T, push?: boolean) => void] {
    const router = useRouter();
    let currentValue = defaultValue;
    if (isValidState(router.query[name]))
        currentValue = parse(router.query[name]);

    return [currentValue, (newValue, push = true) => {
        if (currentValue === newValue)
            return;
        const newQuery = {
            ...router.query
        };
        if (isDefaultValue(newValue)) {
            newQuery[name] = [];
        } else {
            newQuery[name] = serialize(newValue);
        }
        if (push) {
            router.push({ query: newQuery });
        } else {
            router.replace({ query: newQuery });
        }
    }]
}

export function useStringQuery(name: string, defaultValue: string, validate: (input: string) => boolean = () => true) {
    return useQuery(name, defaultValue, q => typeof q === 'string' && validate(q), q => q as string, v => v, v => v === defaultValue);
}
export function useNumberQuery(name: string, defaultValue: number, validate: (input: number) => boolean = () => true) {
    return useQuery(name, defaultValue, q => {
        if (typeof q !== 'string') return false;
        const num = parseInt(q, 10);
        if (isNaN(num)) return false;
        if (!validate(num)) return false;
        return true;
    }, q => parseInt(q as string), n => n.toString(10), v => v === defaultValue);
}