import { WixApiError, wixRequest } from "./client.js";
import { imgRatio, imgSrc } from "./media.js";
import { DEFAULT_LIMIT, DISTINCT_LIMIT, countBody, distinctBody, patchModifications, queryBody, referencesBody, restHasNext, restWriteData, toItem, toPage, toValues } from "./items-core.js";
const media = {
    imgSrc,
    imgRatio
};
const notFound = (e)=>e instanceof WixApiError && e.status === 404;
export async function queryItems(collectionId, query = {}) {
    const { limit = DEFAULT_LIMIT, skip = 0 } = query;
    const res = await wixRequest("/wix-data/v2/items/query", {
        body: queryBody(collectionId, query)
    });
    const items = (res?.dataItems ?? []).map((d)=>d.data ?? {});
    return toPage(items, restHasNext(res?.pagingMetadata, skip, limit), res?.pagingMetadata?.total, media);
}
export async function getItemById(collectionId, itemId, { include = [] } = {}) {
    try {
        const res = await wixRequest(`/wix-data/v2/items/${encodeURIComponent(itemId)}`, {
            method: "GET",
            query: {
                dataCollectionId: collectionId,
                ...include.length ? {
                    "includeReferences.field": include
                } : {}
            }
        });
        return res?.dataItem?.data ? toItem(res.dataItem.data, media) : null;
    } catch (e) {
        if (notFound(e)) return null;
        throw e;
    }
}
export async function getItemBy(collectionId, field, value, { include = [] } = {}) {
    const page = await queryItems(collectionId, {
        filters: [
            {
                field,
                op: "eq",
                value
            }
        ],
        limit: 1,
        include
    });
    return page.items[0] ?? null;
}
export async function countItems(collectionId, filters = []) {
    const res = await wixRequest("/wix-data/v2/items/count", {
        body: countBody(collectionId, filters)
    });
    return typeof res?.totalCount === "number" ? res.totalCount : 0;
}
export async function distinctValues(collectionId, field, { filters = [], limit = DISTINCT_LIMIT } = {}) {
    const res = await wixRequest("/wix-data/v2/items/query-distinct-values", {
        body: distinctBody(collectionId, field, filters, limit)
    });
    return toValues(res?.distinctValues ?? [], media);
}
export async function insertItem(collectionId, data, { link = {} } = {}) {
    const res = await wixRequest("/wix-data/v2/items", {
        body: {
            dataCollectionId: collectionId,
            dataItem: {
                data: restWriteData(data)
            }
        }
    });
    const item = toItem(res?.dataItem?.data ?? {}, media);
    for (const [field, refIds] of Object.entries(link))await linkItems(collectionId, field, item._id, refIds);
    return item;
}
export async function updateItem(collectionId, item) {
    const res = await wixRequest(`/wix-data/v2/items/${encodeURIComponent(item._id)}`, {
        method: "PUT",
        body: {
            dataCollectionId: collectionId,
            dataItem: {
                id: item._id,
                data: restWriteData(item)
            }
        }
    });
    return toItem(res?.dataItem?.data ?? {}, media);
}
export async function patchItemFields(collectionId, itemId, fields) {
    const res = await wixRequest(`/wix-data/v2/items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        body: {
            dataCollectionId: collectionId,
            patch: {
                dataItemId: itemId,
                fieldModifications: patchModifications(fields)
            }
        }
    });
    return toItem(res?.dataItem?.data ?? {}, media);
}
export async function removeItem(collectionId, itemId) {
    try {
        const res = await wixRequest(`/wix-data/v2/items/${encodeURIComponent(itemId)}`, {
            method: "DELETE",
            query: {
                dataCollectionId: collectionId
            }
        });
        return res?.dataItem?.data ? toItem(res.dataItem.data, media) : null;
    } catch (e) {
        if (notFound(e)) return null;
        throw e;
    }
}
export async function linkItems(collectionId, field, itemId, refIds) {
    if (!refIds.length) return;
    await wixRequest("/wix-data/v2/bulk/items/insert-references", {
        body: referencesBody(collectionId, field, itemId, refIds)
    });
}
export async function unlinkItems(collectionId, field, itemId, refIds) {
    if (!refIds.length) return;
    await wixRequest("/wix-data/v2/bulk/items/remove-references", {
        body: referencesBody(collectionId, field, itemId, refIds)
    });
}
