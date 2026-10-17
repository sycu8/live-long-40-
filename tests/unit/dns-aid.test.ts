import { describe, expect, it } from "vitest";
import { BRAND } from "../../shared/brand";
import {
  DEFAULT_HOSTNAME,
  DNS_AID_LABELS,
  dnsAidRecords,
  dnsAidZoneFile,
  workersDevDnssecBlocked,
} from "../../dns/dns-aid.mjs";

describe("DNS-AID record set", () => {
  it("uses the public site hostname", () => {
    expect(new URL(BRAND.siteUrl).hostname).toBe(DEFAULT_HOSTNAME);
  });

  it("publishes ServiceMode HTTPS and SVCB records with alpn and port", () => {
    const records = dnsAidRecords("example.com");
    const service = records.filter(
      (record) => record.type === "HTTPS" || record.type === "SVCB",
    );
    expect(service).toHaveLength(DNS_AID_LABELS.length * 2);

    for (const label of DNS_AID_LABELS) {
      for (const type of ["HTTPS", "SVCB"]) {
        const record = service.find(
          (item) => item.type === type && item.name === `${label}.example.com`,
        );
        expect(record?.priority).toBe(1);
        expect(record?.target).toBe("example.com.");
        expect(record?.params).toContain('alpn="h3,h2"');
        expect(record?.params).toContain("port=443");
        expect(record?.presentation).toContain(`IN ${type} 1 example.com.`);
      }
    }

    const catalog = records.find((record) => record.type === "TXT");
    expect(catalog?.name).toBe("_catalog._agents.example.com");
    expect(catalog?.content).toBe("url=https://example.com/.well-known/ai-catalog.json");
  });

  it("renders a zone file and blocks unsigned workers.dev hosts", () => {
    const zone = dnsAidZoneFile("example.com");
    expect(zone).toContain("_index._agents.example.com. 3600 IN SVCB 1");
    expect(zone).toContain("_a2a._agents.example.com. 3600 IN HTTPS 1");
    expect(workersDevDnssecBlocked("song-an-40.sycu-lee.workers.dev")).toBe(true);
    expect(workersDevDnssecBlocked("example.com")).toBe(false);
  });
});
