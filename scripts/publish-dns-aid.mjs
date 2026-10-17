/**
 * Publish DNS-AID HTTPS/SVCB records and optionally enable DNSSEC.
 *
 *   node scripts/publish-dns-aid.mjs --print
 *   node scripts/publish-dns-aid.mjs --dry-run --zone example.com --hostname example.com
 *   CLOUDFLARE_API_TOKEN=... node scripts/publish-dns-aid.mjs \
 *     --zone example.com --hostname example.com --dnssec
 *
 * Token scopes: Zone DNS Edit. DNSSEC also needs Zone DNSSEC Edit.
 * After enabling DNSSEC, add the printed DS record at the registrar
 * (Cloudflare Registrar does this automatically).
 */
import {
  DEFAULT_HOSTNAME,
  dnsAidRecords,
  dnsAidZoneFile,
  normalizeHostname,
  workersDevDnssecBlocked,
} from "../dns/dns-aid.mjs";

const API = "https://api.cloudflare.com/client/v4";

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

async function cf(token, path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json();
  if (!body.success) {
    const message = (body.errors ?? [])
      .map((error) => `[${error.code}] ${error.message}`)
      .join("; ");
    throw new Error(
      `${init.method ?? "GET"} ${path} failed: ${message || response.status}`,
    );
  }
  return body.result;
}

function recordBody(record, hostname) {
  if (record.type === "TXT") {
    return {
      type: "TXT",
      name: record.name,
      content: record.content,
      ttl: record.ttl,
      proxied: false,
      comment: "ARD catalog pointer (DNS-AID)",
    };
  }
  return {
    type: record.type,
    name: record.name,
    ttl: record.ttl,
    proxied: false,
    comment: "DNS-AID ServiceMode discovery record",
    data: {
      priority: record.priority,
      target: hostname,
      value: record.params,
    },
  };
}

async function upsert(token, zoneId, record, hostname) {
  const listed = await cf(
    token,
    `/zones/${zoneId}/dns_records?type=${record.type}&name=${encodeURIComponent(record.name)}`,
  );
  const existing = Array.isArray(listed)
    ? listed.find((row) => row.type === record.type && row.name === record.name)
    : undefined;
  const body = recordBody(record, hostname);
  if (existing) {
    const updated = await cf(token, `/zones/${zoneId}/dns_records/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    console.log(`updated ${updated.type} ${updated.name}`);
    return;
  }
  const created = await cf(token, `/zones/${zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  console.log(`created ${created.type} ${created.name}`);
}

async function main() {
  const hostname = normalizeHostname(
    argValue("--hostname") ?? process.env.DNS_AID_HOSTNAME ?? DEFAULT_HOSTNAME,
  );
  const printOnly = hasFlag("--print") || hasFlag("--dry-run");
  const enableDnssec = hasFlag("--dnssec");

  console.log(dnsAidZoneFile(hostname));

  if (workersDevDnssecBlocked(hostname)) {
    console.error(
      `${hostname} is on workers.dev. Cloudflare synthesizes unsigned HTTPS answers there, and customers cannot add SVCB records or enable DNSSEC on that zone. Attach a custom domain, then re-run with --zone and --hostname.`,
    );
    process.exit(printOnly ? 0 : 2);
  }

  if (printOnly && !process.env.CLOUDFLARE_API_TOKEN) {
    console.log("Dry run only. Set CLOUDFLARE_API_TOKEN and pass --zone to publish.");
    return;
  }

  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    console.error("Set CLOUDFLARE_API_TOKEN (Zone DNS Edit).");
    process.exit(1);
  }

  const zoneName = normalizeHostname(
    argValue("--zone") ?? process.env.CLOUDFLARE_ZONE_NAME ?? "",
  );
  if (!zoneName) {
    console.error("Pass --zone example.com (the Cloudflare zone to edit).");
    process.exit(1);
  }
  if (!hostname.endsWith(zoneName) && hostname !== zoneName) {
    console.error(`Hostname ${hostname} is not inside zone ${zoneName}.`);
    process.exit(1);
  }

  if (printOnly) {
    console.log(
      `Dry run. Would publish ${dnsAidRecords(hostname).length} records in ${zoneName}.`,
    );
    return;
  }

  const zones = await cf(token, `/zones?name=${encodeURIComponent(zoneName)}`);
  const zone = Array.isArray(zones) ? zones[0] : undefined;
  if (!zone) {
    throw new Error(`Cloudflare zone not found: ${zoneName}`);
  }

  for (const record of dnsAidRecords(hostname)) {
    await upsert(token, zone.id, record, hostname);
  }

  if (enableDnssec) {
    const dnssec = await cf(token, `/zones/${zone.id}/dnssec`, {
      method: "PATCH",
      body: JSON.stringify({ status: "active" }),
    });
    console.log(`DNSSEC status: ${dnssec.status}`);
    if (dnssec.ds) console.log(`DS: ${dnssec.ds}`);
    if (dnssec.key_tag != null) {
      console.log(
        `DS fields: key tag ${dnssec.key_tag}, algorithm ${dnssec.algorithm}, digest type ${dnssec.digest_type}, digest ${dnssec.digest}`,
      );
    }
    console.log(
      "Add that DS record at the registrar if the domain is not on Cloudflare Registrar.",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
