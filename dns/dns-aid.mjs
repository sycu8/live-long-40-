/**
 * DNS-AID (draft-mozleywilliams-dnsop-dnsaid) record set for the public origin.
 *
 * ServiceMode (priority 1) HTTPS and SVCB records under `_agents`, with the
 * registered `alpn` and `port` parameters from RFC 9460. The origin speaks
 * HTTP/3 and HTTP/2; these records do not advertise an ALPN the server does
 * not negotiate.
 *
 * `workers.dev` is not a customer DNS zone and is not DNSSEC-signed, so a
 * validating resolver will not set AD=1 for this hostname. Publish this set
 * on a custom domain and enable DNSSEC (DS at the registrar) before the
 * isitagentready dnsAid check can pass.
 */

export const DEFAULT_HOSTNAME = "vivaage.orangecloud.vn";

/** Owner-name labels the scanner queries (SVCB, then HTTPS). */
export const DNS_AID_LABELS = ["_index._agents", "_a2a._agents", "_mcp._agents"];

export const DNS_AID_PARAMS = 'alpn="h3,h2" port=443 mandatory="alpn,port"';

export function normalizeHostname(hostname) {
  return String(hostname)
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
    .toLowerCase();
}

export function workersDevDnssecBlocked(hostname) {
  const host = normalizeHostname(hostname);
  return host === "workers.dev" || host.endsWith(".workers.dev");
}

/**
 * @param {string} hostname apex the site is served on
 * @returns {Array<{type:string,name:string,ttl:number,priority?:number,target?:string,params?:string,content?:string,presentation:string}>}
 */
export function dnsAidRecords(hostname) {
  const host = normalizeHostname(hostname);
  const records = [];

  for (const label of DNS_AID_LABELS) {
    for (const type of ["HTTPS", "SVCB"]) {
      const name = `${label}.${host}`;
      records.push({
        type,
        name,
        ttl: 3600,
        priority: 1,
        target: `${host}.`,
        params: DNS_AID_PARAMS,
        presentation: `${name}. 3600 IN ${type} 1 ${host}. ${DNS_AID_PARAMS}`,
      });
    }
  }

  const catalogName = `_catalog._agents.${host}`;
  const catalogValue = `url=https://${host}/.well-known/ai-catalog.json`;
  records.push({
    type: "TXT",
    name: catalogName,
    ttl: 3600,
    content: catalogValue,
    presentation: `${catalogName}. 3600 IN TXT "${catalogValue}"`,
  });

  return records;
}

export function dnsAidZoneFile(hostname) {
  const host = normalizeHostname(hostname);
  const lines = [
    `; DNS-AID records for ${host}`,
    `; ServiceMode SVCB/HTTPS (RFC 9460). Sign the zone with DNSSEC.`,
    `; Do not proxy these names: Cloudflare replaces manual HTTPS on proxied names.`,
    "",
    ...dnsAidRecords(host).map((record) => record.presentation),
    "",
  ];
  return lines.join("\n");
}
