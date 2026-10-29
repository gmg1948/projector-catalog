import { WIX_CLIENT_ID } from "./config.js";
export const WIX_API_BASE = "https://www.wixapis.com";
const TOKEN_URL = `${WIX_API_BASE}/oauth2/token`;
const STORAGE_KEY = `wix-visitor-${WIX_CLIENT_ID}`;
let memory = null;
export const browserTokenStore = {
    load () {
        if (memory) return memory;
        if (typeof localStorage === "undefined") return null;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) memory = JSON.parse(raw);
        } catch  {}
        return memory;
    },
    save (tokens) {
        memory = tokens;
        if (typeof localStorage === "undefined") return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
        } catch  {}
    }
};
let store = browserTokenStore;
export function useTokenStore(s) {
    store = s;
}
export async function mintTokens(body, role = "visitor") {
    const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            clientId: WIX_CLIENT_ID,
            ...body
        })
    });
    if (!res.ok) throw new Error(`Wix auth failed (${res.status}).`);
    const data = await res.json();
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
        role
    };
}
export function loadTokens() {
    return store.load();
}
export function setTokens(tokens) {
    store.save(tokens);
}
export function clearTokens() {
    store.save({
        accessToken: "",
        refreshToken: "",
        expiresAt: 0
    });
}
export async function accessToken() {
    const t = store.load();
    if (t && t.expiresAt - 60_000 > Date.now()) return t.accessToken;
    let fresh;
    if (t?.refreshToken) {
        try {
            fresh = await mintTokens({
                grantType: "refresh_token",
                refreshToken: t.refreshToken
            }, t.role ?? "visitor");
        } catch  {}
    }
    fresh ??= await mintTokens({
        grantType: "anonymous"
    });
    store.save(fresh);
    return fresh.accessToken;
}
export class WixApiError extends Error {
    status;
    code;
    details;
    constructor(message, status, code, details){
        super(message), this.status = status, this.code = code;
        this.details = details;
    }
}
export async function wixRequest(path, { method = "POST", body, query } = {}) {
    const url = new URL(path, WIX_API_BASE);
    for (const [k, v] of Object.entries(query ?? {})){
        for (const item of Array.isArray(v) ? v : [
            v
        ])url.searchParams.append(k, String(item));
    }
    const res = await fetch(url, {
        method,
        headers: {
            Authorization: await accessToken(),
            "Content-Type": "application/json"
        },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!res.ok) {
        let message = "", code, details;
        try {
            const j = await res.json();
            message = j?.message ?? "";
            code = j?.details?.applicationError?.code;
            details = j?.details;
        } catch  {}
        throw new WixApiError(message || `${method} ${url.pathname} failed (${res.status}).`, res.status, code, details);
    }
    return res.status === 204 ? null : await res.json();
}
