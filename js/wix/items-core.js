export const DEFAULT_LIMIT = 20;
export const DISTINCT_LIMIT = 100;
export const IMAGE_WIDTH = 1200;
export const IMAGE_HEIGHT = 900;
function isDateWrapper(v) {
    if (!v || typeof v !== "object" || Array.isArray(v)) return false;
    const keys = Object.keys(v);
    return keys.length === 1 && keys[0] === "$date" && typeof v.$date === "string";
}
export function imageSize(ratio) {
    return {
        width: IMAGE_WIDTH,
        height: ratio ? Math.round(IMAGE_WIDTH * ratio) : IMAGE_HEIGHT
    };
}
export function toValue(v, media) {
    if (v instanceof Date) return v.toISOString();
    if (isDateWrapper(v)) {
        const t = new Date(v.$date);
        return Number.isNaN(t.getTime()) ? v.$date : t.toISOString();
    }
    if (typeof v === "string" && v.startsWith("wix:image://")) {
        const { width, height } = imageSize(media.imgRatio(v));
        return media.imgSrc(v, width, height);
    }
    if (Array.isArray(v)) return v.map((x)=>toValue(x, media));
    if (v && typeof v === "object") {
        const out = {};
        for (const [k, val] of Object.entries(v))out[k] = toValue(val, media);
        return out;
    }
    return v;
}
export const toItem = (raw, media)=>toValue(raw, media);
export function toPage(items, hasNext, total, media) {
    return {
        items: items.map((r)=>toItem(r, media)),
        hasNext,
        total: total ?? null
    };
}
export const toValues = (values, media)=>values.map((v)=>toValue(v, media));
export function formatDate(iso, locale = "en-US", options = {
    dateStyle: "long"
}) {
    if (typeof iso !== "string" || !iso) return "";
    const t = new Date(iso);
    return Number.isNaN(t.getTime()) ? "" : new Intl.DateTimeFormat(locale, options).format(t);
}
export function assertFilterValue(f) {
    if (f.op === "isEmpty" || f.op === "isNotEmpty") return;
    if (f.value === undefined) {
        throw new Error(`cms: filter on "${f.field}" (${f.op}) has an undefined value — pass a real value or omit the filter.`);
    }
    if (f.op === "between" && !(Array.isArray(f.value) && f.value.length === 2)) {
        throw new Error(`cms: filter on "${f.field}" (between) takes [start, end].`);
    }
}
export function betweenRange(f) {
    assertFilterValue(f);
    const [start, end] = f.value;
    return [
        start,
        end
    ];
}
export function restValue(v) {
    if (v instanceof Date) return {
        $date: v.toISOString()
    };
    if (Array.isArray(v)) return v.map(restValue);
    return v;
}
const REST_OPS = {
    eq: "$eq",
    ne: "$ne",
    gt: "$gt",
    ge: "$gte",
    lt: "$lt",
    le: "$lte",
    contains: "$contains",
    startsWith: "$startsWith",
    endsWith: "$endsWith",
    in: "$hasSome",
    hasSome: "$hasSome",
    hasAll: "$hasAll"
};
export function restCondition(f) {
    assertFilterValue(f);
    if (f.op === "isEmpty") return {
        [f.field]: null
    };
    if (f.op === "isNotEmpty") return {
        [f.field]: {
            $ne: null
        }
    };
    if (f.op === "between") {
        const [start, end] = betweenRange(f);
        return {
            [f.field]: {
                $gte: restValue(start),
                $lt: restValue(end)
            }
        };
    }
    return {
        [f.field]: {
            [REST_OPS[f.op]]: restValue(f.value)
        }
    };
}
export function restFilter(filters = []) {
    const conditions = filters.map(restCondition);
    if (conditions.length === 0) return {};
    if (conditions.length === 1) return conditions[0];
    return {
        $and: conditions
    };
}
export function restSort(sort = []) {
    return sort.map((s)=>({
            fieldName: s.field,
            order: s.direction === "desc" ? "DESC" : "ASC"
        }));
}
export function queryBody(collectionId, query = {}) {
    const { filters = [], sort = [], limit = DEFAULT_LIMIT, skip = 0, include = [], withTotal = false } = query;
    return {
        dataCollectionId: collectionId,
        query: {
            filter: restFilter(filters),
            ...sort.length ? {
                sort: restSort(sort)
            } : {},
            paging: {
                limit,
                offset: skip
            }
        },
        ...include.length ? {
            includeReferences: include.map((field)=>({
                    field
                }))
        } : {},
        ...withTotal ? {
            returnTotalCount: true
        } : {}
    };
}
export function restHasNext(pagingMetadata, offset, limit) {
    if (typeof pagingMetadata?.hasNext === "boolean") return pagingMetadata.hasNext;
    if (typeof pagingMetadata?.total === "number") return offset + (pagingMetadata.count ?? 0) < pagingMetadata.total;
    return (pagingMetadata?.count ?? 0) >= limit;
}
export function countBody(collectionId, filters = []) {
    return {
        dataCollectionId: collectionId,
        filter: restFilter(filters)
    };
}
export function distinctBody(collectionId, field, filters = [], limit = DISTINCT_LIMIT) {
    return {
        dataCollectionId: collectionId,
        fieldName: field,
        filter: restFilter(filters),
        paging: {
            limit,
            offset: 0
        }
    };
}
export function restWriteData(data) {
    const out = {};
    for (const [k, v] of Object.entries(data)){
        if (k === "_createdDate" || k === "_updatedDate" || k === "_owner") continue;
        out[k] = restValue(v);
    }
    return out;
}
export function patchModifications(fields) {
    const entries = Object.entries(fields);
    if (!entries.length) throw new Error("cms: patchItemFields called with no fields.");
    return entries.map(([fieldPath, value])=>({
            fieldPath,
            action: "SET_FIELD",
            setFieldOptions: {
                value: restValue(value)
            }
        }));
}
export function referencesBody(collectionId, field, itemId, refIds) {
    if (!refIds.length) throw new Error("cms: linkItems/unlinkItems called with no referenced ids.");
    return {
        dataCollectionId: collectionId,
        dataItemReferences: refIds.map((referencedItemId)=>({
                referringItemFieldName: field,
                referringItemId: itemId,
                referencedItemId
            }))
    };
}
