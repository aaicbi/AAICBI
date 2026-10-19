/**
 * The clickable one-page PDF of the play card. A PDF cannot play animation, so this is the still card; the whole card and the line under it
 * are links to the course's funnel. In WhatsApp a PDF shows its first page as the thumbnail, so the page is shaped like the card.
 */
import { Document, Image, Link, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

const W = 842, CARD_H = Math.round((842 * 630) / 1200), BAR_H = 96;
const styles = StyleSheet.create({
  page: { backgroundColor: "#ffffff" },
  card: { width: W, height: CARD_H },
  bar: { height: BAR_H, paddingHorizontal: 28, paddingTop: 14, borderTopWidth: 4, borderTopColor: "#f2b84b", backgroundColor: "#ffffff" },
  title: { fontFamily: "Helvetica-Bold", fontSize: 17, color: "#0c241f" },
  sub: { fontFamily: "Helvetica", fontSize: 11.5, color: "#33463f", marginTop: 3 },
  link: { fontFamily: "Helvetica-Bold", fontSize: 11.5, color: "#0a4a41", marginTop: 5, textDecoration: "underline" },
});

export async function renderSharePdf(o: { link: string; poster: Buffer; title: string }): Promise<Buffer> {
  return renderToBuffer(
    <Document title={`Play: ${o.title}`} author="AAICBI" subject="Tap the card to play the free taster">
      <Page size={[W, CARD_H + BAR_H]} style={styles.page}>
        <Link src={o.link}>
          <Image src={{ data: o.poster, format: "png" }} style={styles.card} />
        </Link>
        <View style={styles.bar}>
          <Link src={o.link} style={{ textDecoration: "none" }}>
            <Text style={styles.title}>Tap the card to play: 5 questions, 90 seconds, free.</Text>
          </Link>
          <Text style={styles.sub}>No sign-up. See your rank, then start Module 1 free.</Text>
          <Link src={o.link} style={styles.link}>{o.link}</Link>
        </View>
      </Page>
    </Document>,
  );
}
