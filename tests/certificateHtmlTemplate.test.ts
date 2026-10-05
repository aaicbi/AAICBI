import { describe, it, expect } from "vitest";
import { renderCertificateHtml, type CertificateTemplateData } from "../src/lib/certificateHtmlTemplate";

const baseData: CertificateTemplateData = {
  traineeName: "Jane Doe",
  verb: "has successfully completed",
  credentialTitle: "Intro to AI",
  issuedAt: "5 October 2026",
  certificateCode: "AAICBI-ABCD-1234",
  organizationName: "Acme Academy",
  logoUrl: "https://example.blob.vercel-storage.com/logo.png",
  primaryColor: "#016B61",
  accentColor: "#D99A34",
  signatoryName: "Dr. Smith",
  signatoryTitle: "Director of Training",
  qrCodeSvg: "<svg><rect/></svg>",
};

describe("renderCertificateHtml", () => {
  it("substitutes every known token", () => {
    const html = "<p>{{traineeName}} {{verb}} {{credentialTitle}}</p>";
    expect(renderCertificateHtml(html, baseData)).toBe("<p>Jane Doe has successfully completed Intro to AI</p>");
  });

  it("escapes a text token so embedded markup can't break out", () => {
    const html = "<p>{{traineeName}}</p>";
    const data = { ...baseData, traineeName: '<script>alert(1)</script>"quoted"' };
    expect(renderCertificateHtml(html, data)).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt;&quot;quoted&quot;</p>"
    );
  });

  it("injects qrCodeSvg raw, never escaped", () => {
    const html = "<div>{{qrCodeSvg}}</div>";
    expect(renderCertificateHtml(html, baseData)).toBe("<div><svg><rect/></svg></div>");
  });

  it("leaves an unrecognized token untouched rather than dropping it", () => {
    const html = "<p>{{notARealToken}}</p>";
    expect(renderCertificateHtml(html, baseData)).toBe("<p>{{notARealToken}}</p>");
  });

  it("substitutes the same token when it appears multiple times", () => {
    const html = "{{traineeName}} and {{traineeName}} again";
    expect(renderCertificateHtml(html, baseData)).toBe("Jane Doe and Jane Doe again");
  });

  it("substitutes signatory and branding tokens", () => {
    const html = "{{signatoryName}}, {{signatoryTitle}} — {{organizationName}} ({{primaryColor}}/{{accentColor}})";
    expect(renderCertificateHtml(html, baseData)).toBe(
      "Dr. Smith, Director of Training — Acme Academy (#016B61/#D99A34)"
    );
  });

  it("leaves a logoUrl token untouched by escaping (no special characters in a normal URL)", () => {
    const html = '<img src="{{logoUrl}}">';
    expect(renderCertificateHtml(html, baseData)).toBe('<img src="https://example.blob.vercel-storage.com/logo.png">');
  });
});
