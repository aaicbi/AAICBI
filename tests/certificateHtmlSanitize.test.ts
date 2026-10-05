import { describe, it, expect } from "vitest";
import { sanitizeCertificateHtml } from "../src/lib/certificateHtmlSanitize";

describe("sanitizeCertificateHtml", () => {
  it("strips a <script> tag entirely", () => {
    const result = sanitizeCertificateHtml('<p>Hello</p><script>alert(1)</script>');
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert(1)");
    expect(result).toContain("<p>Hello</p>");
  });

  it("strips an onclick event-handler attribute but keeps the element", () => {
    const result = sanitizeCertificateHtml('<div onclick="alert(1)">Click me</div>');
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("alert(1)");
    expect(result).toContain("Click me");
  });

  it("strips a javascript: href", () => {
    const result = sanitizeCertificateHtml('<a href="javascript:alert(1)">link</a>');
    expect(result).not.toContain("javascript:");
  });

  it("strips <iframe>/<object>/<form> entirely", () => {
    const result = sanitizeCertificateHtml('<iframe src="https://evil.example"></iframe><object></object><form></form>');
    expect(result).not.toContain("<iframe");
    expect(result).not.toContain("<object");
    expect(result).not.toContain("<form");
  });

  it("keeps structural tags and their allowed attributes intact", () => {
    const html = '<div class="card" style="color:red"><h1>Certificate</h1><p>Body</p></div>';
    const result = sanitizeCertificateHtml(html);
    expect(result).toContain('<div class="card" style="color:red">');
    expect(result).toContain("<h1>Certificate</h1>");
    expect(result).toContain("<p>Body</p>");
  });

  it("strips a block-level <style> tag (flagged by sanitize-html as inherently vulnerable to CSS exfiltration), while keeping the inline style attribute", () => {
    const result = sanitizeCertificateHtml('<style>.card { color: red; }</style><div style="color:red">ok</div>');
    expect(result).not.toContain("<style");
    expect(result).toContain('<div style="color:red">ok</div>');
  });

  it("keeps SVG and its child elements with allowed attributes", () => {
    const html = '<svg viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" fill="#000"/></svg>';
    const result = sanitizeCertificateHtml(html);
    expect(result).toContain("<svg");
    expect(result).toContain("<rect");
    expect(result).toContain('fill="#000"');
  });

  it("allows an https image src", () => {
    const result = sanitizeCertificateHtml('<img src="https://example.blob.vercel-storage.com/logo.png">');
    expect(result).toContain('src="https://example.blob.vercel-storage.com/logo.png"');
  });

  it("strips a data: or http: image src, allowing only https", () => {
    const result = sanitizeCertificateHtml('<img src="data:text/html;base64,abc"><img src="http://example.com/x.png">');
    expect(result).not.toContain("data:text/html");
    expect(result).not.toContain("http://example.com");
  });

  it("leaves an unsubstituted {{token}} placeholder untouched (no colon, not a URL scheme)", () => {
    const result = sanitizeCertificateHtml('<img src="{{logoUrl}}"><p>{{traineeName}}</p>');
    expect(result).toContain('src="{{logoUrl}}"');
    expect(result).toContain("{{traineeName}}");
  });
});
