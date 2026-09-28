/**
 * The PDF attached to every agreement email — a branded, printable copy
 * of the exact resolved letter stored on InstructorAgreement.content
 * (never re-derived or re-worded here), plus a genuine signature block:
 * the CEO's name, title, and an actual signature image, regardless of
 * which staff member operationally clicked "Send" in the admin UI. A
 * real signed letter has one authorized signatory — the person who
 * processed the paperwork isn't necessarily who the letter is "from."
 *
 * Same tooling choice as curriculumPdf.tsx (@react-pdf/renderer, pure
 * JS, no headless browser) — see that file's own comment for the full
 * reasoning. Generated fresh at send time, not persisted — the emailed
 * PDF is the durable copy; the in-app archive already keeps the exact
 * text (see /admin/instructors/[id]'s "View full agreement").
 */
import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer } from "@react-pdf/renderer";
import { CEO_SIGNATURE_BASE64 } from "@/lib/ceoSignatureBase64";

const CEO_NAME = "Kufreh Johnson";
const CEO_TITLE = "Chief Executive Officer, AAICBI";
// The real image is 1954x1137 (~1.72:1) — fixed height/width here rather
// than letting react-pdf guess, so the signature never stretches.
const SIGNATURE_WIDTH = 150;
const SIGNATURE_HEIGHT = 87;

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", fontSize: 10, color: "#16302B" },
  masthead: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#016B61", textAlign: "center", letterSpacing: 0.5, marginBottom: 4 },
  subtitle: { fontSize: 11.5, fontFamily: "Helvetica-Bold", color: "#16302B", textAlign: "center", marginBottom: 18 },
  brandRule: { borderBottomWidth: 1.5, borderBottomColor: "#016B61", marginBottom: 20 },
  heading: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#016B61", marginTop: 12, marginBottom: 6 },
  paragraph: { fontSize: 10, color: "#16302B", lineHeight: 1.5, marginBottom: 9 },
  signatureBlock: { marginTop: 22, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#D9D9D9" },
  signatureIntro: { fontSize: 9.5, color: "#4B5563", marginBottom: 8 },
  signatureImage: { width: SIGNATURE_WIDTH, height: SIGNATURE_HEIGHT, objectFit: "contain" },
  signatureNameBlock: { borderTopWidth: 1, borderTopColor: "#9CA3AF", width: 220, marginTop: 2, paddingTop: 4 },
  signatureName: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  signatureTitle: { fontSize: 9, color: "#4B5563", marginTop: 1 },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#9CA3AF",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#D9D9D9",
    paddingTop: 8,
  },
});

/**
 * A block is treated as a heading only when it's a single line that
 * reads like one (numbered, "1. POSITION AND COURSE", or an all-caps
 * label like "SUBJECT: ..."). Everything else — including a genuinely
 * multi-line block like the address/contact lines — renders as a plain
 * paragraph, preserving react-pdf's own native handling of embedded
 * newlines. Deliberately generic rather than matching specific strings
 * from the default template, so an admin's edited template still gets
 * reasonable structure rather than one paragraph per section.
 */
function isHeadingBlock(block: string): boolean {
  if (block.includes("\n")) return false;
  if (/^\d+\.\s/.test(block)) return true;
  return block.length < 90 && /^[A-Z0-9\s()/&,.'-]+$/.test(block) && /[A-Z]{3,}/.test(block);
}

function AgreementDocument({ instructorName, content, sentAtLabel }: { instructorName: string; content: string; sentAtLabel: string }) {
  const blocks = content
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  let signature: Buffer | null = null;
  try {
    signature = Buffer.from(CEO_SIGNATURE_BASE64, "base64");
  } catch (e) {
    // A broken signature asset must never break sending the agreement
    // itself — same graceful-degradation discipline as every optional
    // integration in this app. The letter still goes out; it just
    // renders without the image, name/title still print below.
    console.error("Could not decode CEO signature image for the agreement PDF:", e);
  }

  return (
    <Document title={`AAICBI Letter of Engagement — ${instructorName}`}>
      <Page size="A4" style={styles.page}>
        {blocks.map((block, i) => {
          if (i === 0) return <Text key={i} style={styles.masthead}>{block}</Text>;
          if (i === 1 && isHeadingBlock(block)) {
            return (
              <View key={i}>
                <Text style={styles.subtitle}>{block}</Text>
                <View style={styles.brandRule} />
              </View>
            );
          }
          return isHeadingBlock(block) ? (
            <Text key={i} style={styles.heading}>{block}</Text>
          ) : (
            <Text key={i} style={styles.paragraph}>{block}</Text>
          );
        })}

        <View style={styles.signatureBlock} wrap={false}>
          <Text style={styles.signatureIntro}>Issued and approved on behalf of AAICBI by:</Text>
          {signature && <Image src={signature} style={styles.signatureImage} />}
          <View style={styles.signatureNameBlock}>
            <Text style={styles.signatureName}>{CEO_NAME}</Text>
            <Text style={styles.signatureTitle}>{CEO_TITLE}</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          AAICBI — Africa AI Capacity Building Initiative · Instructor Portal · Issued {sentAtLabel}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderInstructorAgreementPdf(input: { instructorName: string; content: string; sentAt: Date }): Promise<Buffer> {
  const sentAtLabel = input.sentAt.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
  return renderToBuffer(<AgreementDocument instructorName={input.instructorName} content={input.content} sentAtLabel={sentAtLabel} />);
}
